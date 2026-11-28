/**
 * Express application factory: middleware and routes, without binding a port,
 * so tests can drive an instance in-process (Supertest). index.ts starts it.
 */
import type { HealthResponse } from '@flowboard/shared';
import express, { type Express } from 'express';
import { authRoutes } from './auth/auth-routes.ts';
import { requireSession } from './auth/require-session.ts';
import { boardRoutes } from './boards/board-routes.ts';
import { cardRoutes } from './cards/card-routes.ts';
import { columnRoutes } from './columns/column-routes.ts';
import { commentRoutes } from './comments/comment-routes.ts';
import type { PrismaClient } from './db/client.ts';
import { handleError, sendError } from './errors.ts';
import { invitationRoutes } from './invitations/invitation-routes.ts';
import { labelRoutes } from './labels/label-routes.ts';
import { type Live, noLive } from './live/live.ts';
import { memberRoutes } from './members/member-routes.ts';
import { checkHost, checkOrigin, setSecurityHeaders } from './security.ts';

export interface AppOptions {
  /** Host names accepted besides localhost, 127.0.0.1 and [::1] (ALLOWED_HOSTS). */
  allowedHosts?: readonly string[];
  /** Where writes send their notices; none by default, as in the HTTP tests. */
  live?: Live;
}

/** A new, independent app instance, reading and writing through `prisma`. */
export function createApp(prisma: PrismaClient, { allowedHosts = [], live = noLive }: AppOptions = {}): Express {
  const app = express();

  // No framework fingerprint in response headers.
  app.disable('x-powered-by');
  // Before the body is read, and on every response, errors included.
  app.use(setSecurityHeaders);
  app.use(checkHost(allowedHosts));
  app.use(checkOrigin(allowedHosts));
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

  app.use('/api', authRoutes(prisma, live));
  // Every route under these paths needs a session; a new kind of resource adds its path here.
  app.use(['/api/boards', '/api/columns', '/api/cards', '/api/comments', '/api/labels', '/api/members', '/api/invitations'], requireSession(prisma));
  app.use('/api', boardRoutes(prisma, live));
  app.use('/api', columnRoutes(prisma, live));
  app.use('/api', cardRoutes(prisma, live));
  app.use('/api', commentRoutes(prisma, live));
  app.use('/api', labelRoutes(prisma, live));
  app.use('/api', memberRoutes(prisma, live));
  app.use('/api', invitationRoutes(prisma, live));

  // Unmatched routes: a JSON 404 in the API's error shape, not Express's HTML page.
  app.use((req, res) => {
    sendError(res, 404, `No route for ${req.method} ${req.originalUrl}`);
  });

  app.use(handleError);

  return app;
}
