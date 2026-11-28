// Permissions: every board, column, card, comment, label, member and invitation route needs a session, reaches only the
// user's boards, and lets each role do only what it may.
import type { Test } from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createBoard, createMemberAccount } from './fixtures.ts';
import { useTestApp } from './test-app.ts';

const { api, member, prisma } = useTestApp();
beforeEach(() => createMemberAccount(prisma));

type Client = typeof member;
type Fixture = Awaited<ReturnType<typeof createBoard>>;
/** The least role the request needs: any member, an editor (or owner), or an owner. */
type Needs = 'member' | 'editor' | 'owner';

// Every route behind the session check, each with a body it accepts: only who sends it decides the answer.
const routes: [string, Needs, (client: Client, fixture: Fixture) => Test][] = [
  ['GET /api/boards/:boardId', 'member', (client, { board }) => client.get(`/api/boards/${board.id}`)],
  ['PATCH /api/boards/:boardId', 'owner', (client, { board }) => client.patch(`/api/boards/${board.id}`).send({ title: 'Renamed' })],
  ['DELETE /api/boards/:boardId', 'owner', (client, { board }) => client.delete(`/api/boards/${board.id}`)],
  ['POST /api/boards/:boardId/columns', 'editor', (client, { board }) => client.post(`/api/boards/${board.id}/columns`).send({ title: 'Review', color: 'blue' })],
  ['PATCH /api/columns/:columnId', 'editor', (client, { columns }) => client.patch(`/api/columns/${columns.todo.id}`).send({ title: 'Renamed' })],
  ['POST /api/columns/:columnId/move', 'editor', (client, { columns }) => client.post(`/api/columns/${columns.todo.id}/move`).send({ index: 1 })],
  ['DELETE /api/columns/:columnId', 'editor', (client, { columns }) => client.delete(`/api/columns/${columns.todo.id}`)],
  ['POST /api/columns/:columnId/cards', 'editor', (client, { columns }) => client.post(`/api/columns/${columns.todo.id}/cards`).send({ title: 'New' })],
  ['PATCH /api/cards/:cardId', 'editor', (client, { cards }) => client.patch(`/api/cards/${cards.first.id}`).send({ title: 'Renamed' })],
  [
    'POST /api/cards/:cardId/move',
    'editor',
    (client, { cards, columns }) => client.post(`/api/cards/${cards.first.id}/move`).send({ columnId: columns.done.id, index: 0 }),
  ],
  ['DELETE /api/cards/:cardId', 'editor', (client, { cards }) => client.delete(`/api/cards/${cards.first.id}`)],
  ['GET /api/cards/:cardId/comments', 'member', (client, { cards }) => client.get(`/api/cards/${cards.first.id}/comments`)],
  ['POST /api/cards/:cardId/comments', 'member', (client, { cards }) => client.post(`/api/cards/${cards.first.id}/comments`).send({ body: 'Hello' })],
  // Robin Park's own comment: on the member's board, the author may change it, whatever their role.
  ['PATCH /api/comments/:commentId', 'member', (client, { comments }) => client.patch(`/api/comments/${comments.reply.id}`).send({ body: 'Changed' })],
  ['DELETE /api/comments/:commentId', 'member', (client, { comments }) => client.delete(`/api/comments/${comments.reply.id}`)],
  ['POST /api/boards/:boardId/labels', 'editor', (client, { board }) => client.post(`/api/boards/${board.id}/labels`).send({ name: 'Copy', color: 'amber' })],
  ['PATCH /api/labels/:labelId', 'editor', (client, { labels }) => client.patch(`/api/labels/${labels.design.id}`).send({ name: 'UX' })],
  ['DELETE /api/labels/:labelId', 'editor', (client, { labels }) => client.delete(`/api/labels/${labels.design.id}`)],
  ['GET /api/boards/:boardId/members', 'member', (client, { board }) => client.get(`/api/boards/${board.id}/members`)],
  // Robin Park's own member, made an owner: a change only an owner may make, even to themselves.
  ['PATCH /api/members/:memberId', 'owner', (client, { members }) => client.patch(`/api/members/${members.robin.id}`).send({ role: 'owner' })],
  // Robin Park leaving: any member may.
  ['DELETE /api/members/:memberId', 'member', (client, { members }) => client.delete(`/api/members/${members.robin.id}`)],
  ['POST /api/boards/:boardId/invitations', 'owner', (client, { board }) => client.post(`/api/boards/${board.id}/invitations`).send({ role: 'editor' })],
  ['GET /api/boards/:boardId/invitations', 'owner', (client, { board }) => client.get(`/api/boards/${board.id}/invitations`)],
  ['DELETE /api/invitations/:invitationId', 'owner', (client, { invitations }) => client.delete(`/api/invitations/${invitations.pending.id}`)],
];

/** What each role below owner may not do. */
const beyond: Record<'viewer' | 'editor', Needs[]> = { viewer: ['editor', 'owner'], editor: ['owner'] };

/** Everything a route could change on the board: its title, labels, members, invitations, columns, cards with their labels, and comments. */
function snapshot(boardId: string) {
  return prisma.board.findUniqueOrThrow({
    where: { id: boardId },
    include: {
      labels: { orderBy: { id: 'asc' } },
      members: { orderBy: { id: 'asc' } },
      invitations: { orderBy: { id: 'asc' } },
      columns: {
        orderBy: { id: 'asc' },
        include: { cards: { orderBy: { id: 'asc' }, include: { labels: { orderBy: { id: 'asc' } }, comments: { orderBy: { id: 'asc' } } } } },
      },
    },
  });
}

describe('without a session', () => {
  it.each(routes)('%s answers 401 and changes nothing', async (_route, _needs, send) => {
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

  it('POST /api/boards answers 401 and creates nothing', async () => {
    const response = await api.post('/api/boards').send({ title: 'Roadmap' });

    expect(response.status).toBe(401);
    expect(await prisma.board.count()).toBe(0);
  });

  it('a session that has ended answers 401', async () => {
    const fixture = await createBoard(prisma);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const response = await member.get(`/api/boards/${fixture.board.id}`);

    expect(response.status).toBe(401);
  });
});

describe("on another user's board", () => {
  it.each(routes)('%s answers 404, as for an id that does not exist, and changes nothing', async (_route, _needs, send) => {
    const fixture = await createBoard(prisma, 'Theirs', { ofAnotherUser: true });
    const before = await snapshot(fixture.board.id);

    const response = await send(member, fixture);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not Found', message: expect.stringMatching(/^No (board|column|card|comment|label|member|invitation) with id /) });
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

describe.each(['viewer', 'editor'] as const)('as %s', (role) => {
  it.each(routes.filter(([, needs]) => beyond[role].includes(needs)))('%s answers 403 and changes nothing', async (_route, _needs, send) => {
    const fixture = await createBoard(prisma, 'Launch', { role });
    const before = await snapshot(fixture.board.id);

    const response = await send(member, fixture);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Forbidden', message: expect.any(String) });
    expect(await snapshot(fixture.board.id)).toEqual(before);
  });

  it.each(routes.filter(([, needs]) => !beyond[role].includes(needs)))('%s is allowed', async (_route, _needs, send) => {
    const fixture = await createBoard(prisma, 'Launch', { role });

    const response = await send(member, fixture);

    expect(response.status).toBeLessThan(300);
  });
});
