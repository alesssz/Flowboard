// Board routes: the user's boards; one board with its columns, cards, labels and members; create, rename, delete.
import type { Board, BoardSummary } from '@flowboard/shared';
import { createBoardRequestSchema, updateBoardRequestSchema } from '@flowboard/shared/schemas';
import { Router } from 'express';
import { signedInUser } from '../auth/require-session.ts';
import type { PrismaClient } from '../db/client.ts';
import { sendError } from '../errors.ts';
import { parseBody } from '../validation.ts';
import { type Live, writerOf } from '../live/live.ts';
import { createBoard, deleteBoard, findBoard, listBoards, updateBoard } from './board-queries.ts';

/** Mounted under /api. A rejected handler reaches the app's error handler (Express 5). */
export function boardRoutes(prisma: PrismaClient, live: Live): Router {
  const router = Router();

  /** GET /api/boards — 200 → BoardSummary[], the boards the user is a member of, oldest first */
  router.get('/boards', async (_req, res) => {
    const body: BoardSummary[] = await listBoards(prisma, signedInUser(res).id);
    res.json(body);
  });

  /** POST /api/boards — CreateBoardRequest → 201 Board, the user its member, with the starter columns · 400 */
  router.post('/boards', async (req, res) => {
    const request = parseBody(createBoardRequestSchema, req.body);
    const body: Board = await createBoard(prisma, signedInUser(res), request);
    res.status(201).json(body);
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

  /** PATCH /api/boards/:boardId — UpdateBoardRequest → 200 BoardSummary · 400 · 404 */
  router.patch('/boards/:boardId', async (req, res) => {
    const request = parseBody(updateBoardRequestSchema, req.body);
    const body: BoardSummary | null = await updateBoard(prisma, signedInUser(res).id, req.params.boardId, request);
    if (body === null) {
      sendError(res, 404, `No board with id ${req.params.boardId}`);
      return;
    }
    live.boardChanged(req.params.boardId, writerOf(req, res));
    res.json(body);
  });

  /** DELETE /api/boards/:boardId — 204, with its columns, cards, comments, labels and members · 404 */
  router.delete('/boards/:boardId', async (req, res) => {
    if (!(await deleteBoard(prisma, signedInUser(res).id, req.params.boardId))) {
      sendError(res, 404, `No board with id ${req.params.boardId}`);
      return;
    }
    live.boardDeleted(req.params.boardId, writerOf(req, res));
    res.status(204).end();
  });

  return router;
}
