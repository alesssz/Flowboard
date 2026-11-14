/**
 * Express application factory: middleware and routes, no network binding.
 *
 * Building the app is kept apart from starting it (index.ts) so tests can
 * drive a fresh instance in-process, e.g. with Supertest, without opening a port.
 */
import express, { type Express } from 'express';

/**
 * Body of `GET /api/health`.
 *
 * The web app keeps a copy of this type until the shared types package
 * (@flowboard/shared) gives both sides a single definition.
 */
export interface HealthResponse {
  status: 'ok';
  /** When the response was produced, ISO 8601. */
  timestamp: string;
  /** Seconds since the Node process started. */
  uptimeSeconds: number;
}

/** Builds a new, independent app instance. */
export function createApp(): Express {
  const app = express();

  // Parses JSON request bodies into `req.body`, for the write endpoints to come.
  app.use(express.json());

  // Do not advertise the framework in every response header.
  app.disable('x-powered-by');

  // Liveness probe: used by the web app's status panel, and later by the
  // hosting platform's health checks. Every route lives under /api, the only
  // prefix the Vite development proxy forwards to this server.
  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
    res.json(body);
  });

  // Registered after every route, so only unmatched requests reach it. Express
  // would answer them with an HTML page; API clients get the same JSON error
  // shape as everywhere else instead.
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `No route for ${req.method} ${req.originalUrl}`,
    });
  });

  return app;
}
