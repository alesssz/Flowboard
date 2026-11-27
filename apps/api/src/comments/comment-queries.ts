// Comment reads and writes, shaped as the @flowboard/shared types. Any member writes; only the author edits or deletes.
import type { CardComment, CreateCommentRequest, UpdateCommentRequest } from '@flowboard/shared';
import { cardOf, commentOf, memberOf } from '../boards/access.ts';
import { memberFields } from '../cards/card-queries.ts';
import type { PrismaClient } from '../db/client.ts';
import { HttpError } from '../errors.ts';
import type { Prisma } from '../generated/prisma/client.ts';

const commentFields = {
  id: true,
  body: true,
  createdAt: true,
  editedAt: true,
  // The author's account, to tell `mine`; not sent.
  author: { select: { ...memberFields, userId: true } },
} satisfies Prisma.CommentSelect;

type CommentRow = Prisma.CommentGetPayload<{ select: typeof commentFields }>;

function toComment({ author: { userId: authorUserId, ...author }, createdAt, editedAt, ...comment }: CommentRow, userId: string): CardComment {
  return {
    ...comment,
    author,
    createdAt: createdAt.toISOString(),
    editedAt: editedAt === null ? null : editedAt.toISOString(),
    mine: authorUserId === userId,
  };
}

/** The card's comments, oldest first, or null when there is no card with that id on a board of `userId`'s. */
export async function findCardComments(prisma: PrismaClient, userId: string, cardId: string): Promise<CardComment[] | null> {
  const card = await prisma.card.findFirst({
    where: cardOf(cardId, memberOf(userId)),
    select: { comments: { orderBy: { createdAt: 'asc' }, select: commentFields } },
  });
  if (card === null) return null;

  return card.comments.map((comment) => toComment(comment, userId));
}

/** The new comment, by `userId`'s member on the card's board, or null when there is no card with that id on a board of theirs. */
export function createComment(
  prisma: PrismaClient,
  userId: string,
  cardId: string,
  { body }: CreateCommentRequest,
): Promise<CardComment | null> {
  return prisma.$transaction(async (tx) => {
    // Any member comments, viewers too.
    const card = await tx.card.findFirst({ where: cardOf(cardId, memberOf(userId)), select: { column: { select: { boardId: true } } } });
    if (card === null) return null;
    // There is one: memberOf found the board through it.
    const author = await tx.member.findUniqueOrThrow({
      where: { boardId_userId: { boardId: card.column.boardId, userId } },
      select: { id: true },
    });

    const comment = await tx.comment.create({ data: { cardId, authorId: author.id, body }, select: commentFields });
    return toComment(comment, userId);
  });
}

/**
 * The comment with its new body, or null when there is no comment with that id on a board of `userId`'s.
 * Someone else's comment is an HttpError 403: the user can see it, so there is nothing to hide.
 */
export function updateComment(
  prisma: PrismaClient,
  userId: string,
  commentId: string,
  { body }: UpdateCommentRequest,
): Promise<CardComment | null> {
  return prisma.$transaction(async (tx) => {
    if (!(await checkAuthor(tx, userId, commentId))) return null;

    const comment = await tx.comment.update({ where: { id: commentId }, data: { body, editedAt: new Date() }, select: commentFields });
    return toComment(comment, userId);
  });
}

/** Deletes the comment; false when there is no comment with that id on a board of `userId`'s, 403 as updateComment. */
export function deleteComment(prisma: PrismaClient, userId: string, commentId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    if (!(await checkAuthor(tx, userId, commentId))) return false;

    await tx.comment.delete({ where: { id: commentId } });
    return true;
  });
}

type Transaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// False when the user cannot see the comment; an HttpError 403 when they can but did not write it.
async function checkAuthor(tx: Transaction, userId: string, commentId: string): Promise<boolean> {
  const comment = await tx.comment.findFirst({
    where: commentOf(commentId, memberOf(userId)),
    select: { author: { select: { userId: true } } },
  });
  if (comment === null) return false;
  if (comment.author.userId !== userId) throw new HttpError(403, 'Only its author can change or delete a comment');
  return true;
}
