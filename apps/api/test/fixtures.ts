// Test data, written through Prisma. Rows are created out of display order, so the tests see the API sort them.
import type { PrismaClient } from '../src/db/client.ts';

/**
 * A board with two columns (To do with two cards, Done with none), two labels and two members.
 * The first card has a description, a due date, both labels, both members and two comments.
 */
export async function createBoard(prisma: PrismaClient, title = 'Launch') {
  const board = await prisma.board.create({ data: { title } });
  const boardId = board.id;

  const backend = await prisma.label.create({ data: { boardId, name: 'Backend', color: 'blue', position: 1 } });
  const design = await prisma.label.create({ data: { boardId, name: 'Design', color: 'violet', position: 0 } });
  const robin = await prisma.member.create({ data: { boardId, name: 'Robin Park', color: 'green' } });
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
