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

// Handle global unhandled promise rejections (e.g. IndexedDB leveldb FILE_ERROR_NO_SPACE)
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason &&
    (event.reason.message?.includes('indexeddb') ||
     event.reason.message?.includes('FILE_ERROR_NO_SPACE') ||
     event.reason.message?.includes('QuotaExceededError') ||
     event.reason.name === 'QuotaExceededError')
  ) {
    console.warn('Caught local storage / IndexedDB quota error:', event.reason);
    event.preventDefault(); // Prevent app crash on storage quota error
  }
});

// Prevent non-fatal DOM / chart layout errors (like clientWidth on null elements during resize/unmount) from crashing the app
window.addEventListener('error', (event) => {
  if (
    event.message &&
    (event.message.includes('clientWidth') ||
     event.message.includes('clientHeight') ||
     event.message.includes('getBoundingClientRect'))
  ) {
    console.warn('Caught non-fatal layout / chart dimension error:', event.message);
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
