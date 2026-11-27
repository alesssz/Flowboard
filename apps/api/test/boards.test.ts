// Boards: the user's boards; one board with its columns, cards, labels and members in display order; create, rename, delete.
import { beforeEach, describe, expect, it } from 'vitest';
import { createBoard, createMemberAccount } from './fixtures.ts';
import { useTestApp } from './test-app.ts';

const { member, prisma } = useTestApp();
// Robin Park's account exists in every test, board or not, so `member` is signed in.
beforeEach(() => createMemberAccount(prisma));

describe('GET /api/boards', () => {
  it("lists the boards the user is a member of, oldest first, without their content", async () => {
    const { id: userId } = await createMemberAccount(prisma);
    const board = (title: string, createdAt: string, members: { userId?: string }[]) =>
      prisma.board.create({
        data: { title, createdAt: new Date(createdAt), members: { create: members.map((m) => ({ name: 'Robin Park', color: 'green', ...m })) } },
      });
    const newer = await board('Newer', '2026-11-02T00:00:00Z', [{ userId }]);
    const older = await board('Older', '2026-11-01T00:00:00Z', [{ userId }]);
    await board('Not a member', '2026-10-01T00:00:00Z', [{}]);
    await board('No members', '2026-10-01T00:00:00Z', []);

    const response = await member.get('/api/boards');

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

    const response = await member.get(`/api/boards/${board.id}`);

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

    const response = await member.get(`/api/boards/${board.id}`);

    expect(response.body.columns[0].cards[0]).toEqual({
      id: cards.first.id,
      title: 'First',
      description: 'Line one\nLine two',
      dueDate: '2026-12-01',
      completedAt: null,
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
    const response = await member.get('/api/boards/missing');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not Found', message: 'No board with id missing' });
  });
});

describe('POST /api/boards', () => {
  it('creates a trimmed board with the user as its member and the starter columns, last in the list', async () => {
    const { board: older } = await createBoard(prisma);
    const { id: userId } = await createMemberAccount(prisma);

    const response = await member.post('/api/boards').send({ title: '  Roadmap  ' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(String),
      title: 'Roadmap',
      columns: [
        { id: expect.any(String), title: 'To do', color: 'gray', cards: [] },
        { id: expect.any(String), title: 'In progress', color: 'blue', cards: [] },
        { id: expect.any(String), title: 'Done', color: 'green', cards: [] },
      ],
      labels: [],
      members: [{ id: expect.any(String), name: 'Robin Park', color: expect.any(String) }],
    });
    expect(await prisma.member.findUniqueOrThrow({ where: { id: response.body.members[0].id } })).toMatchObject({ userId });
    const list = await member.get('/api/boards');
    expect(list.body).toEqual([
      { id: older.id, title: 'Launch' },
      { id: response.body.id, title: 'Roadmap' },
    ]);
  });

  it.each([
    [{ title: '   ' }, 'title: must not be empty'],
    [{ title: 'x'.repeat(101) }, 'title: Too big: expected string to have <=100 characters'],
    [{}, expect.stringMatching(/^title: /)],
    [{ title: 'Roadmap', members: [] }, 'Unrecognized key: "members"'],
  ])('refuses %j with a 400 naming the field', async (body, message) => {
    const response = await member.post('/api/boards').send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Bad Request', message });
    expect(await prisma.board.count()).toBe(0);
  });
});

describe('PATCH /api/boards/:boardId', () => {
  it('renames the board, trimmed', async () => {
    const { board } = await createBoard(prisma);

    const response = await member.patch(`/api/boards/${board.id}`).send({ title: ' Relaunch ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: board.id, title: 'Relaunch' });
    expect((await member.get(`/api/boards/${board.id}`)).body.title).toBe('Relaunch');
  });

  it.each([
    [{ title: '' }, 'title: must not be empty'],
    [{}, expect.stringMatching(/^title: /)],
  ])('refuses %j with a 400', async (body, message) => {
    const { board } = await createBoard(prisma);

    const response = await member.patch(`/api/boards/${board.id}`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(message);
  });

  it('answers 404 for a board that does not exist', async () => {
    const response = await member.patch('/api/boards/missing').send({ title: 'Relaunch' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No board with id missing');
  });
});

describe('DELETE /api/boards/:boardId', () => {
  it('deletes the board with its columns, cards, comments, labels and members, and nothing else', async () => {
    const { board } = await createBoard(prisma);
    const other = await createBoard(prisma, 'Other');

    const response = await member.delete(`/api/boards/${board.id}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(await prisma.board.findUnique({ where: { id: board.id } })).toBeNull();
    const left = { where: { boardId: board.id } };
    expect([await prisma.column.count(left), await prisma.label.count(left), await prisma.member.count(left)]).toEqual([0, 0, 0]);
    expect(await prisma.comment.count()).toBe(2);
    expect((await member.get('/api/boards')).body).toEqual([{ id: other.board.id, title: 'Other' }]);
    // The user's account stays.
    expect(await prisma.user.count()).toBe(1);
  });

  it('answers 404 for a board that does not exist', async () => {
    const response = await member.delete('/api/boards/missing');

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No board with id missing');
  });
});
