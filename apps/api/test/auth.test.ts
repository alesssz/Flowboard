// Accounts and sessions: sign up, sign in, sign out, the signed-in user, and the limits on attempts.
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.ts';
import { RateLimiter } from '../src/auth/rate-limit.ts';
import { useTestApp } from './test-app.ts';

const { api, prisma } = useTestApp();

const ada = { email: 'Ada@Example.com ', name: 'Ada Okafor', password: 'a long enough passphrase' };
const day = 24 * 60 * 60 * 1000;

type Api = typeof api;

/** The cookie a response set, as a browser would send it back: `name=value`. */
function cookieOf(response: request.Response): string {
  const header = ([] as string[]).concat(response.headers['set-cookie'] ?? [])[0];
  if (header === undefined) throw new Error('No Set-Cookie header');
  return header.split(';')[0] ?? '';
}

function sessionIdOf(cookie: string): string {
  return createHash('sha256').update(cookie.split('=')[1] ?? '').digest('hex');
}

async function signUp(client: Api = api) {
  const response = await client.post('/api/auth/sign-up').send(ada);
  expect(response.status).toBe(201);
  return { user: response.body as { id: string }, cookie: cookieOf(response) };
}

describe('POST /api/auth/sign-up', () => {
  it('creates the account, signs it in and answers with the user, never the hash', async () => {
    const response = await api.post('/api/auth/sign-up').send(ada);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: expect.any(String), email: 'ada@example.com', name: 'Ada Okafor' });
    const setCookie = String(response.headers['set-cookie']);
    expect(setCookie).toMatch(/^flowboard_session=[A-Za-z0-9_-]{43}; /);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'ada@example.com' }, include: { sessions: true } });
    expect(user.passwordHash).toMatch(/^\$scrypt\$/);
    // Only the token's hash is stored.
    expect(user.sessions.map((session) => session.id)).toEqual([sessionIdOf(cookieOf(response))]);
  });

  it('refuses an email that already has an account, whatever its case, with a 409', async () => {
    await signUp();

    const response = await api.post('/api/auth/sign-up').send({ ...ada, email: 'ADA@example.com' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'Conflict', message: 'email: an account with this email already exists' });
    expect(await prisma.user.count()).toBe(1);
  });

  it.each([
    ['a password under 15 characters', { ...ada, password: 'fourteen chars' }, 'password: must be at least 15 characters'],
    ['an address that is not an email', { ...ada, email: 'ada.example.com' }, 'email: must be an email address'],
    ['an empty name', { ...ada, name: '  ' }, 'name: must not be empty'],
    ['a field it does not know', { ...ada, role: 'admin' }, expect.stringContaining('role')],
  ])('refuses %s with a 400', async (_scenario, body, message) => {
    const response = await api.post('/api/auth/sign-up').send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(message);
    expect(await prisma.user.count()).toBe(0);
  });
});

describe('POST /api/auth/sign-in', () => {
  it('signs in with the right password, whatever the email case, and starts a session', async () => {
    const { user } = await signUp();

    const response = await api.post('/api/auth/sign-in').send({ email: ' ADA@example.COM', password: ada.password });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: user.id, email: 'ada@example.com', name: 'Ada Okafor' });
    expect(await prisma.session.findUnique({ where: { id: sessionIdOf(cookieOf(response)) } })).not.toBeNull();
  });

  it('answers a wrong password and an unknown email with the same 401', async () => {
    await signUp();

    const wrong = await api.post('/api/auth/sign-in').send({ email: ada.email, password: 'not the passphrase at all' });
    const unknown = await api.post('/api/auth/sign-in').send({ email: 'nobody@example.com', password: ada.password });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual({ error: 'Unauthorized', message: 'Wrong email or password' });
    expect(unknown.body).toEqual(wrong.body);
    expect(wrong.headers['set-cookie']).toBeUndefined();
  });

  it('ends the session the browser held before, so a planted cookie is not kept', async () => {
    const { cookie: before } = await signUp();

    const response = await api.post('/api/auth/sign-in').set('Cookie', before).send({ email: ada.email, password: ada.password });

    expect(response.status).toBe(200);
    expect(cookieOf(response)).not.toBe(before);
    expect((await prisma.session.findMany()).map((session) => session.id)).toEqual([sessionIdOf(cookieOf(response))]);
  });

  it('replaces a hash made with older parameters', async () => {
    const salt = randomBytes(16);
    const key = scryptSync(ada.password, salt, 32, { N: 2 ** 10, r: 8, p: 1 });
    const b64 = (bytes: Buffer) => bytes.toString('base64').replace(/=+$/, '');
    await prisma.user.create({
      data: { email: 'ada@example.com', name: ada.name, passwordHash: `$scrypt$ln=10,r=8,p=1$${b64(salt)}$${b64(key)}` },
    });

    const response = await api.post('/api/auth/sign-in').send({ email: ada.email, password: ada.password });

    expect(response.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { email: 'ada@example.com' } })).passwordHash).toMatch(/^\$scrypt\$ln=14,/);
  });
});

