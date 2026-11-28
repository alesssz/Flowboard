// Bodies of the invitation requests: the Zod schemas the API checks them with, and the types clients send.
import { z } from 'zod';
import { memberRoles } from './roles.ts';

/** POST /api/boards/:boardId/invitations. Only an owner invites. */
export const createInvitationRequestSchema = z.strictObject({
  role: z.enum(memberRoles),
});

/**
 * POST /api/invitations/preview and /api/invitations/accept. The token goes in the body, never in a URL, so
 * no log or Referer header carries it; its length is checked before it is hashed.
 */
export const invitationTokenRequestSchema = z.strictObject({
  token: z.string().min(1).max(100),
});

export type CreateInvitationRequest = z.input<typeof createInvitationRequestSchema>;
export type InvitationTokenRequest = z.input<typeof invitationTokenRequestSchema>;
