// Invitations: single-use links to join a board with a role, made by its owners. The link carries a random
// token; the table keeps only its SHA-256, as for sessions, so a copy of it lets nobody in. Accepting an
// invitation deletes it, and so does revoking it; it expires after INVITATION_LIFETIME_MS.
import { createHash, randomBytes } from 'node:crypto';
import type { BoardSummary, CreatedInvitation, CreateInvitationRequest, Invitation, InvitationPreview, User } from '@flowboard/shared';
import { ownerOf, refuseByRole } from '../boards/access.ts';
import { avatarColor } from '../boards/board-queries.ts';
import type { PrismaClient } from '../db/client.ts';
import { HttpError } from '../errors.ts';
import type { Prisma } from '../generated/prisma/client.ts';

/** Seven days: long enough to be read, short enough that a forgotten link stops working. */
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const ownersOnly = 'Only an owner can invite, or see and revoke invitations';

const invitationFields = {
  id: true,
  role: true,
  createdAt: true,
  expiresAt: true,
  invitedBy: { select: { name: true } },
} satisfies Prisma.InvitationSelect;

type InvitationRow = Prisma.InvitationGetPayload<{ select: typeof invitationFields }>;

function toInvitation({ invitedBy, createdAt, expiresAt, ...invitation }: InvitationRow): Invitation {
  return { ...invitation, invitedBy: invitedBy.name, createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString() };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The invitation the token belongs to, while it has not expired. */
function liveInvitation(token: string) {
  return { tokenHash: hashToken(token), expiresAt: { gt: new Date() } } satisfies Prisma.InvitationWhereInput;
}

/**
 * A new invitation and its token, given this once, or null when `userId` is a member of no board with that
 * id; an HttpError 403 unless they own it. The board's expired invitations go at the same time.
 */
export function createInvitation(
  prisma: PrismaClient,
  userId: string,
  boardId: string,
  { role }: CreateInvitationRequest,
): Promise<CreatedInvitation | null> {
  return prisma.$transaction(async (tx) => {
    const owner = await tx.member.findFirst({ where: { boardId, userId, role: 'owner' }, select: { id: true } });
    if (owner === null) {
      await refuseByRole(tx, userId, { id: boardId }, ownersOnly);
      return null;
    }

    await tx.invitation.deleteMany({ where: { boardId, expiresAt: { lte: new Date() } } });
    const token = randomBytes(32).toString('base64url');
    const invitation = await tx.invitation.create({
      data: { tokenHash: hashToken(token), boardId, role, invitedById: owner.id, expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS) },
      select: invitationFields,
    });
    return { invitation: toInvitation(invitation), token };
  });
}

/** The board's invitations that can still be used, newest first, or null as createInvitation; 403 likewise. */
export async function listInvitations(prisma: PrismaClient, userId: string, boardId: string): Promise<Invitation[] | null> {
  const board = await prisma.board.findFirst({
    where: { id: boardId, ...ownerOf(userId) },
    select: { invitations: { where: { expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, select: invitationFields } },
  });
  if (board === null) {
    await refuseByRole(prisma, userId, { id: boardId }, ownersOnly);
    return null;
  }
  return board.invitations.map(toInvitation);
}

/** Deletes the invitation; false when there is none with that id on a board of `userId`'s, 403 as createInvitation. */
export async function revokeInvitation(prisma: PrismaClient, userId: string, invitationId: string): Promise<boolean> {
  const { count } = await prisma.invitation.deleteMany({ where: { id: invitationId, board: ownerOf(userId) } });
  if (count === 0) await refuseByRole(prisma, userId, { invitations: { some: { id: invitationId } } }, ownersOnly);
  return count > 0;
}

/** What the holder of the token is invited to, or null when it was used or revoked, expired, or never was. */
export async function previewInvitation(prisma: PrismaClient, userId: string, token: string): Promise<InvitationPreview | null> {
  const invitation = await prisma.invitation.findFirst({
    where: liveInvitation(token),
    select: {
      role: true,
      expiresAt: true,
      invitedBy: { select: { name: true } },
      board: { select: { id: true, title: true, members: { where: { userId }, select: { id: true } } } },
    },
  });
  if (invitation === null) return null;

  const { board } = invitation;
  return {
    boardId: board.id,
    boardTitle: board.title,
    role: invitation.role,
    invitedBy: invitation.invitedBy.name,
    expiresAt: invitation.expiresAt.toISOString(),
    alreadyMember: board.members.length > 0,
  };
}

/**
 * Makes `user` a member of the invitation's board, under their name and with its role, and deletes the
 * invitation: the board, or null as previewInvitation. An HttpError 409 when they are a member already, which
 * leaves the invitation unused.
 */
export function acceptInvitation(prisma: PrismaClient, user: User, token: string): Promise<BoardSummary | null> {
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findFirst({
      where: liveInvitation(token),
      select: { id: true, boardId: true, role: true, board: { select: { title: true } } },
    });
    if (invitation === null) return null;
    const { boardId } = invitation;

    // Member writes on a board wait for each other (member-queries.ts), so the check below holds until the commit.
    await tx.$queryRaw`SELECT id FROM "Board" WHERE id = ${boardId} FOR UPDATE`;
    const existing = await tx.member.findUnique({ where: { boardId_userId: { boardId, userId: user.id } }, select: { id: true } });
    if (existing !== null) throw new HttpError(409, 'You are already a member of this board');

    // Deleted before the member is made: of two people accepting the same link at once, the second finds it gone.
    const { count } = await tx.invitation.deleteMany({ where: { id: invitation.id } });
    if (count === 0) return null;
    await tx.member.create({
      data: { boardId, userId: user.id, name: user.name, color: avatarColor(user.id), role: invitation.role },
    });
    return { id: boardId, title: invitation.board.title };
  });
}
