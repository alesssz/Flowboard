// Who may reach a board: its members. Every board, column, card, comment and label query filters on memberOf.
import type { Prisma } from '../generated/prisma/client.ts';

/**
 * The boards `userId` is a member of. Filtered in the query that reads or writes, so nothing changes between
 * the check and the write, and another user's board answers as if it did not exist (404).
 */
export function memberOf(userId: string) {
  return { members: { some: { userId } } } satisfies Prisma.BoardWhereInput;
}

/** The card with this id, if it is on a board `userId` is a member of. */
export function cardOf(userId: string, cardId: string) {
  return { id: cardId, column: { board: memberOf(userId) } } satisfies Prisma.CardWhereInput;
}

/** The comment with this id, if it is on a board `userId` is a member of, whoever wrote it. */
export function commentOf(userId: string, commentId: string) {
  return { id: commentId, card: { column: { board: memberOf(userId) } } } satisfies Prisma.CommentWhereInput;
}
