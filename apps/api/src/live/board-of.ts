// The board a write touches, for the notice it sends. Read before the write, so a deletion still finds it; it is
// not a permission check, which the write makes itself, and nothing read here is sent anywhere.
import type { PrismaClient } from '../db/client.ts';

export async function boardOfColumn(prisma: PrismaClient, columnId: string): Promise<string | null> {
  return (await prisma.column.findUnique({ where: { id: columnId }, select: { boardId: true } }))?.boardId ?? null;
}

export async function boardOfCard(prisma: PrismaClient, cardId: string): Promise<string | null> {
  return (await prisma.card.findUnique({ where: { id: cardId }, select: { column: { select: { boardId: true } } } }))?.column.boardId ?? null;
}

export async function boardOfLabel(prisma: PrismaClient, labelId: string): Promise<string | null> {
  return (await prisma.label.findUnique({ where: { id: labelId }, select: { boardId: true } }))?.boardId ?? null;
}

/** The comment's board and card. */
export function placeOfComment(prisma: PrismaClient, commentId: string): Promise<{ boardId: string; cardId: string } | null> {
  return prisma.comment
    .findUnique({ where: { id: commentId }, select: { cardId: true, card: { select: { column: { select: { boardId: true } } } } } })
    .then((comment) => (comment === null ? null : { boardId: comment.card.column.boardId, cardId: comment.cardId }));
}

/** The member's board, and the account it stands for. */
export function placeOfMember(prisma: PrismaClient, memberId: string): Promise<{ boardId: string; userId: string | null } | null> {
  return prisma.member.findUnique({ where: { id: memberId }, select: { boardId: true, userId: true } });
}
