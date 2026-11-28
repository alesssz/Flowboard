// Invitation routes: an owner makes, lists and revokes a board's invitations; the person holding a link sees
// what it invites them to, and accepts it. Tokens travel in request bodies, never in URLs.
import type { BoardSummary, CreatedInvitation, Invitation, InvitationPreview } from '@flowboard/shared';
import { createInvitationRequestSchema, invitationTokenRequestSchema } from '@flowboard/shared/schemas';
import { Router } from 'express';
import { signedInUser } from '../auth/require-session.ts';
import type { PrismaClient } from '../db/client.ts';
import { sendError } from '../errors.ts';
import { parseBody } from '../validation.ts';
import { type Live, writerOf } from '../live/live.ts';
import { acceptInvitation, createInvitation, listInvitations, previewInvitation, revokeInvitation } from './invitation-queries.ts';

/** One message for a token used, revoked, expired or unknown: the holder learns nothing more from it. */
const notValid = 'This invitation is not valid: it was used or revoked, or it expired';

/** Mounted under /api. A rejected handler reaches the app's error handler (Express 5). */
export function invitationRoutes(prisma: PrismaClient, live: Live): Router {
  const router = Router();

  /** POST /api/boards/:boardId/invitations — CreateInvitationRequest → 201 CreatedInvitation · 400 · 403, not an owner · 404 */
  router.post('/boards/:boardId/invitations', async (req, res) => {
    const request = parseBody(createInvitationRequestSchema, req.body);
    const body: CreatedInvitation | null = await createInvitation(prisma, signedInUser(res).id, req.params.boardId, request);
    if (body === null) {
      sendError(res, 404, `No board with id ${req.params.boardId}`);
      return;
    }
    res.status(201).json(body);
  });

  /** GET /api/boards/:boardId/invitations — 200 → Invitation[], newest first · 403, not an owner · 404 */
  router.get('/boards/:boardId/invitations', async (req, res) => {
    const body: Invitation[] | null = await listInvitations(prisma, signedInUser(res).id, req.params.boardId);
    if (body === null) {
      sendError(res, 404, `No board with id ${req.params.boardId}`);
      return;
    }
    res.json(body);
  });

  /** DELETE /api/invitations/:invitationId — 204 · 403, not an owner · 404 */
  router.delete('/invitations/:invitationId', async (req, res) => {
    if (!(await revokeInvitation(prisma, signedInUser(res).id, req.params.invitationId))) {
      sendError(res, 404, `No invitation with id ${req.params.invitationId}`);
      return;
    }
    res.status(204).end();
  });

  /** POST /api/invitations/preview — InvitationTokenRequest → 200 InvitationPreview · 400 · 404 */
  router.post('/invitations/preview', async (req, res) => {
    const { token } = parseBody(invitationTokenRequestSchema, req.body);
    const body: InvitationPreview | null = await previewInvitation(prisma, signedInUser(res).id, token);
    if (body === null) {
      sendError(res, 404, notValid);
      return;
    }
    res.json(body);
  });

  /** POST /api/invitations/accept — InvitationTokenRequest → 200 BoardSummary, joined · 400 · 404 · 409, a member already */
  router.post('/invitations/accept', async (req, res) => {
    const { token } = parseBody(invitationTokenRequestSchema, req.body);
    const body: BoardSummary | null = await acceptInvitation(prisma, signedInUser(res), token);
    if (body === null) {
      sendError(res, 404, notValid);
      return;
    }
    // A new member: a new name to assign cards to, and a new row in the members list.
    live.boardChanged(body.id, writerOf(req, res));
    res.json(body);
  });

  return router;
}
