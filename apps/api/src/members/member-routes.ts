// Member routes: a board's members with an account; change a role; remove a member, or leave the board.
import type { BoardMember } from '@flowboard/shared';
import { updateMemberRequestSchema } from '@flowboard/shared/schemas';
import { Router } from 'express';
import { signedInUser } from '../auth/require-session.ts';
import type { PrismaClient } from '../db/client.ts';
import { sendError } from '../errors.ts';
import { parseBody } from '../validation.ts';
import { placeOfMember } from '../live/board-of.ts';
import { type Live, writerOf } from '../live/live.ts';
import { listMembers, removeMember, updateMember } from './member-queries.ts';

/** Mounted under /api. A rejected handler reaches the app's error handler (Express 5). */
export function memberRoutes(prisma: PrismaClient, live: Live): Router {
  const router = Router();

  /** GET /api/boards/:boardId/members — 200 → BoardMember[], by name · 404 */
  router.get('/boards/:boardId/members', async (req, res) => {
    const body: BoardMember[] | null = await listMembers(prisma, signedInUser(res).id, req.params.boardId);
    if (body === null) {
      sendError(res, 404, `No board with id ${req.params.boardId}`);
      return;
    }
    res.json(body);
  });

  /** PATCH /api/members/:memberId — UpdateMemberRequest → 200 BoardMember · 400 · 403, not an owner · 404 · 409, last owner */
  router.patch('/members/:memberId', async (req, res) => {
    const request = parseBody(updateMemberRequestSchema, req.body);
    const place = await placeOfMember(prisma, req.params.memberId);
    const body: BoardMember | null = await updateMember(prisma, signedInUser(res).id, req.params.memberId, request);
    if (body === null) {
      sendError(res, 404, `No member with id ${req.params.memberId}`);
      return;
    }
    // The member whose role changed reads the board again, and with it what the role lets them do.
    live.boardChanged(place?.boardId ?? null, writerOf(req, res));
    res.json(body);
  });

  /** DELETE /api/members/:memberId — 204, removed or left · 403, someone else's and not an owner · 404 · 409, last owner */
  router.delete('/members/:memberId', async (req, res) => {
    const place = await placeOfMember(prisma, req.params.memberId);
    if (!(await removeMember(prisma, signedInUser(res).id, req.params.memberId)) || place === null) {
      sendError(res, 404, `No member with id ${req.params.memberId}`);
      return;
    }
    // Told first, so the removed member's tab reads the board, finds it gone and says so; then it follows nothing.
    live.boardChanged(place.boardId, writerOf(req, res));
    if (place.userId !== null) live.boardLeft(place.boardId, place.userId);
    res.status(204).end();
  });

  return router;
}
