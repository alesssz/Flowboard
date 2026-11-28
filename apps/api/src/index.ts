/**
 * API entry point: configuration, HTTP server with live updates, graceful shutdown.
 */
import { createApp } from './app.ts';
import { createPrismaClient, readDatabaseUrl } from './db/client.ts';
import { createLive } from './live/live.ts';
import { readAllowedHosts } from './security.ts';

// Hosting platforms assign PORT; 3700 is the dev proxy's target (apps/web/vite.config.ts).
const PORT = Number(process.env.PORT ?? '3700');
// Loopback only, so other devices on the network cannot reach it; a container sets 0.0.0.0.
const HOST = process.env.HOST || '127.0.0.1';

let databaseUrl: string;
try {
  databaseUrl = readDatabaseUrl();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

// Connects on the first query: the server starts even while the database is down.
const prisma = createPrismaClient(databaseUrl);
const allowedHosts = readAllowedHosts();
const live = createLive(prisma, { allowedHosts });
const app = createApp(prisma, { allowedHosts, live: live.live });

// Express 5 passes listen errors (e.g. EADDRINUSE) to this callback.
const server = app.listen(PORT, HOST, (error) => {
  if (error) {
    console.error(`Cannot start the server on ${HOST} port ${PORT}:`, error.message);
    process.exit(1);
  }

  console.log(`Flowboard API listening on ${HOST} port ${PORT}`);
});
live.attach(server);

/**
 * Closes the live connections and stops accepting requests, then closes the database connections once
 * in-flight requests finish: on Ctrl+C (SIGINT), and on the platform's stop signal before a redeploy (SIGTERM).
 */
function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, shutting down`);

  // Socket.IO closes the HTTP server too.
  void live.close().then(() => prisma.$disconnect()).finally(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
