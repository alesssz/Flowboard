/**
 * Web app entry point, loaded by index.html: mounts the React tree into #root.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const rootElement = document.getElementById('root');

// Fails with a clear message, rather than a non-null assertion, if the mount node is renamed.
if (!rootElement) {
  throw new Error('Mount node #root not found in index.html');
}

// In development StrictMode runs effects twice: the doubled /api/health request is expected.
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
