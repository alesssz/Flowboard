// Sessions: a random token in an HttpOnly cookie, its SHA-256 as the Session row's id.
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@flowboard/shared';
import type { CookieOptions, Request, Response } from 'express';
import type { PrismaClient } from '../db/client.ts';
import { isLocalHost } from '../security.ts';

const day = 24 * 60 * 60 * 1000;
/** A session unused for this long ends. */
export const idleTimeout = 7 * day;
/** A session ends this long after sign-in, however much it is used. */
export const absoluteTimeout = 30 * day;
// Pushing the end back at most once a day saves a write on every request.
const extendEvery = day;

export const userFields = { id: true, email: true, name: true } as const;

/**
 * Secure, with the __Host- prefix (no Domain, Path=/, so no other subdomain can set or read it), except
 * over plain HTTP on the loopback, where development runs and a Secure cookie would not come back.
 */
function cookieFor(req: Request): { name: string; options: CookieOptions } {
  const secure = !(req.protocol === 'http' && isLocalHost(req.hostname));
  return {
    name: secure ? '__Host-flowboard_session' : 'flowboard_session',
    options: { httpOnly: true, secure, sameSite: 'lax', path: '/' },
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function readToken(req: Request): string | undefined {
  const { name } = cookieFor(req);
  for (const pair of (req.get('Cookie') ?? '').split(';')) {
    const [key, value] = pair.trim().split('=');
    // 32 random bytes in base64url; anything else cannot be a token, and is not looked up.
    if (key === name && value !== undefined && /^[A-Za-z0-9_-]{43}$/.test(value)) return value;
  }
  return undefined;
}

/** Signs `userId` in: a new session and its cookie. Any session the browser held ends first (no fixation). */
export async function startSession(prisma: PrismaClient, req: Request, res: Response, userId: string): Promise<void> {
  const previous = readToken(req);
  const now = Date.now();
  const token = randomBytes(32).toString('base64url');
  // The user's ended sessions go too, so the table does not keep every one ever started.
  const ended = [{ userId, expiresAt: { lte: new Date(now) } }, ...(previous === undefined ? [] : [{ id: hashToken(previous) }])];
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { OR: ended } }),
    prisma.session.create({ data: { id: hashToken(token), userId, expiresAt: new Date(now + idleTimeout) } }),
  ]);
  const { name, options } = cookieFor(req);
  res.cookie(name, token, { ...options, maxAge: absoluteTimeout });
}

/** The signed-in user, or null with no cookie, an unknown token or an ended session. Pushes the end back. */
export async function readSession(prisma: PrismaClient, req: Request): Promise<{ id: string; user: User } | null> {
  const token = readToken(req);
  if (token === undefined) return null;
  const id = hashToken(token);
  const session = await prisma.session.findUnique({ where: { id }, select: { createdAt: true, expiresAt: true, user: { select: userFields } } });
  if (session === null) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.deleteMany({ where: { id } });
    return null;
  }
  const lastExtended = session.expiresAt.getTime() - idleTimeout;
  if (now - lastExtended >= extendEvery) {
    const expiresAt = Math.min(now + idleTimeout, session.createdAt.getTime() + absoluteTimeout);
    await prisma.session.updateMany({ where: { id }, data: { expiresAt: new Date(expiresAt) } });
  }
  return { id, user: session.user };
}

/** Signs the browser out: its session ends and its cookie is cleared, whether or not it had one. */
export async function endSession(prisma: PrismaClient, req: Request, res: Response): Promise<void> {
  const token = readToken(req);
  if (token !== undefined) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  const { name, options } = cookieFor(req);
  res.clearCookie(name, options);
}
