/**
 * API entry point: reads the configuration, starts the HTTP server and stops
 * it gracefully. Run by tsx in development (`pnpm dev`), and as compiled
 * JavaScript in production (`pnpm build`, then `pnpm start`).
 */
import { createApp } from './app.ts';

// Hosting platforms assign the port through PORT. The default matches the
// proxy target in apps/web/vite.config.ts.
const PORT = Number(process.env.PORT ?? '3000');

const app = createApp();

// Express 5 hands listen errors (EADDRINUSE: the port is taken) to the
// callback instead of emitting them on the server, so they are handled here.
const server = app.listen(PORT, (error) => {
  if (error) {
    console.error(`Cannot start the server on port ${PORT}:`, error.message);
    process.exit(1);
  }

  console.log(`Flowboard API listening on http://localhost:${PORT}`);
});

/**
 * Stops accepting connections and lets in-flight requests finish before the
 * process exits. SIGINT is Ctrl+C in a terminal; SIGTERM is what containers
 * and hosting platforms send before a redeploy. Database pools and WebSocket
 * clients will be closed here as well.
 */
function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, shutting down`);

  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
