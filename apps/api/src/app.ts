/**
 * Express application factory: middleware and routes, without binding a port,
 * so tests can drive an instance in-process (Supertest). index.ts starts it.
 */
import type { HealthResponse } from '@flowboard/shared';
import express, { type Express } from 'express';
import { boardRoutes } from './boards/board-routes.ts';
import { cardRoutes } from './cards/card-routes.ts';
import { columnRoutes } from './columns/column-routes.ts';
import type { PrismaClient } from './db/client.ts';
import { handleError, sendError } from './errors.ts';
import { checkHost, setSecurityHeaders } from './security.ts';

export interface AppOptions {
  /** Host names accepted besides localhost, 127.0.0.1 and [::1] (ALLOWED_HOSTS). */
  allowedHosts?: readonly string[];
}

/** A new, independent app instance, reading and writing through `prisma`. */
export function createApp(prisma: PrismaClient, { allowedHosts = [] }: AppOptions = {}): Express {
  const app = express();

  // No framework fingerprint in response headers.
  app.disable('x-powered-by');
  // Before the body is read, and on every response, errors included.
  app.use(setSecurityHeaders);
  app.use(checkHost(allowedHosts));
  // The longest description with every character escaped (\u0001, 6 bytes) is 60 kB.
  app.use(express.json({ limit: '100kb' }));

  /**
   * GET /api/health — liveness probe for the web app's status panel and, once
   * deployed, the hosting platform's health checks. It does not touch the database.
   * 200 → HealthResponse
   */
  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
    res.json(body);
  });

  app.use('/api', boardRoutes(prisma));
  app.use('/api', columnRoutes(prisma));
  app.use('/api', cardRoutes(prisma));

  // Unmatched routes: a JSON 404 in the API's error shape, not Express's HTML page.
  app.use((req, res) => {
    sendError(res, 404, `No route for ${req.method} ${req.originalUrl}`);
  });

  app.use(handleError);

  return app;
}
