// Permissions: every board, column, card, comment and label route needs a session, and reaches only the user's boards.
import type { Test } from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createBoard, createMemberAccount } from './fixtures.ts';
import { useTestApp } from './test-app.ts';

const { api, member, prisma } = useTestApp();
beforeEach(() => createMemberAccount(prisma));

type Client = typeof member;
type Fixture = Awaited<ReturnType<typeof createBoard>>;

// Every route behind the session check, each with a body it accepts: only who sends it decides the answer.
const routes: [string, (client: Client, fixture: Fixture) => Test][] = [
  ['GET /api/boards/:boardId', (client, { board }) => client.get(`/api/boards/${board.id}`)],
  ['POST /api/boards/:boardId/columns', (client, { board }) => client.post(`/api/boards/${board.id}/columns`).send({ title: 'Review', color: 'blue' })],
  ['PATCH /api/columns/:columnId', (client, { columns }) => client.patch(`/api/columns/${columns.todo.id}`).send({ title: 'Renamed' })],
  ['POST /api/columns/:columnId/move', (client, { columns }) => client.post(`/api/columns/${columns.todo.id}/move`).send({ index: 1 })],
  ['DELETE /api/columns/:columnId', (client, { columns }) => client.delete(`/api/columns/${columns.todo.id}`)],
  ['POST /api/columns/:columnId/cards', (client, { columns }) => client.post(`/api/columns/${columns.todo.id}/cards`).send({ title: 'New' })],
  ['PATCH /api/cards/:cardId', (client, { cards }) => client.patch(`/api/cards/${cards.first.id}`).send({ title: 'Renamed' })],
  [
    'POST /api/cards/:cardId/move',
    (client, { cards, columns }) => client.post(`/api/cards/${cards.first.id}/move`).send({ columnId: columns.done.id, index: 0 }),
  ],
  ['DELETE /api/cards/:cardId', (client, { cards }) => client.delete(`/api/cards/${cards.first.id}`)],
  ['GET /api/cards/:cardId/comments', (client, { cards }) => client.get(`/api/cards/${cards.first.id}/comments`)],
  ['POST /api/cards/:cardId/comments', (client, { cards }) => client.post(`/api/cards/${cards.first.id}/comments`).send({ body: 'Hello' })],
  // Robin Park's own comment: on the member's board, the author may change it.
  ['PATCH /api/comments/:commentId', (client, { comments }) => client.patch(`/api/comments/${comments.reply.id}`).send({ body: 'Changed' })],
  ['DELETE /api/comments/:commentId', (client, { comments }) => client.delete(`/api/comments/${comments.reply.id}`)],
  ['POST /api/boards/:boardId/labels', (client, { board }) => client.post(`/api/boards/${board.id}/labels`).send({ name: 'Copy', color: 'amber' })],
  ['PATCH /api/labels/:labelId', (client, { labels }) => client.patch(`/api/labels/${labels.design.id}`).send({ name: 'UX' })],
  ['DELETE /api/labels/:labelId', (client, { labels }) => client.delete(`/api/labels/${labels.design.id}`)],
];

/** Everything a route could change on the board: labels, columns, cards with their labels, and comments. */
function snapshot(boardId: string) {
  return prisma.board.findUniqueOrThrow({
    where: { id: boardId },
    include: {
      labels: { orderBy: { id: 'asc' } },
      columns: {
        orderBy: { id: 'asc' },
        include: { cards: { orderBy: { id: 'asc' }, include: { labels: { orderBy: { id: 'asc' } }, comments: { orderBy: { id: 'asc' } } } } },
      },
    },
  });
}

describe('without a session', () => {
  it.each(routes)('%s answers 401 and changes nothing', async (_route, send) => {
    const fixture = await createBoard(prisma);
    const before = await snapshot(fixture.board.id);

    const response = await send(api, fixture);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized', message: 'Not signed in' });
    expect(await snapshot(fixture.board.id)).toEqual(before);
  });

  it('GET /api/boards answers 401', async () => {
    await createBoard(prisma);

    expect((await api.get('/api/boards')).status).toBe(401);
  });

  it('a session that has ended answers 401', async () => {
    const fixture = await createBoard(prisma);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const response = await member.get(`/api/boards/${fixture.board.id}`);

    expect(response.status).toBe(401);
  });
});

describe("on another user's board", () => {
  it.each(routes)('%s answers 404, as for an id that does not exist, and changes nothing', async (_route, send) => {
    const fixture = await createBoard(prisma, 'Theirs', { ofAnotherUser: true });
    const before = await snapshot(fixture.board.id);

    const response = await send(member, fixture);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not Found', message: expect.stringMatching(/^No (board|column|card|comment|label) with id /) });
    expect(await snapshot(fixture.board.id)).toEqual(before);
  });

  it('GET /api/boards leaves it out', async () => {
    const mine = await createBoard(prisma, 'Mine');
    await createBoard(prisma, 'Theirs', { ofAnotherUser: true });

    const response = await member.get('/api/boards');

    expect(response.body).toEqual([{ id: mine.board.id, title: 'Mine' }]);
  });

  it("refuses to move a card of one's own into a column of theirs", async () => {
    const mine = await createBoard(prisma, 'Mine');
    const theirs = await createBoard(prisma, 'Theirs', { ofAnotherUser: true });

    const response = await member.post(`/api/cards/${mine.cards.first.id}/move`).send({ columnId: theirs.columns.todo.id, index: 0 });

    expect(response.status).toBe(400);
    expect(await prisma.card.count({ where: { columnId: theirs.columns.todo.id } })).toBe(2);
  });
});
