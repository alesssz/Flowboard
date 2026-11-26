// Reads boards from the database, shaped as the @flowboard/shared types.
import type { Board, BoardSummary } from '@flowboard/shared';
import { labelFields, memberFields } from '../cards/card-queries.ts';
import { columnFields, toColumn } from '../columns/column-queries.ts';
import type { PrismaClient } from '../db/client.ts';
import { memberOf } from './access.ts';

/** The boards `userId` is a member of. */
export function listBoards(prisma: PrismaClient, userId: string): Promise<BoardSummary[]> {
  return prisma.board.findMany({
    where: memberOf(userId),
    select: { id: true, title: true },
    orderBy: { createdAt: 'asc' },
  });
}

/** The board with its columns and cards in display order, or null when `userId` is a member of none with that id. */
export async function findBoard(prisma: PrismaClient, userId: string, boardId: string): Promise<Board | null> {
  const board = await prisma.board.findFirst({
    where: { id: boardId, ...memberOf(userId) },
    select: {
      id: true,
      title: true,
      columns: { orderBy: { position: 'asc' }, select: columnFields },
      labels: { orderBy: { position: 'asc' }, select: labelFields },
      members: { orderBy: { name: 'asc' }, select: memberFields },
    },
  });
  if (board === null) return null;

  return { ...board, columns: board.columns.map(toColumn) };
}
