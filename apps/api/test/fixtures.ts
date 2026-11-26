// Test data, written through Prisma. Rows are created out of display order, so the tests see the API sort them.
import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '../src/db/client.ts';

const memberToken = randomBytes(32).toString('base64url');

/** Signs a request in as Robin Park, the account createBoard makes a member of its boards. */
export const memberCookie = `flowboard_session=${memberToken}`;

/** Robin Park's account, with the session memberCookie names; created once per test, as the database is emptied. */
export function createMemberAccount(prisma: PrismaClient) {
  const email = 'robin@example.com';
  return prisma.user.upsert({
    where: { email },
    // No password signs in to it: the tests use the session.
    create: {
      email,
      name: 'Robin Park',
      passwordHash: 'unused',
      sessions: { create: { id: createHash('sha256').update(memberToken).digest('hex'), expiresAt: new Date('2099-01-01') } },
    },
    update: {},
    select: { id: true },
  });
}

/**
 * A board with two columns (To do with two cards, Done with none), two labels and two members.
 * The first card has a description, a due date, both labels, both members and two comments.
 * Its member Robin Park is the account memberCookie signs in, unless `ofAnotherUser`: then no member has an account,
 * and memberCookie cannot reach the board.
 */
export async function createBoard(prisma: PrismaClient, title = 'Launch', { ofAnotherUser = false } = {}) {
  const board = await prisma.board.create({ data: { title } });
  const boardId = board.id;
  const robinUserId = ofAnotherUser ? undefined : (await createMemberAccount(prisma)).id;

  const backend = await prisma.label.create({ data: { boardId, name: 'Backend', color: 'blue', position: 1 } });
  const design = await prisma.label.create({ data: { boardId, name: 'Design', color: 'violet', position: 0 } });
  const robin = await prisma.member.create({ data: { boardId, name: 'Robin Park', color: 'green', userId: robinUserId } });
  const alex = await prisma.member.create({ data: { boardId, name: 'Alex Moreno', color: 'amber' } });

  const done = await prisma.column.create({ data: { boardId, title: 'Done', color: 'green', position: 1 } });
  const todo = await prisma.column.create({ data: { boardId, title: 'To do', color: 'gray', position: 0 } });

  const second = await prisma.card.create({ data: { columnId: todo.id, title: 'Second', position: 1 } });
  const first = await prisma.card.create({
    data: {
      columnId: todo.id,
      title: 'First',
      description: 'Line one\nLine two',
      dueDate: new Date('2026-12-01T00:00:00Z'),
      position: 0,
      labels: { connect: [{ id: backend.id }, { id: design.id }] },
      assignees: { connect: [{ id: robin.id }, { id: alex.id }] },
    },
  });

  const reply = await prisma.comment.create({
    data: { cardId: first.id, authorId: robin.id, body: 'Done on my side', createdAt: new Date('2026-11-20T10:00:00Z') },
  });
  const question = await prisma.comment.create({
    data: { cardId: first.id, authorId: alex.id, body: 'Who takes this?', createdAt: new Date('2026-11-19T09:00:00Z') },
  });

  return {
    board,
    columns: { todo, done },
    cards: { first, second },
    labels: { design, backend },
    members: { alex, robin },
    comments: { question, reply },
  };
}
