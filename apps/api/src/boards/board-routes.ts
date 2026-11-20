// Board routes, read-only: the board list, one board with its columns and cards, a card's comments.
import type { Board, BoardSummary, CardComment } from '@flowboard/shared';
import { Router } from 'express';
import type { PrismaClient } from '../db/client.ts';
import { sendError } from '../errors.ts';
import { findBoard, findCardComments, listBoards } from './board-queries.ts';

/** Mounted under /api. A rejected handler reaches the app's error handler (Express 5). */
export function boardRoutes(prisma: PrismaClient): Router {
  const router = Router();

  /** GET /api/boards — 200 → BoardSummary[], oldest first */
  router.get('/boards', async (_req, res) => {
    const body: BoardSummary[] = await listBoards(prisma);
    res.json(body);
  });

  /** GET /api/boards/:boardId — 200 → Board · 404 → ApiError */
  router.get('/boards/:boardId', async (req, res) => {
    const body: Board | null = await findBoard(prisma, req.params.boardId);
    if (body === null) {
      sendError(res, 404, `No board with id ${req.params.boardId}`);
      return;
    }
    res.json(body);
  });

  /** GET /api/cards/:cardId/comments — 200 → CardComment[], oldest first · 404 → ApiError */
  router.get('/cards/:cardId/comments', async (req, res) => {
    const body: CardComment[] | null = await findCardComments(prisma, req.params.cardId);
    if (body === null) {
      sendError(res, 404, `No card with id ${req.params.cardId}`);
      return;
    }
    res.json(body);
  });

  return router;
}
