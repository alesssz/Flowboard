// Column writes: create on a board, rename or recolour, delete with its cards.
import { describe, expect, it } from 'vitest';
import { createBoard } from './fixtures.ts';
import { useTestApp } from './test-app.ts';

const { api, prisma } = useTestApp();

describe('POST /api/boards/:boardId/columns', () => {
  it('adds a trimmed column after the last one, with no cards', async () => {
    const { board, columns } = await createBoard(prisma);

    const response = await api.post(`/api/boards/${board.id}/columns`).send({ title: '  Review  ', color: 'blue' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: expect.any(String), title: 'Review', color: 'blue', cards: [] });
    const after = await api.get(`/api/boards/${board.id}`);
    expect(after.body.columns.map((column: { id: string }) => column.id)).toEqual([
      columns.todo.id,
      columns.done.id,
      response.body.id,
    ]);
  });

  it.each([
    [{ title: '   ', color: 'blue' }, 'title: must not be empty'],
    [{ title: 'x'.repeat(101), color: 'blue' }, 'title: Too big: expected string to have <=100 characters'],
    [{ title: 'Review' }, expect.stringMatching(/^color: /)],
    [{ title: 'Review', color: 'pink' }, expect.stringMatching(/^color: /)],
    [{ title: 'Review', color: 'blue', position: 0 }, 'Unrecognized key: "position"'],
  ])('refuses %j with a 400 naming the field', async (body, message) => {
    const { board } = await createBoard(prisma);

    const response = await api.post(`/api/boards/${board.id}/columns`).send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Bad Request', message });
  });

  it('answers 404 for a board that does not exist', async () => {
    const response = await api.post('/api/boards/missing/columns').send({ title: 'Review', color: 'blue' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No board with id missing');
  });
});

describe('PATCH /api/columns/:columnId', () => {
  it('renames and recolours the column, answering with it and its cards', async () => {
    const { columns, cards } = await createBoard(prisma);

    const response = await api.patch(`/api/columns/${columns.todo.id}`).send({ title: ' Next ', color: 'coral' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: columns.todo.id, title: 'Next', color: 'coral' });
    expect(response.body.cards.map((card: { id: string }) => card.id)).toEqual([cards.first.id, cards.second.id]);
  });

  it('changes only the fields given', async () => {
    const { columns } = await createBoard(prisma);

    const response = await api.patch(`/api/columns/${columns.todo.id}`).send({ color: 'red' });

    expect(response.body).toMatchObject({ title: 'To do', color: 'red' });
  });

  it('refuses a request that changes nothing', async () => {
    const { columns } = await createBoard(prisma);

    const response = await api.patch(`/api/columns/${columns.todo.id}`).send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('must change at least one field');
  });

  it('answers 404 for a column that does not exist', async () => {
    const response = await api.patch('/api/columns/missing').send({ title: 'Next' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No column with id missing');
  });
});

describe('DELETE /api/columns/:columnId', () => {
  it('deletes the column with its cards and their comments, answering 204 with no body', async () => {
    const { columns, cards } = await createBoard(prisma);

    const response = await api.delete(`/api/columns/${columns.todo.id}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(await prisma.column.count({ where: { id: columns.todo.id } })).toBe(0);
    expect(await prisma.card.count({ where: { id: { in: [cards.first.id, cards.second.id] } } })).toBe(0);
    expect(await prisma.comment.count()).toBe(0);
  });

  it('answers 404 once the column is gone', async () => {
    const { columns } = await createBoard(prisma);
    await api.delete(`/api/columns/${columns.done.id}`);

    const response = await api.delete(`/api/columns/${columns.done.id}`);

    expect(response.status).toBe(404);
  });
});
