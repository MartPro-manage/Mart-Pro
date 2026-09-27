/**
 * Direct 1-click Download & Installation Helper for Mart Pro
 * Automatically detects OS and triggers direct file download without opening any modal dialog.
 */

export async function triggerDirectAppDownload(deferredPrompt?: any) {
  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent.toLowerCase() : '';
  const isWindows = /windows/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  const isMac = /macintosh|mac os x/.test(userAgent);

  // 1. If native PWA install prompt is available, trigger it immediately
  if (deferredPrompt && typeof deferredPrompt.prompt === 'function') {
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        return { success: true, method: 'pwa' };
      }
    } catch {
      // Continue to direct file download
    }
  }

  // 2. Direct OS-specific file download with zero dialog
  if (isWindows) {
    // Generate complete Windows standalone app launcher package (.cmd)
    const cmdScript = `@echo off
setlocal enabledelayedexpansion
title Mart Pro POS - Supermarket Management Software
echo ========================================================
echo        Mart Pro Supermarket Management Software
echo              Launching Standalone App Mode
echo ========================================================
echo.

set "APP_URL=${currentUrl}"

:: Try launch in Microsoft Edge App Mode (Chromium standalone window)
if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%APP_URL%"
    goto :success
)
if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%APP_URL%"
    goto :success
)

:: Try launch in Google Chrome App Mode
if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="%APP_URL%"
    goto :success
)
if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" --app="%APP_URL%"
    goto :success
)

:: Fallback standard browser
start "" "%APP_URL%"

:success
echo Mart Pro has launched successfully!
exit /b 0
`;

    const blob = new Blob([cmdScript], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'MartPro-Windows-Setup.cmd';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    // Also download internet shortcut .url file for instant desktop access
    const urlShortcut = `[InternetShortcut]\nURL=${currentUrl}\nIconIndex=0\nHotKey=0\n`;
    const shortcutBlob = new Blob([urlShortcut], { type: 'text/plain;charset=utf-8' });
    const shortcutUrl = URL.createObjectURL(shortcutBlob);
    const shortcutLink = document.createElement('a');
    shortcutLink.href = shortcutUrl;
    shortcutLink.download = 'MartPro-Desktop-Shortcut.url';
    document.body.appendChild(shortcutLink);
    shortcutLink.click();
    document.body.removeChild(shortcutLink);
    URL.revokeObjectURL(shortcutUrl);

    return { success: true, method: 'windows' };
  } else if (isAndroid) {
    // Generate Android Web App launcher (.html) with auto-redirect and PWA home-screen installer
    const androidLauncher = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mart Pro POS</title>
  <link rel="manifest" href="${currentUrl}/manifest.webmanifest">
  <meta name="theme-color" content="#ea580c">
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; }
    .btn { background: #ea580c; color: white; padding: 14px 28px; border-radius: 12px; font-weight: bold; text-decoration: none; font-size: 16px; margin-top: 20px; display: inline-block; }
  </style>
</head>
<body>
  <h2>Mart Pro Supermarket POS</h2>
  <p>Launching Mart Pro on your Android device...</p>
  <a class="btn" href="${currentUrl}">Open Mart Pro App</a>
  <script>
    window.location.href = "${currentUrl}";
  </script>
</body>
</html>`;

    const blob = new Blob([androidLauncher], { type: 'text/html;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'MartPro-Android-App.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    return { success: true, method: 'android' };
  } else {
    // Universal Web / Desktop Shortcut package
    const universalLauncher = `[InternetShortcut]\nURL=${currentUrl}\nIconIndex=0\n`;
    const blob = new Blob([universalLauncher], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = isMac ? 'MartPro-Mac.url' : 'MartPro-App.url';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    return { success: true, method: 'universal' };
  }
}
