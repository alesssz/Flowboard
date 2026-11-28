// Column routes: create on a board, rename or recolour, move, delete.
import type { Board, Column } from '@flowboard/shared';
import { createColumnRequestSchema, moveColumnRequestSchema, updateColumnRequestSchema } from '@flowboard/shared/schemas';
import { Router } from 'express';
import { signedInUser } from '../auth/require-session.ts';
import { findBoard } from '../boards/board-queries.ts';
import type { PrismaClient } from '../db/client.ts';
import { sendError } from '../errors.ts';
import { parseBody } from '../validation.ts';
import { boardOfColumn } from '../live/board-of.ts';
import { type Live, writerOf } from '../live/live.ts';
import { createColumn, deleteColumn, moveColumn, updateColumn } from './column-queries.ts';

/** Mounted under /api. A rejected handler reaches the app's error handler (Express 5). */
export function columnRoutes(prisma: PrismaClient, live: Live): Router {
  const router = Router();

  /** POST /api/boards/:boardId/columns — CreateColumnRequest → 201 Column · 400 · 404 */
  router.post('/boards/:boardId/columns', async (req, res) => {
    const request = parseBody(createColumnRequestSchema, req.body);
    const body: Column | null = await createColumn(prisma, signedInUser(res).id, req.params.boardId, request);
    if (body === null) {
      sendError(res, 404, `No board with id ${req.params.boardId}`);
      return;
    }
    live.boardChanged(req.params.boardId, writerOf(req, res));
    res.status(201).json(body);
  });

  /** PATCH /api/columns/:columnId — UpdateColumnRequest → 200 Column · 400 · 404 */
  router.patch('/columns/:columnId', async (req, res) => {
    const changes = parseBody(updateColumnRequestSchema, req.body);
    const boardId = await boardOfColumn(prisma, req.params.columnId);
    const body: Column | null = await updateColumn(prisma, signedInUser(res).id, req.params.columnId, changes);
    if (body === null) {
      sendError(res, 404, `No column with id ${req.params.columnId}`);
      return;
    }
    live.boardChanged(boardId, writerOf(req, res));
    res.json(body);
  });

  /** POST /api/columns/:columnId/move — MoveColumnRequest → 200 Board, as it now is · 400 · 404 */
  router.post('/columns/:columnId/move', async (req, res) => {
    const request = parseBody(moveColumnRequestSchema, req.body);
    const userId = signedInUser(res).id;
    const boardId = await moveColumn(prisma, userId, req.params.columnId, request);
    const body: Board | null = boardId === null ? null : await findBoard(prisma, userId, boardId);
    if (body === null) {
      sendError(res, 404, `No column with id ${req.params.columnId}`);
      return;
    }
    live.boardChanged(body.id, writerOf(req, res));
    res.json(body);
  });

  /** DELETE /api/columns/:columnId — 204, with its cards and their comments · 404 */
  router.delete('/columns/:columnId', async (req, res) => {
    const boardId = await boardOfColumn(prisma, req.params.columnId);
    if (!(await deleteColumn(prisma, signedInUser(res).id, req.params.columnId))) {
      sendError(res, 404, `No column with id ${req.params.columnId}`);
      return;
    }
    live.boardChanged(boardId, writerOf(req, res));
    res.status(204).end();
  });

  return router;
}
