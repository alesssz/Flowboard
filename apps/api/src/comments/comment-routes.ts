// Comment routes: a card's comments, write one, and edit or delete one's own.
import type { CardComment } from '@flowboard/shared';
import { createCommentRequestSchema, updateCommentRequestSchema } from '@flowboard/shared/schemas';
import { Router } from 'express';
import { signedInUser } from '../auth/require-session.ts';
import type { PrismaClient } from '../db/client.ts';
import { sendError } from '../errors.ts';
import { parseBody } from '../validation.ts';
import { boardOfCard, placeOfComment } from '../live/board-of.ts';
import { type Live, writerOf } from '../live/live.ts';
import { createComment, deleteComment, findCardComments, updateComment } from './comment-queries.ts';

/** Mounted under /api. A rejected handler reaches the app's error handler (Express 5). */
export function commentRoutes(prisma: PrismaClient, live: Live): Router {
  const router = Router();

  /** GET /api/cards/:cardId/comments — 200 → CardComment[], oldest first · 404 */
  router.get('/cards/:cardId/comments', async (req, res) => {
    const body: CardComment[] | null = await findCardComments(prisma, signedInUser(res).id, req.params.cardId);
    if (body === null) {
      sendError(res, 404, `No card with id ${req.params.cardId}`);
      return;
    }
    res.json(body);
  });

  /** POST /api/cards/:cardId/comments — CreateCommentRequest → 201 CardComment, by the user · 400 · 404 */
  router.post('/cards/:cardId/comments', async (req, res) => {
    const request = parseBody(createCommentRequestSchema, req.body);
    const boardId = await boardOfCard(prisma, req.params.cardId);
    const body: CardComment | null = await createComment(prisma, signedInUser(res).id, req.params.cardId, request);
    if (body === null || boardId === null) {
      sendError(res, 404, `No card with id ${req.params.cardId}`);
      return;
    }
    live.commentsChanged(boardId, req.params.cardId, writerOf(req, res));
    res.status(201).json(body);
  });

  /** PATCH /api/comments/:commentId — UpdateCommentRequest → 200 CardComment · 400 · 403, not its author · 404 */
  router.patch('/comments/:commentId', async (req, res) => {
    const request = parseBody(updateCommentRequestSchema, req.body);
    const place = await placeOfComment(prisma, req.params.commentId);
    const body: CardComment | null = await updateComment(prisma, signedInUser(res).id, req.params.commentId, request);
    if (body === null || place === null) {
      sendError(res, 404, `No comment with id ${req.params.commentId}`);
      return;
    }
    live.commentsChanged(place.boardId, place.cardId, writerOf(req, res));
    res.json(body);
  });

  /** DELETE /api/comments/:commentId — 204 · 403, not its author · 404 */
  router.delete('/comments/:commentId', async (req, res) => {
    const place = await placeOfComment(prisma, req.params.commentId);
    if (!(await deleteComment(prisma, signedInUser(res).id, req.params.commentId)) || place === null) {
      sendError(res, 404, `No comment with id ${req.params.commentId}`);
      return;
    }
    live.commentsChanged(place.boardId, place.cardId, writerOf(req, res));
    res.status(204).end();
  });

  return router;
}
