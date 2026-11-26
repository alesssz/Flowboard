// The defences every route shares: the Host check, the security headers, the size limit on bodies.
import { cardDescriptionMaxLength } from '@flowboard/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { readAllowedHosts } from '../src/security.ts';
import { createBoard, createMemberAccount } from './fixtures.ts';
import { useTestApp } from './test-app.ts';

const { member, prisma } = useTestApp();
// Robin Park's account exists in every test, board or not, so `member` is signed in.
beforeEach(() => createMemberAccount(prisma));

describe('the Host check', () => {
  it('refuses a foreign Host with a JSON 403, without running the route', async () => {
    const { columns } = await createBoard(prisma);

    const response = await member
      .delete(`/api/columns/${columns.todo.id}`)
      .set('Host', 'attacker.example');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Forbidden', message: 'Host not allowed' });
    expect(await prisma.column.count({ where: { id: columns.todo.id } })).toBe(1);
  });

  it.each(['localhost', 'localhost:3700', '127.0.0.1:3700', '[::1]:3700', 'LOCALHOST'])(
    'accepts the local Host %s',
    async (host) => {
      const response = await member.get('/api/health').set('Host', host);

      expect(response.status).toBe(200);
    },
  );

  it('accepts a host from ALLOWED_HOSTS, in any case and with a port', async () => {
    const deployed = request(createApp(prisma, { allowedHosts: readAllowedHosts(' flowboard.example , member.flowboard.example') }));

    expect((await deployed.get('/api/health').set('Host', 'Flowboard.Example:443')).status).toBe(200);
    expect((await deployed.get('/api/health').set('Host', 'member.flowboard.example')).status).toBe(200);
    expect((await deployed.get('/api/health').set('Host', 'flowboard.example.attacker.example')).status).toBe(403);
  });

  it('ignores X-Forwarded-Host', async () => {
    const response = await member.get('/api/health').set('Host', 'attacker.example').set('X-Forwarded-Host', 'localhost');

    expect(response.status).toBe(403);
  });
});

describe('the Origin check', () => {
  it.each([
    ['another site', 'https://attacker.example'],
    ['a sibling subdomain', 'https://evil.localhost.example'],
    ['a sandboxed frame or a file', 'null'],
  ])('refuses a write from a page of %s with a JSON 403, without running the route', async (_scenario, origin) => {
    const { columns } = await createBoard(prisma);

    const response = await member.delete(`/api/columns/${columns.todo.id}`).set('Origin', origin);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Forbidden', message: 'Origin not allowed' });
    expect(await prisma.column.count({ where: { id: columns.todo.id } })).toBe(1);
  });

  it('accepts a write from the web app, and from a client that sends no Origin', async () => {
    const { columns } = await createBoard(prisma);

    expect((await member.patch(`/api/columns/${columns.todo.id}`).set('Origin', 'http://localhost:5873').send({ title: 'Next' })).status).toBe(200);
    expect((await member.patch(`/api/columns/${columns.todo.id}`).send({ title: 'Later' })).status).toBe(200);
  });

  it('lets reads through: the browser keeps their answers from other origins', async () => {
    const response = await member.get('/api/health').set('Origin', 'https://attacker.example');

    expect(response.status).toBe(200);
    expect(response.headers).not.toHaveProperty('access-control-allow-origin');
  });
});

describe('the security headers', () => {
  it.each([
    ['a success', '/api/health', 'localhost', 200],
    ['an unknown route', '/api/nowhere', 'localhost', 404],
    ['a refused Host', '/api/health', 'attacker.example', 403],
  ])('are on %s', async (_scenario, path, host, status) => {
    const response = await member.get(path).set('Host', host);

    expect(response.status).toBe(status);
    expect(response.headers).toMatchObject({
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
      'cross-origin-resource-policy': 'same-origin',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'cache-control': 'no-store',
    });
    expect(response.headers).not.toHaveProperty('x-powered-by');
  });
});

describe('the size limit on bodies', () => {
  it('accepts the longest description, even with every character escaped', async () => {
    const { cards } = await createBoard(prisma);
    const description = '\u0001'.repeat(cardDescriptionMaxLength);

    const response = await member.patch(`/api/cards/${cards.first.id}`).send({ description });

    expect(response.status).toBe(200);
    expect(response.body.description).toBe(description);
  });

  it('answers a body over 100 kB with a JSON 413, before reading it', async () => {
    const { cards } = await createBoard(prisma);

    const response = await member.patch(`/api/cards/${cards.first.id}`).send({ description: 'x'.repeat(110_000) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: 'Payload Too Large', message: expect.any(String) });
    expect((await prisma.card.findUniqueOrThrow({ where: { id: cards.first.id } })).description).toBe('Line one\nLine two');
  });

  it('refuses a write whose body is not JSON', async () => {
    const { columns } = await createBoard(prisma);

    const response = await member
      .post(`/api/columns/${columns.todo.id}/cards`)
      .set('Content-Type', 'text/plain')
      .send('{"title":"From another site"}');

    expect(response.status).toBe(400);
    expect(await prisma.card.count({ where: { title: 'From another site' } })).toBe(0);
  });
});
