/**
 * Express application factory: middleware and routes, without binding a port,
 * so tests can drive an instance in-process (Supertest). index.ts starts it.
 */
import type { HealthResponse } from '@flowboard/shared';
import express, { type Express } from 'express';

/** A new, independent app instance. */
export function createApp(): Express {
  const app = express();

  app.use(express.json());
  // No framework fingerprint in response headers.
  app.disable('x-powered-by');

  /**
   * GET /api/health — liveness probe for the web app's status panel and, once
   * deployed, the hosting platform's health checks.
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

  // Unmatched routes: a JSON 404 in the API's error shape, not Express's HTML page.
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `No route for ${req.method} ${req.originalUrl}`,
    });
  });

  return app;
}
