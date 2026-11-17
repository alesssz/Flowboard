/**
 * API entry point: configuration, HTTP server, graceful shutdown.
 */
import { createApp } from './app.ts';

// Hosting platforms assign PORT; 3700 is the dev proxy's target (apps/web/vite.config.ts).
const PORT = Number(process.env.PORT ?? '3700');

const app = createApp();

// Express 5 passes listen errors (e.g. EADDRINUSE) to this callback.
const server = app.listen(PORT, (error) => {
  if (error) {
    console.error(`Cannot start the server on port ${PORT}:`, error.message);
    process.exit(1);
  }

  console.log(`Flowboard API listening on http://localhost:${PORT}`);
});

/**
 * Stops accepting connections and exits once in-flight requests finish: on
 * Ctrl+C (SIGINT), and on the platform's stop signal before a redeploy (SIGTERM).
 */
function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, shutting down`);

  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
