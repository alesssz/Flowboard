// Board reads and writes, shaped as the @flowboard/shared types.
import {
  type Board,
  type BoardSummary,
  type CreateBoardRequest,
  type PaletteColor,
  paletteColors,
  type UpdateBoardRequest,
  type User,
} from '@flowboard/shared';
import { labelFields, memberFields } from '../cards/card-queries.ts';
import { columnFields, toColumn } from '../columns/column-queries.ts';
import type { PrismaClient } from '../db/client.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { memberOf } from './access.ts';

const boardFields = {
  id: true,
  title: true,
  columns: { orderBy: { position: 'asc' }, select: columnFields },
  labels: { orderBy: { position: 'asc' }, select: labelFields },
  members: { orderBy: { name: 'asc' }, select: memberFields },
} satisfies Prisma.BoardSelect;

type BoardRow = Prisma.BoardGetPayload<{ select: typeof boardFields }>;

function toBoard({ columns, ...board }: BoardRow): Board {
  return { ...board, columns: columns.map(toColumn) };
}

/** The columns a new board starts with, left to right. */
const starterColumns: { title: string; color: PaletteColor }[] = [
  { title: 'To do', color: 'gray' },
  { title: 'In progress', color: 'blue' },
  { title: 'Done', color: 'green' },
];

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
  const board = await prisma.board.findFirst({ where: { id: boardId, ...memberOf(userId) }, select: boardFields });
  return board === null ? null : toBoard(board);
}

/** A new board, with `user` as its member under their name and the starter columns. */
export async function createBoard(prisma: PrismaClient, user: User, { title }: CreateBoardRequest): Promise<Board> {
  const board = await prisma.board.create({
    data: {
      title,
      members: { create: { userId: user.id, name: user.name, color: avatarColor(user.id) } },
      columns: { create: starterColumns.map((column, position) => ({ ...column, position })) },
    },
    select: boardFields,
  });
  return toBoard(board);
}

/** The board with its new title, or null when `userId` is a member of no board with that id. */
export async function updateBoard(
  prisma: PrismaClient,
  userId: string,
  boardId: string,
  { title }: UpdateBoardRequest,
): Promise<BoardSummary | null> {
  const { count } = await prisma.board.updateMany({ where: { id: boardId, ...memberOf(userId) }, data: { title } });
  return count > 0 ? { id: boardId, title } : null;
}

/** Deletes the board with everything on it; false when `userId` is a member of no board with that id. */
export function deleteBoard(prisma: PrismaClient, userId: string, boardId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const board = await tx.board.findFirst({ where: { id: boardId, ...memberOf(userId) }, select: { id: true } });
    if (board === null) return false;

    // Comments first: their authors' NoAction would stop the board's cascade (schema.prisma, Comment).
    await tx.comment.deleteMany({ where: { card: { column: { boardId } } } });
    await tx.board.delete({ where: { id: boardId } });
    return true;
  });
}

// The same colour on every board the user creates; gray, the neutral one, left out.
function avatarColor(userId: string): PaletteColor {
  const colors = paletteColors.filter((color) => color !== 'gray');
  const sum = [...userId].reduce((total, character) => total + character.charCodeAt(0), 0);
  return colors[sum % colors.length] ?? 'blue';
}
