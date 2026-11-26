// The session check in front of the board, column, card and comment routes: a 401 without one, the user in res.locals with.
import type { User } from '@flowboard/shared';
import type { RequestHandler, Response } from 'express';
import type { PrismaClient } from '../db/client.ts';
import { sendError } from '../errors.ts';
import { readSession } from './sessions.ts';

export function requireSession(prisma: PrismaClient): RequestHandler {
  return async (req, res, next) => {
    const session = await readSession(prisma, req);
    if (session === null) {
      sendError(res, 401, 'Not signed in');
      return;
    }
    res.locals.user = session.user;
    next();
  };
}

/** The user requireSession let through. Only for a route behind it: anywhere else it throws, a 500. */
export function signedInUser(res: Response): User {
  const user: unknown = res.locals.user;
  if (user === undefined) throw new Error('signedInUser on a route without requireSession');
  return user as User;
}
