// Members: the list, roles changed by an owner, members removed by an owner or leaving; a board keeps an owner.
import { beforeEach, describe, expect, it } from 'vitest';
import { updateMember } from '../src/members/member-queries.ts';
import { createAccount, createBoard, createMemberAccount } from './fixtures.ts';
import { useTestApp } from './test-app.ts';

const { api, member, prisma } = useTestApp();
// Robin Park's account exists in every test, board or not, so `member` is signed in.
beforeEach(() => createMemberAccount(prisma));

/** The board, with Alex Moreno given an account of his own and the role `role`. */
async function boardWithAlex(role: 'owner' | 'editor' | 'viewer' = 'editor', robinRole: 'owner' | 'editor' | 'viewer' = 'owner') {
  const fixture = await createBoard(prisma, 'Launch', { role: robinRole });
  const alex = await createAccount(prisma, 'Alex Moreno', 'alex@example.com');
  await prisma.member.update({ where: { id: fixture.members.alex.id }, data: { userId: alex.id, role } });
  return { ...fixture, alex };
}

describe('GET /api/boards/:boardId/members', () => {
  it('lists the members with an account, by name, with their roles, and says which is the user', async () => {
    const { board, members } = await boardWithAlex('viewer');
    await prisma.member.create({ data: { boardId: board.id, name: 'Aaron Without Account', color: 'red' } });

    const response = await member.get(`/api/boards/${board.id}/members`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: members.alex.id, name: 'Alex Moreno', color: 'amber', role: 'viewer', you: false },
      { id: members.robin.id, name: 'Robin Park', color: 'green', role: 'owner', you: true },
    ]);
  });

  it('answers 404 for a board that does not exist', async () => {
    const response = await member.get('/api/boards/missing/members');

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No board with id missing');
  });
});

describe('PATCH /api/members/:memberId', () => {
  it("changes another member's role, which their next request follows", async () => {
    const { board, members, alex } = await boardWithAlex('editor');

    const response = await member.patch(`/api/members/${members.alex.id}`).send({ role: 'viewer' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: members.alex.id, name: 'Alex Moreno', color: 'amber', role: 'viewer', you: false });
    const asAlex = await api.post(`/api/boards/${board.id}/columns`).set('Cookie', alex.cookie).send({ title: 'Review', color: 'blue' });
    expect(asAlex.status).toBe(403);
  });

  it('lets an owner step down while another owner stays', async () => {
    const { members } = await boardWithAlex('owner');

    const response = await member.patch(`/api/members/${members.robin.id}`).send({ role: 'editor' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ role: 'editor', you: true });
  });

  it('refuses to take the role of the only owner, with a 409', async () => {
    const { members } = await boardWithAlex('owner');
    await member.patch(`/api/members/${members.alex.id}`).send({ role: 'editor' });

    const response = await member.patch(`/api/members/${members.robin.id}`).send({ role: 'viewer' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'Conflict', message: 'The board must keep an owner: make someone else an owner first' });
    expect(await prisma.member.findUniqueOrThrow({ where: { id: members.robin.id } })).toMatchObject({ role: 'owner' });
  });

  it('waits for a member write already under way on the board, then refuses to leave it without an owner', async () => {
    const { board, members } = await boardWithAlex('owner');
    const { id: robinUserId } = await createMemberAccount(prisma);
    let robinStepsDown: Promise<unknown> = Promise.resolve();

    // Alex Moreno stepping down at the same moment: it holds the board's row until it commits.
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Board" WHERE id = ${board.id} FOR UPDATE`;
      robinStepsDown = updateMember(prisma, robinUserId, members.robin.id, { role: 'editor' });
      robinStepsDown.catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 200));
      await tx.member.update({ where: { id: members.alex.id }, data: { role: 'editor' } });
    });

    await expect(robinStepsDown).rejects.toMatchObject({ status: 409 });
    expect(await prisma.member.count({ where: { boardId: board.id, role: 'owner', userId: { not: null } } })).toBe(1);
  });

  it.each([
    [{ role: 'admin' }, expect.stringMatching(/^role: /)],
    [{}, expect.stringMatching(/^role: /)],
    [{ role: 'viewer', userId: 'someone' }, 'Unrecognized key: "userId"'],
  ])('refuses %j with a 400', async (body, message) => {
    const { members } = await boardWithAlex();

    const response = await member.patch(`/api/members/${members.alex.id}`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(message);
  });

  it('answers 404 for a member without an account, who has no role to change', async () => {
    const { members } = await createBoard(prisma);

    const response = await member.patch(`/api/members/${members.alex.id}`).send({ role: 'viewer' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe(`No member with id ${members.alex.id}`);
  });
});

describe('DELETE /api/members/:memberId', () => {
  it('removes a member: their account loses the board, their name stays on their comments and cards', async () => {
    const { board, cards, comments, members, alex } = await boardWithAlex();

    const response = await member.delete(`/api/members/${members.alex.id}`);

    expect(response.status).toBe(204);
    expect((await api.get(`/api/boards/${board.id}`).set('Cookie', alex.cookie)).status).toBe(404);
    const after = await member.get(`/api/cards/${cards.first.id}/comments`);
    expect(after.body.find((comment: { id: string }) => comment.id === comments.question.id).author.name).toBe('Alex Moreno');
    const list = await member.get(`/api/boards/${board.id}/members`);
    expect(list.body.map((other: { name: string }) => other.name)).toEqual(['Robin Park']);
  });

  it('lets a member who is not an owner leave', async () => {
    const { members, alex } = await boardWithAlex('viewer');

    const response = await api.delete(`/api/members/${members.alex.id}`).set('Cookie', alex.cookie);

    expect(response.status).toBe(204);
    expect((await api.get('/api/boards').set('Cookie', alex.cookie)).body).toEqual([]);
  });

  it('refuses to let someone other than an owner remove another member, with a 403', async () => {
    const { members } = await boardWithAlex('owner', 'editor');

    const response = await member.delete(`/api/members/${members.alex.id}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Only an owner can remove another member');
    expect(await prisma.member.findUniqueOrThrow({ where: { id: members.alex.id } })).toMatchObject({ userId: expect.any(String) });
  });

  it('refuses to let the only owner leave, with a 409', async () => {
    const { members } = await boardWithAlex('editor');

    const response = await member.delete(`/api/members/${members.robin.id}`);

    expect(response.status).toBe(409);
    expect(await prisma.member.findUniqueOrThrow({ where: { id: members.robin.id } })).toMatchObject({ userId: expect.any(String) });
  });

  it('answers 404 for a member that does not exist', async () => {
    const response = await member.delete('/api/members/missing');

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No member with id missing');
  });
});
