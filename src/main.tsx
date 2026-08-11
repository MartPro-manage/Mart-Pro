import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
