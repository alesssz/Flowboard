/**
 * API entry point: configuration, HTTP server, graceful shutdown.
 */
import { createApp } from './app.ts';
import { createPrismaClient, readDatabaseUrl } from './db/client.ts';

// Hosting platforms assign PORT; 3700 is the dev proxy's target (apps/web/vite.config.ts).
const PORT = Number(process.env.PORT ?? '3700');

let databaseUrl: string;
try {
  databaseUrl = readDatabaseUrl();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

// Connects on the first query: the server starts even while the database is down.
const prisma = createPrismaClient(databaseUrl);
const app = createApp(prisma);

// Express 5 passes listen errors (e.g. EADDRINUSE) to this callback.
const server = app.listen(PORT, (error) => {
  if (error) {
    console.error(`Cannot start the server on port ${PORT}:`, error.message);
    process.exit(1);
  }

  console.log(`Flowboard API listening on http://localhost:${PORT}`);
});

/**
 * Stops accepting connections, then closes the database connections once in-flight requests
 * finish: on Ctrl+C (SIGINT), and on the platform's stop signal before a redeploy (SIGTERM).
 */
function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, shutting down`);

  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
