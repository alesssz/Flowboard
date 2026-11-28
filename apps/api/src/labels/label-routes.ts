// Label routes: create on a board, rename or recolour, delete.
import type { Label } from '@flowboard/shared';
import { createLabelRequestSchema, updateLabelRequestSchema } from '@flowboard/shared/schemas';
import { Router } from 'express';
import { signedInUser } from '../auth/require-session.ts';
import type { PrismaClient } from '../db/client.ts';
import { sendError } from '../errors.ts';
import { parseBody } from '../validation.ts';
import { boardOfLabel } from '../live/board-of.ts';
import { type Live, writerOf } from '../live/live.ts';
import { createLabel, deleteLabel, updateLabel } from './label-queries.ts';

/** Mounted under /api. A rejected handler reaches the app's error handler (Express 5). */
export function labelRoutes(prisma: PrismaClient, live: Live): Router {
  const router = Router();

  /** POST /api/boards/:boardId/labels — CreateLabelRequest → 201 Label · 400 · 404 · 409, name taken */
  router.post('/boards/:boardId/labels', async (req, res) => {
    const request = parseBody(createLabelRequestSchema, req.body);
    const body: Label | null = await createLabel(prisma, signedInUser(res).id, req.params.boardId, request);
    if (body === null) {
      sendError(res, 404, `No board with id ${req.params.boardId}`);
      return;
    }
    live.boardChanged(req.params.boardId, writerOf(req, res));
    res.status(201).json(body);
  });

  /** PATCH /api/labels/:labelId — UpdateLabelRequest → 200 Label · 400 · 404 · 409, name taken */
  router.patch('/labels/:labelId', async (req, res) => {
    const changes = parseBody(updateLabelRequestSchema, req.body);
    const boardId = await boardOfLabel(prisma, req.params.labelId);
    const body: Label | null = await updateLabel(prisma, signedInUser(res).id, req.params.labelId, changes);
    if (body === null) {
      sendError(res, 404, `No label with id ${req.params.labelId}`);
      return;
    }
    live.boardChanged(boardId, writerOf(req, res));
    res.json(body);
  });

  /** DELETE /api/labels/:labelId — 204, the label gone from every card · 404 */
  router.delete('/labels/:labelId', async (req, res) => {
    const boardId = await boardOfLabel(prisma, req.params.labelId);
    if (!(await deleteLabel(prisma, signedInUser(res).id, req.params.labelId))) {
      sendError(res, 404, `No label with id ${req.params.labelId}`);
      return;
    }
    live.boardChanged(boardId, writerOf(req, res));
    res.status(204).end();
  });

  return router;
}
