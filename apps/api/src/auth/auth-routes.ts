// Account routes: sign up, sign in, sign out, and who is signed in.
import type { User } from '@flowboard/shared';
import { signInRequestSchema, signUpRequestSchema } from '@flowboard/shared/schemas';
import { type Response, Router } from 'express';
import type { PrismaClient } from '../db/client.ts';
import { HttpError, sendError } from '../errors.ts';
import { Prisma } from '../generated/prisma/client.ts';
import type { Live } from '../live/live.ts';
import { parseBody } from '../validation.ts';
import { hashPassword, needsRehash, verifyPassword } from './passwords.ts';
import { RateLimiter } from './rate-limit.ts';
import { endSession, readSession, startSession, userFields } from './sessions.ts';

const fifteenMinutes = 15 * 60 * 1000;

/** Mounted under /api. A rejected handler reaches the app's error handler (Express 5). */
export function authRoutes(prisma: PrismaClient, live: Live): Router {
  const router = Router();
  // Per address: sign-ups and sign-ins together. Per email: sign-ins until one succeeds, so a guessing
  // run from many addresses still stops; it slows the account's owner only while the run lasts.
  const perAddress = new RateLimiter(100, fifteenMinutes);
  const perEmail = new RateLimiter(10, fifteenMinutes);
  // Checked against when the email is unknown, so the time taken does not tell which accounts exist.
  const unknownUserHash = hashPassword('no account has this password');

  /** POST /api/auth/sign-up — SignUpRequest → 201 User, signed in · 400 · 409 · 429 */
  router.post('/auth/sign-up', async (req, res) => {
    if (refuseIfLimited(res, perAddress, req.ip)) return;
    const { email, name, password } = parseBody(signUpRequestSchema, req.body);

    let body: User;
    try {
      body = await prisma.user.create({ data: { email, name, passwordHash: await hashPassword(password) }, select: userFields });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new HttpError(409, 'email: an account with this email already exists');
      }
      throw error;
    }
    await startSession(prisma, req, res, body.id);
    res.status(201).json(body);
  });

  /** POST /api/auth/sign-in — SignInRequest → 200 User, signed in · 400 · 401 · 429 */
  router.post('/auth/sign-in', async (req, res) => {
    if (refuseIfLimited(res, perAddress, req.ip)) return;
    const { email, password } = parseBody(signInRequestSchema, req.body);
    if (refuseIfLimited(res, perEmail, email)) return;

    const user = await prisma.user.findUnique({ where: { email }, select: { ...userFields, passwordHash: true } });
    const matches = await verifyPassword(password, user?.passwordHash ?? (await unknownUserHash));
    if (user === null || !matches) throw new HttpError(401, 'Wrong email or password');

    perEmail.reset(email);
    const { passwordHash, ...body } = user;
    if (needsRehash(passwordHash)) {
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
    }
    await startSession(prisma, req, res, user.id);
    res.json(body satisfies User);
  });

  /** POST /api/auth/sign-out — 204, signed out, with or without a session */
  router.post('/auth/sign-out', async (req, res) => {
    const sessionId = await endSession(prisma, req, res);
    // The session's live connections close with it.
    if (sessionId !== undefined) live.sessionEnded(sessionId);
    res.status(204).end();
  });

  /** GET /api/auth/me — 200 User · 401 */
  router.get('/auth/me', async (req, res) => {
    const session = await readSession(prisma, req);
    if (session === null) {
      sendError(res, 401, 'Not signed in');
      return;
    }
    res.json(session.user satisfies User);
  });

  return router;
}

// Without `trust proxy`, req.ip is the address the connection came from; behind a proxy, the proxy's.
function refuseIfLimited(res: Response, limiter: RateLimiter, key = 'unknown'): boolean {
  const waitSeconds = limiter.hit(key);
  if (waitSeconds === 0) return false;
  res.set('Retry-After', String(waitSeconds));
  sendError(res, 429, `Too many attempts: try again in ${Math.ceil(waitSeconds / 60)} minutes`);
  return true;
}
