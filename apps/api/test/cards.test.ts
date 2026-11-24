// Card writes, and a card's comments: create in a column, change fields, move, delete, read the comments.
import { describe, expect, it } from 'vitest';
import { createBoard } from './fixtures.ts';
import { useTestApp } from './test-app.ts';

const { api, prisma } = useTestApp();

describe('POST /api/columns/:columnId/cards', () => {
  it('adds a trimmed card at the bottom of its column, with nothing else set', async () => {
    const { board, columns, cards } = await createBoard(prisma);

    const response = await api.post(`/api/columns/${columns.todo.id}/cards`).send({ title: '  Third  ' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(String),
      title: 'Third',
      description: '',
      dueDate: null,
      labels: [],
      assignees: [],
      commentCount: 0,
    });
    const after = await api.get(`/api/boards/${board.id}`);
    expect(after.body.columns[0].cards.map((card: { id: string }) => card.id)).toEqual([
      cards.first.id,
      cards.second.id,
      response.body.id,
    ]);
  });

  it.each([
    [{ title: '' }, 'title: must not be empty'],
    [{ title: 'x'.repeat(201) }, 'title: Too big: expected string to have <=200 characters'],
    [{ title: 'Third', description: 'Not here' }, 'Unrecognized key: "description"'],
  ])('refuses %j with a 400 naming the field', async (body, message) => {
    const { columns } = await createBoard(prisma);

    const response = await api.post(`/api/columns/${columns.todo.id}/cards`).send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Bad Request', message });
  });

  it('answers 404 for a column that does not exist', async () => {
    const response = await api.post('/api/columns/missing/cards').send({ title: 'Third' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No column with id missing');
  });
});

describe('PATCH /api/cards/:cardId', () => {
  it('changes only the fields given, keeping labels in board order and assignees by name', async () => {
    const { cards, labels, members } = await createBoard(prisma);

    const response = await api.patch(`/api/cards/${cards.second.id}`).send({
      description: '  Notes  ',
      dueDate: '2026-12-24',
      labelIds: [labels.backend.id, labels.design.id],
      assigneeIds: [members.robin.id, members.alex.id],
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: cards.second.id, title: 'Second', description: 'Notes', dueDate: '2026-12-24' });
    expect(response.body.labels.map((label: { name: string }) => label.name)).toEqual(['Design', 'Backend']);
    expect(response.body.assignees.map((member: { name: string }) => member.name)).toEqual(['Alex Moreno', 'Robin Park']);
  });

  it('removes the due date with null, and every label with an empty list', async () => {
    const { cards } = await createBoard(prisma);

    const response = await api.patch(`/api/cards/${cards.first.id}`).send({ dueDate: null, labelIds: [] });

    expect(response.body).toMatchObject({ dueDate: null, labels: [] });
    expect(response.body.assignees).toHaveLength(2);
  });

  it.each([
    [{}, 'must change at least one field'],
    [{ title: '  ' }, 'title: must not be empty'],
    [{ dueDate: '2026-02-30' }, expect.stringMatching(/^dueDate: /)],
    [{ labelIds: ['same', 'same'] }, 'labelIds: must not list an id twice'],
  ])('refuses %j with a 400', async (body, message) => {
    const { cards } = await createBoard(prisma);

    const response = await api.patch(`/api/cards/${cards.first.id}`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(message);
  });

  it('refuses a label or a member from another board', async () => {
    const { cards } = await createBoard(prisma);
    const other = await createBoard(prisma, 'Other');

    const labelResponse = await api.patch(`/api/cards/${cards.first.id}`).send({ labelIds: [other.labels.design.id] });
    const memberResponse = await api.patch(`/api/cards/${cards.first.id}`).send({ assigneeIds: [other.members.alex.id] });

    expect(labelResponse.status).toBe(400);
    expect(labelResponse.body.message).toBe(`labelIds: no label with id ${other.labels.design.id} on this card's board`);
    expect(memberResponse.status).toBe(400);
    expect(memberResponse.body.message).toBe(`assigneeIds: no member with id ${other.members.alex.id} on this card's board`);
  });

  it('answers 404 for a card that does not exist', async () => {
    const response = await api.patch('/api/cards/missing').send({ title: 'Third' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No card with id missing');
  });
});

describe('POST /api/cards/:cardId/move', () => {
  const idsOf = (column: { cards: { id: string }[] }) => column.cards.map((card) => card.id);

  it('moves a card within its column, answering with the board', async () => {
    const { board, columns, cards } = await createBoard(prisma);

    const response = await api.post(`/api/cards/${cards.second.id}/move`).send({ columnId: columns.todo.id, index: 0 });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(board.id);
    expect(idsOf(response.body.columns[0])).toEqual([cards.second.id, cards.first.id]);
  });

  it('moves a card into another column at the index given, keeping its fields', async () => {
    const { columns, cards } = await createBoard(prisma);

    const response = await api.post(`/api/cards/${cards.first.id}/move`).send({ columnId: columns.done.id, index: 0 });

    expect(idsOf(response.body.columns[0])).toEqual([cards.second.id]);
    expect(idsOf(response.body.columns[1])).toEqual([cards.first.id]);
    expect(response.body.columns[1].cards[0]).toMatchObject({ title: 'First', dueDate: '2026-12-01', commentCount: 2 });
  });

  it('puts the card last when the index is past the end', async () => {
    const { columns, cards } = await createBoard(prisma);

    const response = await api.post(`/api/cards/${cards.first.id}/move`).send({ columnId: columns.todo.id, index: 99 });

    expect(idsOf(response.body.columns[0])).toEqual([cards.second.id, cards.first.id]);
  });

  it('renumbers the positions of both columns from 0, closing gaps and ties', async () => {
    const { columns, cards } = await createBoard(prisma);
    const third = await prisma.card.create({ data: { columnId: columns.todo.id, title: 'Third', position: 7 } });
    await prisma.card.update({ where: { id: cards.second.id }, data: { position: 7 } });

    await api.post(`/api/cards/${cards.first.id}/move`).send({ columnId: columns.done.id, index: 0 });

    const positions = await prisma.card.findMany({ orderBy: { position: 'asc' }, select: { id: true, columnId: true, position: true } });
    expect(positions.filter((card) => card.columnId === columns.todo.id).map((card) => card.position)).toEqual([0, 1]);
    expect(positions.find((card) => card.id === cards.first.id)).toMatchObject({ columnId: columns.done.id, position: 0 });
    expect(positions.map((card) => card.id)).toContain(third.id);
  });

  it.each([
    [{ index: 0 }, expect.stringMatching(/^columnId: /)],
    [{ columnId: 'any', index: -1 }, expect.stringMatching(/^index: /)],
    [{ columnId: 'any', index: 1.5 }, expect.stringMatching(/^index: /)],
    [{ columnId: 'any', index: 0, position: 0 }, 'Unrecognized key: "position"'],
  ])('refuses %j with a 400 naming the field', async (body, message) => {
    const { cards } = await createBoard(prisma);

    const response = await api.post(`/api/cards/${cards.first.id}/move`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(message);
  });

  it('refuses a column from another board, moving nothing', async () => {
    const { columns, cards } = await createBoard(prisma);
    const other = await createBoard(prisma, 'Other');

    const response = await api.post(`/api/cards/${cards.first.id}/move`).send({ columnId: other.columns.done.id, index: 0 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(`columnId: no column with id ${other.columns.done.id} on this card's board`);
    expect(await prisma.card.findUnique({ where: { id: cards.first.id }, select: { columnId: true } })).toEqual({
      columnId: columns.todo.id,
    });
  });

  it('answers 404 for a card that does not exist', async () => {
    const { columns } = await createBoard(prisma);

    const response = await api.post('/api/cards/missing/move').send({ columnId: columns.todo.id, index: 0 });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No card with id missing');
  });
});

describe('DELETE /api/cards/:cardId', () => {
  it('deletes the card and its comments, answering 204 with no body', async () => {
    const { cards } = await createBoard(prisma);

    const response = await api.delete(`/api/cards/${cards.first.id}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(await prisma.card.count({ where: { id: cards.first.id } })).toBe(0);
    expect(await prisma.comment.count()).toBe(0);
  });

  it('answers 404 once the card is gone', async () => {
    const { cards } = await createBoard(prisma);
    await api.delete(`/api/cards/${cards.second.id}`);

    const response = await api.delete(`/api/cards/${cards.second.id}`);

    expect(response.status).toBe(404);
  });
});

describe('GET /api/cards/:cardId/comments', () => {
  it('lists the comments oldest first, with their authors and ISO times', async () => {
    const { cards, members, comments } = await createBoard(prisma);

    const response = await api.get(`/api/cards/${cards.first.id}/comments`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: comments.question.id,
        body: 'Who takes this?',
        createdAt: '2026-11-19T09:00:00.000Z',
        author: { id: members.alex.id, name: 'Alex Moreno', color: 'amber' },
      },
      {
        id: comments.reply.id,
        body: 'Done on my side',
        createdAt: '2026-11-20T10:00:00.000Z',
        author: { id: members.robin.id, name: 'Robin Park', color: 'green' },
      },
    ]);
  });

  it('lists none for a card without comments', async () => {
    const { cards } = await createBoard(prisma);

    const response = await api.get(`/api/cards/${cards.second.id}/comments`);

    expect(response.body).toEqual([]);
  });

  it('answers 404 for a card that does not exist', async () => {
    const response = await api.get('/api/cards/missing/comments');

    expect(response.status).toBe(404);
  });
});
