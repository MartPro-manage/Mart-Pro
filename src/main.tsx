import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker with automatic updates and offline capabilities
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('Mart Pro PWA: New content available, auto-updating...');
  },
  onOfflineReady() {
    console.log('Mart Pro PWA: App ready to work offline');
  },
  onRegisterError(error) {
    console.warn('Mart Pro PWA registration error:', error);
  },
});

// Ensure day/light mode default by clearing any legacy dark mode settings
try {
  localStorage.removeItem('martpro_theme');
  document.documentElement.classList.remove('dark');
  document.body.classList.remove('dark');
} catch {
  // ignore
}

// Handle global unhandled promise rejections (e.g. IndexedDB, Vite HMR websocket send)
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || '');
  if (
    msg.includes('send') ||
    msg.includes('vite') ||
    msg.includes('WebSocket') ||
    msg.includes('indexeddb') ||
    msg.includes('FILE_ERROR_NO_SPACE') ||
    msg.includes('QuotaExceededError') ||
    event.reason?.name === 'QuotaExceededError'
  ) {
    console.warn('Caught non-fatal background / HMR / storage exception:', msg);
    event.preventDefault(); // Prevent app crash on storage or HMR errors
  }
});

// Prevent non-fatal DOM, Vite HMR send or chart layout errors from crashing the app
window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (
    msg.includes("reading 'send'") ||
    msg.includes("properties of undefined (reading 'send')") ||
    msg.includes('clientWidth') ||
    msg.includes('clientHeight') ||
    msg.includes('getBoundingClientRect')
  ) {
    console.warn('Caught non-fatal Vite HMR / layout error:', msg);
    event.preventDefault(); // Prevent crash
  }
});

// Global hook for beforeinstallprompt event - allow browser to display native address bar install button
declare global {
  interface Window {
    deferredPrompt?: any;
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  // Do not call preventDefault() so Chrome and Edge show the native Install/Download button in the address bar
  window.deferredPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-install-ready'));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
