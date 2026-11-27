// Who may reach a board, and what their role lets them change. Every query filters on these in the query that
// reads or writes, so nothing changes between the check and the write.
import { HttpError } from '../errors.ts';
import type { Prisma } from '../generated/prisma/client.ts';

/** What a viewer gets for a write only editors may make. */
export const editorsOnly = 'A viewer can read this board and comment, not change it';

/**
 * The boards `userId` is a member of, whatever their role: what they may read and comment on. Another user's
 * board answers as if it did not exist (404).
 */
export function memberOf(userId: string) {
  return { members: { some: { userId } } } satisfies Prisma.BoardWhereInput;
}

/** The boards where `userId` may change columns, cards and labels: an owner's or an editor's. */
export function editorOf(userId: string) {
  return { members: { some: { userId, role: { in: ['owner', 'editor'] } } } } satisfies Prisma.BoardWhereInput;
}

/** The boards `userId` owns: their title, their deletion and their members. */
export function ownerOf(userId: string) {
  return { members: { some: { userId, role: 'owner' } } } satisfies Prisma.BoardWhereInput;
}

/** The card with this id, if it is on a board `board` lets through. */
export function cardOf(cardId: string, board: Prisma.BoardWhereInput) {
  return { id: cardId, column: { board } } satisfies Prisma.CardWhereInput;
}

/** The comment with this id, if it is on a board `board` lets through, whoever wrote it. */
export function commentOf(commentId: string, board: Prisma.BoardWhereInput) {
  return { id: commentId, card: { column: { board } } } satisfies Prisma.CommentWhereInput;
}

/**
 * After a write filtered on a role found nothing: an HttpError 403 when `userId` is a member of the board
 * `board` names, so their role refused it (they can see the board, so there is nothing to hide). Otherwise
 * it returns, and the caller answers 404.
 */
export async function refuseByRole(
  db: Prisma.TransactionClient,
  userId: string,
  board: Prisma.BoardWhereInput,
  message: string,
): Promise<void> {
  if ((await db.board.count({ where: { AND: [board, memberOf(userId)] } })) > 0) throw new HttpError(403, message);
}
