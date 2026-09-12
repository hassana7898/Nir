
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { setupPWA } from './services/pwa';

// Keep the existing relative /api calls working locally while allowing the
// same frontend build to call a separately hosted production API.
const apiBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
if (apiBase && typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return originalFetch(`${apiBase}${input}`, init);
    }
    if (input instanceof URL && input.pathname.startsWith('/api/')) {
      return originalFetch(`${apiBase}${input.pathname}${input.search}`, init);
    }
    if (input instanceof Request && new URL(input.url).pathname.startsWith('/api/')) {
      const url = new URL(input.url);
      return originalFetch(new Request(`${apiBase}${url.pathname}${url.search}`, input), init);
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;
}

setupPWA();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
