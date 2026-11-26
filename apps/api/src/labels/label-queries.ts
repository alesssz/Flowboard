// Label writes, shaped as the @flowboard/shared types. Names are unique on a board, whatever their case.
import type { CreateLabelRequest, Label, UpdateLabelRequest } from '@flowboard/shared';
import { memberOf } from '../boards/access.ts';
import { labelFields } from '../cards/card-queries.ts';
import type { PrismaClient } from '../db/client.ts';
import { HttpError } from '../errors.ts';

/** The new label, after the board's last one, or null when `userId` is a member of no board with that id. */
export function createLabel(prisma: PrismaClient, userId: string, boardId: string, { name, color }: CreateLabelRequest): Promise<Label | null> {
  return prisma.$transaction(async (tx) => {
    const board = await tx.board.findFirst({ where: { id: boardId, ...memberOf(userId) }, select: { id: true } });
    if (board === null) return null;
    await checkNameFree(tx, boardId, name);

    const { _max } = await tx.label.aggregate({ where: { boardId }, _max: { position: true } });
    return tx.label.create({ data: { boardId, name, color, position: (_max.position ?? -1) + 1 }, select: labelFields });
  });
}

/** The label after the changes, or null when there is no label with that id on a board of `userId`'s. */
export function updateLabel(prisma: PrismaClient, userId: string, labelId: string, changes: UpdateLabelRequest): Promise<Label | null> {
  return prisma.$transaction(async (tx) => {
    const label = await tx.label.findFirst({ where: { id: labelId, board: memberOf(userId) }, select: { boardId: true } });
    if (label === null) return null;
    if (changes.name !== undefined) await checkNameFree(tx, label.boardId, changes.name, labelId);

    return tx.label.update({ where: { id: labelId }, data: { name: changes.name, color: changes.color }, select: labelFields });
  });
}

/** Deletes the label, which leaves every card that had it; false when there is no label with that id on a board of `userId`'s. */
export async function deleteLabel(prisma: PrismaClient, userId: string, labelId: string): Promise<boolean> {
  const { count } = await prisma.label.deleteMany({ where: { id: labelId, board: memberOf(userId) } });
  return count > 0;
}

type Transaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// An HttpError 409 when another label of the board has this name in any case. Label writes on the same board
// wait for each other on the board's row, so two at once cannot both find the name free.
async function checkNameFree(tx: Transaction, boardId: string, name: string, exceptId?: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Board" WHERE id = ${boardId} FOR UPDATE`;
  const taken = await tx.label.findFirst({
    where: { boardId, name: { equals: name, mode: 'insensitive' }, ...(exceptId === undefined ? {} : { id: { not: exceptId } }) },
    select: { id: true },
  });
  if (taken !== null) throw new HttpError(409, 'name: the board already has a label with this name');
}
