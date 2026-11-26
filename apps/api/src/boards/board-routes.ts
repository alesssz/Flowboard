// Board routes, read-only: the user's boards, and one board with its columns, cards, labels and members.
import type { Board, BoardSummary } from '@flowboard/shared';
import { Router } from 'express';
import type { PrismaClient } from '../db/client.ts';
import { signedInUser } from '../auth/require-session.ts';
import { sendError } from '../errors.ts';
import { findBoard, listBoards } from './board-queries.ts';

/** Mounted under /api. A rejected handler reaches the app's error handler (Express 5). */
export function boardRoutes(prisma: PrismaClient): Router {
  const router = Router();

  /** GET /api/boards — 200 → BoardSummary[], the boards the user is a member of, oldest first */
  router.get('/boards', async (_req, res) => {
    const body: BoardSummary[] = await listBoards(prisma, signedInUser(res).id);
    res.json(body);
  });

  /** GET /api/boards/:boardId — 200 → Board · 404 → ApiError */
  router.get('/boards/:boardId', async (req, res) => {
    const body: Board | null = await findBoard(prisma, signedInUser(res).id, req.params.boardId);
    if (body === null) {
      sendError(res, 404, `No board with id ${req.params.boardId}`);
      return;
    }
    res.json(body);
  });

  return router;
}
