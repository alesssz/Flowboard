// What every route shares: the health probe, JSON errors for unknown routes and malformed bodies.
import { describe, expect, it } from 'vitest';
import { useTestApp } from './test-app.ts';

const { api } = useTestApp();

describe('the app', () => {
  it('GET /api/health reports the server up without touching the database', async () => {
    const response = await api.get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', uptimeSeconds: expect.any(Number) });
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
  });

  it('answers an unknown route with a JSON 404', async () => {
    const response = await api.delete('/api/nowhere');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not Found', message: 'No route for DELETE /api/nowhere' });
  });

  it('answers malformed JSON with a JSON 400', async () => {
    const response = await api.post('/api/boards/any/columns').set('Content-Type', 'application/json').send('{"title":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Bad Request', message: expect.any(String) });
  });
});
