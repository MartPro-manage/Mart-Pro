import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createApiApp } from './src/server/app.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isDev = process.env.NODE_ENV !== 'production' && process.env.npm_lifecycle_event !== 'start';

  // Mount modular API endpoints
  app.use(createApiApp());

  if (isDev) {
    // Vite middleware for local development
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true'
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);

    // Serve transformed index.html for all SPA routes in dev
    app.use('*', async (req: Request, res: Response, next) => {
      // Skip API requests so API 404s stay JSON
      if (req.originalUrl.startsWith('/api/')) {
        return next();
      }
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Production static serving
    const distPath = fs.existsSync(path.resolve(__dirname, 'dist', 'index.html'))
      ? path.resolve(__dirname, 'dist')
      : (fs.existsSync(path.resolve(__dirname, 'index.html')) ? __dirname : path.resolve(__dirname, 'dist'));
    if (fs.existsSync(path.resolve(distPath, 'index.html'))) {
      app.use(express.static(distPath, {
        maxAge: '1h',
        etag: true
      }));

      // SPA fallback
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      // Fallback if dist hasn't been built yet during startup
      app.get('*', (_req: Request, res: Response) => {
        res.status(200).send('<h1>Mart Pro</h1><p>Building application assets...</p>');
      });
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Mart Pro Server] Running on http://0.0.0.0:${PORT} (${isDev ? 'development' : 'production'})`);
  });

  const shutdown = () => {
    console.log('[Mart Pro Server] Gracefully shutting down...');
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('[Mart Pro Server] Failed to start:', err);
  process.exit(1);
});
