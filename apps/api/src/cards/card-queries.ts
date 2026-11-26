// Card reads and writes, shaped as the @flowboard/shared types.
import type { Card, CreateCardRequest, MoveCardRequest, UpdateCardRequest } from '@flowboard/shared';
import { cardOf, memberOf } from '../boards/access.ts';
import type { PrismaClient } from '../db/client.ts';
import { HttpError } from '../errors.ts';
import type { Prisma } from '../generated/prisma/client.ts';

export const labelFields = { id: true, name: true, color: true } as const;
export const memberFields = { id: true, name: true, color: true } as const;

/** What a Card needs, for every query that returns cards. */
export const cardFields = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  labels: { orderBy: { position: 'asc' }, select: labelFields },
  assignees: { orderBy: { name: 'asc' }, select: memberFields },
  _count: { select: { comments: true } },
} satisfies Prisma.CardSelect;

type CardRow = Prisma.CardGetPayload<{ select: typeof cardFields }>;

export function toCard({ dueDate, _count, ...card }: CardRow): Card {
  return {
    ...card,
    // A date column comes back as midnight UTC, so the UTC date is the stored day.
    dueDate: dueDate === null ? null : dueDate.toISOString().slice(0, 10),
    commentCount: _count.comments,
  };
}

/** The new card, at the bottom of the column, or null when there is no column with that id on a board of `userId`'s. */
export function createCard(prisma: PrismaClient, userId: string, columnId: string, request: CreateCardRequest): Promise<Card | null> {
  return prisma.$transaction(async (tx) => {
    const column = await tx.column.findFirst({ where: { id: columnId, board: memberOf(userId) }, select: { id: true } });
    if (column === null) return null;

    // Two cards created at the same moment may share a position; reordering will renumber them.
    const { _max } = await tx.card.aggregate({ where: { columnId }, _max: { position: true } });
    const card = await tx.card.create({
      data: { columnId, title: request.title, position: (_max.position ?? -1) + 1 },
      select: cardFields,
    });
    return toCard(card);
  });
}

/**
 * The card after the changes, or null when there is no card with that id on a board of `userId`'s. Labels and
 * assignees must belong to the card's board: an id from another board, or from none, is an HttpError 400.
 */
export function updateCard(prisma: PrismaClient, userId: string, cardId: string, changes: UpdateCardRequest): Promise<Card | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.card.findFirst({ where: cardOf(userId, cardId), select: { column: { select: { boardId: true } } } });
    if (existing === null) return null;
    const { boardId } = existing.column;

    if (changes.labelIds !== undefined) {
      const found = await tx.label.findMany({ where: { boardId, id: { in: changes.labelIds } }, select: { id: true } });
      rejectUnknownIds('labelIds', 'label', changes.labelIds, found);
    }
    if (changes.assigneeIds !== undefined) {
      const found = await tx.member.findMany({ where: { boardId, id: { in: changes.assigneeIds } }, select: { id: true } });
      rejectUnknownIds('assigneeIds', 'member', changes.assigneeIds, found);
    }

    const card = await tx.card.update({
      where: { id: cardId },
      data: {
        title: changes.title,
        description: changes.description,
        // Stored as midnight UTC, which the date column keeps as the calendar day.
        dueDate: changes.dueDate === undefined ? undefined : changes.dueDate === null ? null : new Date(`${changes.dueDate}T00:00:00Z`),
        labels: changes.labelIds === undefined ? undefined : { set: changes.labelIds.map((id) => ({ id })) },
        assignees: changes.assigneeIds === undefined ? undefined : { set: changes.assigneeIds.map((id) => ({ id })) },
      },
      select: cardFields,
    });
    return toCard(card);
  });
}

function rejectUnknownIds(field: string, noun: string, requested: string[], found: { id: string }[]): void {
  const known = new Set(found.map(({ id }) => id));
  const unknown = requested.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new HttpError(400, `${field}: no ${noun} with id ${unknown.join(', ')} on this card's board`);
  }
}

/**
 * Moves the card to `index` among the cards of `columnId`, and renumbers the columns it leaves and enters
 * from 0, which also closes gaps and ties. The id of the card's board, or null when there is no card with
 * that id on a board of `userId`'s; a column that is not on the card's board is an HttpError 400.
 */
export function moveCard(prisma: PrismaClient, userId: string, cardId: string, { columnId, index }: MoveCardRequest): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const card = await tx.card.findFirst({ where: cardOf(userId, cardId), select: { columnId: true, column: { select: { boardId: true } } } });
    if (card === null) return null;
    const { boardId } = card.column;
    const target = await tx.column.findFirst({ where: { id: columnId, boardId }, select: { id: true } });
    if (target === null) throw new HttpError(400, `columnId: no column with id ${columnId} on this card's board`);

    // Moves touching the same columns wait for each other, locking in id order so two never deadlock.
    const columnIds = [...new Set([card.columnId, columnId])].sort();
    await tx.$queryRaw`SELECT id FROM "Column" WHERE id = ANY(${columnIds}) ORDER BY id FOR UPDATE`;

    const cardIdsIn = async (id: string) =>
      (await tx.card.findMany({ where: { columnId: id }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true } })).map(
        (row) => row.id,
      );
    const left = (await cardIdsIn(card.columnId)).filter((id) => id !== cardId);
    const entered = columnId === card.columnId ? left : await cardIdsIn(columnId);
    entered.splice(Math.min(index, entered.length), 0, cardId);

    if (columnId !== card.columnId) await placeCards(tx, card.columnId, left);
    await placeCards(tx, columnId, entered);
    return boardId;
  });
}

type Transaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// One statement per column: each card gets the column and its index in `cardIds` as its position.
async function placeCards(tx: Transaction, columnId: string, cardIds: string[]): Promise<void> {
  if (cardIds.length === 0) return;
  await tx.$executeRaw`
    UPDATE "Card" AS card SET "columnId" = ${columnId}, "position" = (placed.ordinality - 1)::int
    FROM unnest(${cardIds}::text[]) WITH ORDINALITY AS placed(id, ordinality)
    WHERE card.id = placed.id`;
}

/** Deletes the card and its comments; false when there is no card with that id on a board of `userId`'s. */
export async function deleteCard(prisma: PrismaClient, userId: string, cardId: string): Promise<boolean> {
  const { count } = await prisma.card.deleteMany({ where: cardOf(userId, cardId) });
  return count > 0;
}
