/**
 * Web app entry point, loaded by index.html: mounts the React tree into #root.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isClientError } from './api.ts';
import './index.css';
import App from './App.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Up to 3 retries, as by default, but none for a 4xx: a missing board stays missing.
      retry: (failureCount, error) => !isClientError(error) && failureCount < 3,
    },
  },
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Mount node #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
