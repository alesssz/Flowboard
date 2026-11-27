// Board members with an account: the list, a role an owner changes, a member an owner removes or who leaves.
// A board always keeps an owner with an account. Members without one are only names on cards and comments.
import type { BoardMember, UpdateMemberRequest } from '@flowboard/shared';
import { memberOf, ownerOf, refuseByRole } from '../boards/access.ts';
import type { PrismaClient } from '../db/client.ts';
import { HttpError } from '../errors.ts';
import type { Prisma } from '../generated/prisma/client.ts';

const boardMemberFields = { id: true, name: true, color: true, role: true, userId: true } satisfies Prisma.MemberSelect;

type BoardMemberRow = Prisma.MemberGetPayload<{ select: typeof boardMemberFields }>;

function toBoardMember({ userId: memberUserId, ...member }: BoardMemberRow, userId: string): BoardMember {
  return { ...member, you: memberUserId === userId };
}

/** The board's members with an account, by name, or null when `userId` is a member of no board with that id. */
export async function listMembers(prisma: PrismaClient, userId: string, boardId: string): Promise<BoardMember[] | null> {
  const board = await prisma.board.findFirst({
    where: { id: boardId, ...memberOf(userId) },
    select: { members: { where: { userId: { not: null } }, orderBy: { name: 'asc' }, select: boardMemberFields } },
  });
  return board === null ? null : board.members.map((member) => toBoardMember(member, userId));
}

/**
 * The member with their new role, or null when there is no member with an account and that id on a board of
 * `userId`'s. An HttpError 403 unless `userId` owns the board; 409 when it would leave the board without an owner.
 */
export function updateMember(prisma: PrismaClient, userId: string, memberId: string, { role }: UpdateMemberRequest): Promise<BoardMember | null> {
  return prisma.$transaction(async (tx) => {
    await lockBoardOf(tx, memberId);
    const member = await tx.member.findFirst({
      where: { id: memberId, userId: { not: null }, board: ownerOf(userId) },
      select: { boardId: true, role: true },
    });
    if (member === null) {
      await refuseByRole(tx, userId, { members: { some: { id: memberId, userId: { not: null } } } }, 'Only an owner can change a role');
      return null;
    }
    if (member.role === 'owner' && role !== 'owner') await keepAnOwner(tx, member.boardId);

    const updated = await tx.member.update({ where: { id: memberId }, data: { role }, select: boardMemberFields });
    return toBoardMember(updated, userId);
  });
}

/**
 * Takes the member's account off the board: an owner removing someone, or anyone leaving. The member stays,
 * without an account, so their name stays on their comments and cards. False when there is no member with an
 * account and that id on a board of `userId`'s; an HttpError 403 when someone else's and `userId` is not an
 * owner; 409 when it would leave the board without an owner.
 */
export function removeMember(prisma: PrismaClient, userId: string, memberId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await lockBoardOf(tx, memberId);
    const member = await tx.member.findFirst({
      where: { id: memberId, userId: { not: null }, board: memberOf(userId) },
      select: { boardId: true, role: true, userId: true },
    });
    if (member === null) return false;
    if (member.userId !== userId && (await tx.board.count({ where: { id: member.boardId, ...ownerOf(userId) } })) === 0) {
      throw new HttpError(403, 'Only an owner can remove another member');
    }
    if (member.role === 'owner') await keepAnOwner(tx, member.boardId);

    await tx.member.update({ where: { id: memberId }, data: { userId: null } });
    return true;
  });
}

type Transaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// Member writes on the same board wait for each other on its row, taken before anything is read, so two
// owners stepping down at once cannot both count the other as the one left.
async function lockBoardOf(tx: Transaction, memberId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Board" WHERE id = (SELECT "boardId" FROM "Member" WHERE id = ${memberId}) FOR UPDATE`;
}

// Called before an owner stops being one: another owner with an account must stay.
async function keepAnOwner(tx: Transaction, boardId: string): Promise<void> {
  const owners = await tx.member.count({ where: { boardId, role: 'owner', userId: { not: null } } });
  if (owners <= 1) throw new HttpError(409, 'The board must keep an owner: make someone else an owner first');
}
