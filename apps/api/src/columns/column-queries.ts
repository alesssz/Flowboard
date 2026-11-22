// Column reads and writes, shaped as the @flowboard/shared types.
import type { Column, CreateColumnRequest, UpdateColumnRequest } from '@flowboard/shared';
import { cardFields, toCard } from '../cards/card-queries.ts';
import type { PrismaClient } from '../db/client.ts';
import type { Prisma } from '../generated/prisma/client.ts';

/** What a Column needs, its cards in display order included, for every query that returns columns. */
export const columnFields = {
  id: true,
  title: true,
  color: true,
  cards: { orderBy: { position: 'asc' }, select: cardFields },
} satisfies Prisma.ColumnSelect;

type ColumnRow = Prisma.ColumnGetPayload<{ select: typeof columnFields }>;

export function toColumn({ cards, ...column }: ColumnRow): Column {
  return { ...column, cards: cards.map(toCard) };
}

/** The new column, after the board's last one, or null when there is no board with that id. */
export function createColumn(prisma: PrismaClient, boardId: string, request: CreateColumnRequest): Promise<Column | null> {
  return prisma.$transaction(async (tx) => {
    const board = await tx.board.findUnique({ where: { id: boardId }, select: { id: true } });
    if (board === null) return null;

    // Two columns created at the same moment may share a position; reordering will renumber them.
    const { _max } = await tx.column.aggregate({ where: { boardId }, _max: { position: true } });
    const column = await tx.column.create({
      data: { boardId, title: request.title, color: request.color, position: (_max.position ?? -1) + 1 },
      select: columnFields,
    });
    return toColumn(column);
  });
}

/** The column after the changes, or null when there is no column with that id. */
export function updateColumn(prisma: PrismaClient, columnId: string, changes: UpdateColumnRequest): Promise<Column | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.column.findUnique({ where: { id: columnId }, select: { id: true } });
    if (existing === null) return null;

    const column = await tx.column.update({
      where: { id: columnId },
      data: { title: changes.title, color: changes.color },
      select: columnFields,
    });
    return toColumn(column);
  });
}

/** Deletes the column with its cards and their comments; false when there is no column with that id. */
export async function deleteColumn(prisma: PrismaClient, columnId: string): Promise<boolean> {
  const { count } = await prisma.column.deleteMany({ where: { id: columnId } });
  return count > 0;
}
