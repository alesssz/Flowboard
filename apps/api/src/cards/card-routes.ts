// Card routes: create in a column, change, move, delete.
import type { Board, Card } from '@flowboard/shared';
import { createCardRequestSchema, moveCardRequestSchema, updateCardRequestSchema } from '@flowboard/shared/schemas';
import { Router } from 'express';
import { signedInUser } from '../auth/require-session.ts';
import { findBoard } from '../boards/board-queries.ts';
import type { PrismaClient } from '../db/client.ts';
import { sendError } from '../errors.ts';
import { parseBody } from '../validation.ts';
import { createCard, deleteCard, moveCard, updateCard } from './card-queries.ts';

/** Mounted under /api. A rejected handler reaches the app's error handler (Express 5). */
export function cardRoutes(prisma: PrismaClient): Router {
  const router = Router();

  /** POST /api/columns/:columnId/cards — CreateCardRequest → 201 Card · 400 · 404 */
  router.post('/columns/:columnId/cards', async (req, res) => {
    const request = parseBody(createCardRequestSchema, req.body);
    const body: Card | null = await createCard(prisma, signedInUser(res).id, req.params.columnId, request);
    if (body === null) {
      sendError(res, 404, `No column with id ${req.params.columnId}`);
      return;
    }
    res.status(201).json(body);
  });

  /** PATCH /api/cards/:cardId — UpdateCardRequest → 200 Card · 400 · 404 */
  router.patch('/cards/:cardId', async (req, res) => {
    const changes = parseBody(updateCardRequestSchema, req.body);
    const body: Card | null = await updateCard(prisma, signedInUser(res).id, req.params.cardId, changes);
    if (body === null) {
      sendError(res, 404, `No card with id ${req.params.cardId}`);
      return;
    }
    res.json(body);
  });

  /** POST /api/cards/:cardId/move — MoveCardRequest → 200 Board, as it now is · 400 · 404 */
  router.post('/cards/:cardId/move', async (req, res) => {
    const request = parseBody(moveCardRequestSchema, req.body);
    const userId = signedInUser(res).id;
    const boardId = await moveCard(prisma, userId, req.params.cardId, request);
    const body: Board | null = boardId === null ? null : await findBoard(prisma, userId, boardId);
    if (body === null) {
      sendError(res, 404, `No card with id ${req.params.cardId}`);
      return;
    }
    res.json(body);
  });

  /** DELETE /api/cards/:cardId — 204, with its comments · 404 */
  router.delete('/cards/:cardId', async (req, res) => {
    if (!(await deleteCard(prisma, signedInUser(res).id, req.params.cardId))) {
      sendError(res, 404, `No card with id ${req.params.cardId}`);
      return;
    }
    res.status(204).end();
  });

  return router;
}
