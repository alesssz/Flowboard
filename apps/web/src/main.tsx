/**
 * Web app entry point, loaded by index.html: mounts the React tree into #root.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const rootElement = document.getElementById('root');

// An explicit check rather than the template's non-null assertion (`!`): if
// the mount node in index.html is ever renamed, the error says so.
if (!rootElement) {
  throw new Error('Mount node #root not found in index.html');
}

// StrictMode runs effects twice in development to surface missing cleanups:
// a doubled request in the network panel is expected there, not in production.
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
