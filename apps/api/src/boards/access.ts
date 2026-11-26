// Who may reach a board: its members. Every board, column and card query filters on memberOf.
import type { Prisma } from '../generated/prisma/client.ts';

/**
 * The boards `userId` is a member of. Filtered in the query that reads or writes, so nothing changes between
 * the check and the write, and another user's board answers as if it did not exist (404).
 */
export function memberOf(userId: string) {
  return { members: { some: { userId } } } satisfies Prisma.BoardWhereInput;
}
