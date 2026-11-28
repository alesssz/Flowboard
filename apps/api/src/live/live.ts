// Live updates over Socket.IO, on the API's own HTTP server: who may connect (a session, and the API's own
// Host and Origin), which board each connection follows (one, of the user's), and the notices writes send.
// Notices carry ids only: what changed is read again through the API, which checks every request.
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { TLSSocket } from 'node:tls';
import { type LiveClientEvents, type LiveServerEvents, liveSocketHeader, liveSocketPath } from '@flowboard/shared';
import type { Request, Response } from 'express';
import { Server } from 'socket.io';
import { signedInUser } from '../auth/require-session.ts';
import { readSessionFrom, type SessionSource } from '../auth/sessions.ts';
import { memberOf } from '../boards/access.ts';
import type { PrismaClient } from '../db/client.ts';
import { isAllowedHost, isAllowedOrigin } from '../security.ts';

/** Who made a write: their notice skips the connection they made it from, named by liveSocketHeader. */
export interface Writer {
  userId: string;
  socketId: string | undefined;
}

export interface Live {
  /** Tells the board's other followers that it changed; nothing for a board the write did not find (null). */
  boardChanged(boardId: string | null, writer: Writer): void;
  /** Tells the board's other followers that a card's comments changed. */
  commentsChanged(boardId: string, cardId: string, writer: Writer): void;
  /** After a board is deleted: its followers are told, then stop following it. */
  boardDeleted(boardId: string, writer: Writer): void;
  /** After a member's account leaves a board: its connections stop following it. */
  boardLeft(boardId: string, userId: string): void;
  /** After sign-out: the session's connections close. */
  sessionEnded(sessionId: string): void;
}

/** For an app without live updates, such as the one the HTTP tests drive. */
export const noLive: Live = {
  boardChanged: () => {},
  commentsChanged: () => {},
  boardDeleted: () => {},
  boardLeft: () => {},
  sessionEnded: () => {},
};

/** The writer of the request a route answers: the signed-in user, and the connection they named. */
export function writerOf(req: Request, res: Response): Writer {
  return { userId: signedInUser(res).id, socketId: req.get(liveSocketHeader) };
}

interface SocketData {
  userId: string;
  sessionId: string;
}

/** Messages from the browser are a board id and an acknowledgement: anything bigger is not read. */
const MAX_MESSAGE_BYTES = 4 * 1024;

const room = (boardId: string) => `board:${boardId}`;

/** Live updates for `prisma`'s boards, listening once attach() has the HTTP server; close() with it. */
export function createLive(prisma: PrismaClient, { allowedHosts = [] as readonly string[] } = {}) {
  const io = new Server<LiveClientEvents, LiveServerEvents, Record<string, never>, SocketData>({
    path: liveSocketPath,
    serveClient: false,
    maxHttpBufferSize: MAX_MESSAGE_BYTES,
    // The API's own Host, against DNS rebinding, and Origin, against another site opening a connection with the
    // user's cookie (which SameSite=Lax already keeps out of cross-site handshakes); refused before any upgrade.
    allowRequest: (req, callback) => {
      callback(null, isAllowedHost(hostnameOf(req), allowedHosts) && isAllowedOrigin(req.headers.origin, allowedHosts));
    },
  });

  io.use(async (socket, next) => {
    const session = await readSessionFrom(prisma, sourceOf(socket.request));
    if (session === null) {
      next(new Error('Not signed in'));
      return;
    }
    socket.data.userId = session.user.id;
    socket.data.sessionId = session.id;
    next();
  });

  io.on('connection', (socket) => {
    socket.on('board:watch', async (boardId, answer) => {
      if (typeof answer !== 'function') return;
      try {
        // The session is read again, so a connection that outlived its session follows nothing.
        if ((await readSessionFrom(prisma, sourceOf(socket.request))) === null) {
          answer({ ok: false, error: 'Not signed in' });
          socket.disconnect(true);
          return;
        }
        for (const joined of socket.rooms) if (joined.startsWith('board:')) await socket.leave(joined);
        if (boardId === null) {
          answer({ ok: true });
          return;
        }
        const visible = typeof boardId === 'string' && boardId.length <= 100
          ? await prisma.board.count({ where: { id: boardId, ...memberOf(socket.data.userId) } })
          : 0;
        if (visible === 0) {
          answer({ ok: false, error: `No board with id ${String(boardId)}` });
          return;
        }
        await socket.join(room(boardId));
        answer({ ok: true });
      } catch (error) {
        console.error(error);
        answer({ ok: false, error: 'The server could not follow the board' });
      }
    });
  });

  // The writer's connection is skipped only when it is theirs: a header naming someone else's changes nothing.
  function others(boardId: string, writer: Writer) {
    const own = writer.socketId === undefined ? undefined : io.sockets.sockets.get(writer.socketId);
    return own?.data.userId === writer.userId ? io.to(room(boardId)).except(own.id) : io.to(room(boardId));
  }

  const live: Live = {
    boardChanged(boardId, writer) {
      if (boardId !== null) others(boardId, writer).emit('board:changed', { boardId });
    },
    commentsChanged(boardId, cardId, writer) {
      others(boardId, writer).emit('comments:changed', { boardId, cardId });
    },
    boardDeleted(boardId, writer) {
      others(boardId, writer).emit('board:changed', { boardId });
      io.in(room(boardId)).socketsLeave(room(boardId));
    },
    boardLeft(boardId, userId) {
      void io.in(room(boardId)).fetchSockets().then((sockets) => {
        for (const socket of sockets) if (socket.data.userId === userId) socket.leave(room(boardId));
      });
    },
    sessionEnded(sessionId) {
      void io.fetchSockets().then((sockets) => {
        for (const socket of sockets) if (socket.data.sessionId === sessionId) socket.disconnect(true);
      });
    },
  };

  return {
    live,
    /** Starts accepting connections on the API's HTTP server. */
    attach(server: HttpServer): void {
      io.attach(server);
    },
    /** Closes every connection, and the HTTP server with them. */
    close(): Promise<void> {
      return new Promise((resolve) => {
        void io.close(() => resolve());
      });
    },
  };
}

// The handshake is a plain Node request: Express is not in front of it.
function sourceOf(req: IncomingMessage): SessionSource {
  return { cookie: req.headers.cookie, protocol: (req.socket as TLSSocket).encrypted ? 'https' : 'http', hostname: hostnameOf(req) ?? '' };
}

function hostnameOf(req: IncomingMessage): string | undefined {
  const host = req.headers.host;
  if (host === undefined) return undefined;
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return undefined;
  }
}