describe('GET /api/auth/me', () => {
  it('answers the signed-in user', async () => {
    const { user, cookie } = await signUp();

    const response = await api.get('/api/auth/me').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: user.id, email: 'ada@example.com', name: 'Ada Okafor' });
  });

  it.each([
    ['no cookie', undefined],
    ['a token no session has', `flowboard_session=${randomBytes(32).toString('base64url')}`],
    ['a value that is not a token', 'flowboard_session=../../etc'],
  ])('answers 401 with %s', async (_scenario, cookie) => {
    await signUp();

    const response = await (cookie === undefined ? api.get('/api/auth/me') : api.get('/api/auth/me').set('Cookie', cookie));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized', message: 'Not signed in' });
  });

  it('answers 401 once the session has ended, and deletes it', async () => {
    const { cookie } = await signUp();
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const response = await api.get('/api/auth/me').set('Cookie', cookie);

    expect(response.status).toBe(401);
    expect(await prisma.session.count()).toBe(0);
  });

  it('pushes the end back to 7 days from now when used a day or more after the last push', async () => {
    const { cookie } = await signUp();
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() + 5 * day) } });

    await api.get('/api/auth/me').set('Cookie', cookie);

    const { expiresAt } = await prisma.session.findFirstOrThrow();
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 7 * day - 60_000);
  });

  it('never pushes the end past 30 days after sign-in', async () => {
    const { cookie } = await signUp();
    const createdAt = new Date(Date.now() - 29 * day);
    await prisma.session.updateMany({ data: { createdAt, expiresAt: new Date(Date.now() + 5 * day) } });

    await api.get('/api/auth/me').set('Cookie', cookie);

    const { expiresAt } = await prisma.session.findFirstOrThrow();
    expect(expiresAt.getTime()).toBe(createdAt.getTime() + 30 * day);
  });
});

describe('POST /api/auth/sign-out', () => {
  it('ends the session and clears the cookie', async () => {
    const { cookie } = await signUp();

    const response = await api.post('/api/auth/sign-out').set('Cookie', cookie);

    expect(response.status).toBe(204);
    expect(String(response.headers['set-cookie'])).toMatch(/^flowboard_session=; .*Expires=Thu, 01 Jan 1970/);
    expect(await prisma.session.count()).toBe(0);
    expect((await api.get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('answers 204 without a session', async () => {
    expect((await api.post('/api/auth/sign-out')).status).toBe(204);
  });
});

describe('the session cookie, deployed', () => {
  it('is Secure, with the __Host- prefix, when not served over HTTP on the loopback', async () => {
    const deployed = request(createApp(prisma, { allowedHosts: ['flowboard.example'] }));

    const response = await deployed.post('/api/auth/sign-up').set('Host', 'flowboard.example').send(ada);

    expect(response.status).toBe(201);
    const setCookie = String(response.headers['set-cookie']);
    expect(setCookie).toMatch(/^__Host-flowboard_session=/);
    expect(setCookie).toContain('Secure');
    expect(setCookie).not.toContain('Domain');
  });
});

describe('the limits on attempts', () => {
  it('stops sign-ins for an email after 10 failures, even with the right password, saying how long to wait', async () => {
    const client = request(createApp(prisma));
    await signUp(client);
    for (let attempt = 0; attempt < 10; attempt++) {
      expect((await client.post('/api/auth/sign-in').send({ email: ada.email, password: 'wrong passphrase, again' })).status).toBe(401);
    }

    const response = await client.post('/api/auth/sign-in').send({ email: 'ADA@example.com', password: ada.password });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: 'Too Many Requests', message: 'Too many attempts: try again in 15 minutes' });
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(890);
  });

  it('counts an email from zero again after a sign-in succeeds', async () => {
    const client = request(createApp(prisma));
    await signUp(client);
    const wrong = () => client.post('/api/auth/sign-in').send({ email: ada.email, password: 'wrong passphrase, again' });
    for (let attempt = 0; attempt < 9; attempt++) await wrong();
    expect((await client.post('/api/auth/sign-in').send({ email: ada.email, password: ada.password })).status).toBe(200);

    for (let attempt = 0; attempt < 9; attempt++) await wrong();

    expect((await wrong()).status).toBe(401);
  });

  it('stops an address after 100 sign-ups and sign-ins, before reading the body', async () => {
    const client = request(createApp(prisma));
    for (let attempt = 0; attempt < 50; attempt++) {
      await client.post('/api/auth/sign-up').send({});
      await client.post('/api/auth/sign-in').send({});
    }

    const response = await client.post('/api/auth/sign-up').send(ada);

    expect(response.status).toBe(429);
    expect(await prisma.user.count()).toBe(0);
  });
});

describe('RateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets a key through again once its window has ended', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const limiter = new RateLimiter(2, 60_000);
    limiter.hit('a');
    limiter.hit('a');
    expect(limiter.hit('a')).toBe(60);
    expect(limiter.hit('b')).toBe(0);

    vi.advanceTimersByTime(60_000);

    expect(limiter.hit('a')).toBe(0);
  });
});
