// Reads boards and comments from the database, shaped as the @flowboard/shared types.
import type { Board, BoardSummary, CardComment } from '@flowboard/shared';
import type { PrismaClient } from '../db/client.ts';

const memberFields = { id: true, name: true, color: true } as const;

export function listBoards(prisma: PrismaClient): Promise<BoardSummary[]> {
  return prisma.board.findMany({
    select: { id: true, title: true },
    orderBy: { createdAt: 'asc' },
  });
}

/** The board with its columns and cards in display order, or null when there is none with that id. */
export async function findBoard(prisma: PrismaClient, boardId: string): Promise<Board | null> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      title: true,
      columns: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          color: true,
          cards: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              title: true,
              description: true,
              dueDate: true,
              labels: { orderBy: { position: 'asc' }, select: { id: true, name: true, color: true } },
              assignees: { orderBy: { name: 'asc' }, select: memberFields },
              _count: { select: { comments: true } },
            },
          },
        },
      },
    },
  });
  if (board === null) return null;

  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards.map(({ dueDate, _count, ...card }) => ({
        ...card,
        // A date column comes back as midnight UTC, so the UTC date is the stored day.
        dueDate: dueDate === null ? null : dueDate.toISOString().slice(0, 10),
        commentCount: _count.comments,
      })),
    })),
  };
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
