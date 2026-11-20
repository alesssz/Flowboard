// Card routes: create in a column, change, delete, and read a card's comments.
import type { Card, CardComment } from '@flowboard/shared';
import { createCardRequestSchema, updateCardRequestSchema } from '@flowboard/shared/schemas';
import { Router } from 'express';
import type { PrismaClient } from '../db/client.ts';
import { sendError } from '../errors.ts';
import { parseBody } from '../validation.ts';
import { createCard, deleteCard, findCardComments, updateCard } from './card-queries.ts';

/** Mounted under /api. A rejected handler reaches the app's error handler (Express 5). */
export function cardRoutes(prisma: PrismaClient): Router {
  const router = Router();

  /** POST /api/columns/:columnId/cards — CreateCardRequest → 201 Card · 400 · 404 */
  router.post('/columns/:columnId/cards', async (req, res) => {
    const request = parseBody(createCardRequestSchema, req.body);
    const body: Card | null = await createCard(prisma, req.params.columnId, request);
    if (body === null) {
      sendError(res, 404, `No column with id ${req.params.columnId}`);
      return;
    }
    res.status(201).json(body);
  });

  /** PATCH /api/cards/:cardId — UpdateCardRequest → 200 Card · 400 · 404 */
  router.patch('/cards/:cardId', async (req, res) => {
    const changes = parseBody(updateCardRequestSchema, req.body);
    const body: Card | null = await updateCard(prisma, req.params.cardId, changes);
    if (body === null) {
      sendError(res, 404, `No card with id ${req.params.cardId}`);
      return;
    }
    res.json(body);
  });

  /** DELETE /api/cards/:cardId — 204, with its comments · 404 */
  router.delete('/cards/:cardId', async (req, res) => {
    if (!(await deleteCard(prisma, req.params.cardId))) {
      sendError(res, 404, `No card with id ${req.params.cardId}`);
      return;
    }
    res.status(204).end();
  });

  /** GET /api/cards/:cardId/comments — 200 → CardComment[], oldest first · 404 */
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
