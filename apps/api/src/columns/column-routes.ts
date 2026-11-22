// Column routes: create on a board, rename or recolour, delete.
import type { Column } from '@flowboard/shared';
import { createColumnRequestSchema, updateColumnRequestSchema } from '@flowboard/shared/schemas';
import { Router } from 'express';
import type { PrismaClient } from '../db/client.ts';
import { sendError } from '../errors.ts';
import { parseBody } from '../validation.ts';
import { createColumn, deleteColumn, updateColumn } from './column-queries.ts';

/** Mounted under /api. A rejected handler reaches the app's error handler (Express 5). */
export function columnRoutes(prisma: PrismaClient): Router {
  const router = Router();

  /** POST /api/boards/:boardId/columns — CreateColumnRequest → 201 Column · 400 · 404 */
  router.post('/boards/:boardId/columns', async (req, res) => {
    const request = parseBody(createColumnRequestSchema, req.body);
    const body: Column | null = await createColumn(prisma, req.params.boardId, request);
    if (body === null) {
      sendError(res, 404, `No board with id ${req.params.boardId}`);
      return;
    }
    res.status(201).json(body);
  });

  /** PATCH /api/columns/:columnId — UpdateColumnRequest → 200 Column · 400 · 404 */
  router.patch('/columns/:columnId', async (req, res) => {
    const changes = parseBody(updateColumnRequestSchema, req.body);
    const body: Column | null = await updateColumn(prisma, req.params.columnId, changes);
    if (body === null) {
      sendError(res, 404, `No column with id ${req.params.columnId}`);
      return;
    }
    res.json(body);
  });

  /** DELETE /api/columns/:columnId — 204, with its cards and their comments · 404 */
  router.delete('/columns/:columnId', async (req, res) => {
    if (!(await deleteColumn(prisma, req.params.columnId))) {
      sendError(res, 404, `No column with id ${req.params.columnId}`);
      return;
    }
    res.status(204).end();
  });

  return router;
}
