// Board reads: the board list, and one board with its columns, cards, labels and members in display order.
import { describe, expect, it } from 'vitest';
import { createBoard } from './fixtures.ts';
import { useTestApp } from './test-app.ts';

const { api, prisma } = useTestApp();

describe('GET /api/boards', () => {
  it('lists every board, oldest first, without its content', async () => {
    const newer = await prisma.board.create({ data: { title: 'Newer', createdAt: new Date('2026-11-02T00:00:00Z') } });
    const older = await prisma.board.create({ data: { title: 'Older', createdAt: new Date('2026-11-01T00:00:00Z') } });

    const response = await api.get('/api/boards');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: older.id, title: 'Older' },
      { id: newer.id, title: 'Newer' },
    ]);
  });
});

describe('GET /api/boards/:boardId', () => {
  it('returns columns, cards and labels by position, and members by name', async () => {
    const { board, columns, cards, labels, members } = await createBoard(prisma);

    const response = await api.get(`/api/boards/${board.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: board.id, title: 'Launch' });
    expect(response.body.columns.map((column: { id: string }) => column.id)).toEqual([columns.todo.id, columns.done.id]);
    expect(response.body.columns[0].cards.map((card: { id: string }) => card.id)).toEqual([cards.first.id, cards.second.id]);
    expect(response.body.columns[1].cards).toEqual([]);
    expect(response.body.labels).toEqual([
      { id: labels.design.id, name: 'Design', color: 'violet' },
      { id: labels.backend.id, name: 'Backend', color: 'blue' },
    ]);
    expect(response.body.members).toEqual([
      { id: members.alex.id, name: 'Alex Moreno', color: 'amber' },
      { id: members.robin.id, name: 'Robin Park', color: 'green' },
    ]);
  });

  it('gives each card its due day, labels in board order, assignees by name and comment count', async () => {
    const { board, cards, labels, members } = await createBoard(prisma);

    const response = await api.get(`/api/boards/${board.id}`);

    expect(response.body.columns[0].cards[0]).toEqual({
      id: cards.first.id,
      title: 'First',
      description: 'Line one\nLine two',
      dueDate: '2026-12-01',
      labels: [
        { id: labels.design.id, name: 'Design', color: 'violet' },
        { id: labels.backend.id, name: 'Backend', color: 'blue' },
      ],
      assignees: [
        { id: members.alex.id, name: 'Alex Moreno', color: 'amber' },
        { id: members.robin.id, name: 'Robin Park', color: 'green' },
      ],
      commentCount: 2,
    });
    expect(response.body.columns[0].cards[1]).toMatchObject({ description: '', dueDate: null, labels: [], assignees: [], commentCount: 0 });
  });

  it('answers 404 for a board that does not exist', async () => {
    const response = await api.get('/api/boards/missing');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not Found', message: 'No board with id missing' });
  });
});
