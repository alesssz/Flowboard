// Card reads and writes, shaped as the @flowboard/shared types.
import type { Card, CardComment, CreateCardRequest, UpdateCardRequest } from '@flowboard/shared';
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

/** The new card, at the bottom of the column, or null when there is no column with that id. */
export function createCard(prisma: PrismaClient, columnId: string, request: CreateCardRequest): Promise<Card | null> {
  return prisma.$transaction(async (tx) => {
    const column = await tx.column.findUnique({ where: { id: columnId }, select: { id: true } });
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
 * The card after the changes, or null when there is no card with that id. Labels and assignees
 * must belong to the card's board: an id from another board, or from none, is an HttpError 400.
 */
export function updateCard(prisma: PrismaClient, cardId: string, changes: UpdateCardRequest): Promise<Card | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.card.findUnique({ where: { id: cardId }, select: { column: { select: { boardId: true } } } });
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

/** Deletes the card and its comments; false when there is no card with that id. */
export async function deleteCard(prisma: PrismaClient, cardId: string): Promise<boolean> {
  const { count } = await prisma.card.deleteMany({ where: { id: cardId } });
  return count > 0;
}

/** The card's comments, oldest first, or null when there is no card with that id. */
export async function findCardComments(prisma: PrismaClient, cardId: string): Promise<CardComment[] | null> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: {
      comments: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, body: true, createdAt: true, author: { select: memberFields } },
      },
    },
  });
  if (card === null) return null;

  return card.comments.map((comment) => ({ ...comment, createdAt: comment.createdAt.toISOString() }));
}
