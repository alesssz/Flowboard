// Invitations: single-use links to join a board with a role, as the API returns them.
import type { MemberRole } from './roles.ts';

/** A pending invitation, as the board's owners list it. Its link is not here: only its creator ever sees it. */
export interface Invitation {
  id: string;
  /** The role it gives. */
  role: MemberRole;
  /** The name of the owner who made it. */
  invitedBy: string;
  /** ISO 8601 instants in UTC. */
  createdAt: string;
  expiresAt: string;
}

/** The answer to creating one: the invitation, and the token its link carries, given this once. */
export interface CreatedInvitation {
  invitation: Invitation;
  token: string;
}

/** What the person holding a link sees before joining. */
export interface InvitationPreview {
  boardId: string;
  boardTitle: string;
  role: MemberRole;
  invitedBy: string;
  expiresAt: string;
  /** The user is a member already: joining would change nothing, and the invitation stays unused. */
  alreadyMember: boolean;
}
