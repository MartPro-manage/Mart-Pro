import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const isDev = process.env.NODE_ENV !== "production" && !process.env.PORT;

  app.use(express.json({ limit: "10mb" }));

  // Health check endpoint for Cloud Run and load balancers
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "healthy",
      service: "mart-pro-pos",
      timestamp: new Date().toISOString()
    });
  });

  if (isDev) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true"
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath, {
        maxAge: "1h",
        etag: true
      }));

      app.get("*", (_req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    } else {
      app.get("*", (_req, res) => {
        res.status(200).send("<h1>Mart Pro</h1><p>Building application assets...</p>");
      });
    }
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Mart Pro Server] Running on http://0.0.0.0:${PORT} (${isDev ? "development" : "production"})`);
  });

  const shutdown = () => {
    console.log("[Mart Pro Server] Gracefully shutting down...");
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch((err) => {
  console.error("[Mart Pro Server] Failed to start:", err);
  process.exit(1);
});
