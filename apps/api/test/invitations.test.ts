// Invitations: an owner makes, lists and revokes them; the holder of a link previews it and joins, once.
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { acceptInvitation } from '../src/invitations/invitation-queries.ts';
import { createAccount, createBoard, createMemberAccount } from './fixtures.ts';
import { useTestApp } from './test-app.ts';

const { api, member, prisma } = useTestApp();
// Robin Park's account exists in every test, board or not, so `member` is signed in.
beforeEach(() => createMemberAccount(prisma));

const notValid = 'This invitation is not valid: it was used or revoked, or it expired';

/** A board of Robin Park's, an invitation he made to it with `role`, and its token. */
async function invited(role: 'owner' | 'editor' | 'viewer' = 'editor') {
  const fixture = await createBoard(prisma);
  const response = await member.post(`/api/boards/${fixture.board.id}/invitations`).send({ role });
  return { ...fixture, invitation: response.body.invitation, token: response.body.token as string };
}

const sam = () => createAccount(prisma, 'Sam Patel', 'sam@example.com');

describe('POST /api/boards/:boardId/invitations', () => {
  it('answers with the invitation and its token, keeping only the hash of the token, for seven days', async () => {
    const { board } = await createBoard(prisma);
    const before = Date.now();

    const response = await member.post(`/api/boards/${board.id}/invitations`).send({ role: 'viewer' });

    expect(response.status).toBe(201);
    expect(response.body.invitation).toEqual({
      id: expect.any(String),
      role: 'viewer',
      invitedBy: 'Robin Park',
      createdAt: expect.any(String),
      expiresAt: expect.any(String),
    });
    const { token } = response.body;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = await prisma.invitation.findUniqueOrThrow({ where: { id: response.body.invitation.id } });
    expect(row.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    const lifetime = Date.parse(response.body.invitation.expiresAt) - before;
    expect(lifetime).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 1000);
    expect(lifetime).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 5000);
  });

  it("deletes the board's expired invitations", async () => {
    const { board, members } = await createBoard(prisma);
    const expired = await prisma.invitation.create({
      data: { tokenHash: 'old', boardId: board.id, role: 'editor', invitedById: members.robin.id, expiresAt: new Date(Date.now() - 1000) },
    });

    await member.post(`/api/boards/${board.id}/invitations`).send({ role: 'editor' });

    expect(await prisma.invitation.findUnique({ where: { id: expired.id } })).toBeNull();
  });

  it.each([
    [{ role: 'admin' }, expect.stringMatching(/^role: /)],
    [{}, expect.stringMatching(/^role: /)],
    [{ role: 'editor', expiresAt: '2099-01-01' }, 'Unrecognized key: "expiresAt"'],
  ])('refuses %j with a 400', async (body, message) => {
    const { board } = await createBoard(prisma);

    const response = await member.post(`/api/boards/${board.id}/invitations`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(message);
  });
});

describe('GET /api/boards/:boardId/invitations', () => {
  it('lists the invitations still usable, newest first, without their tokens', async () => {
    const { board, invitations, members } = await createBoard(prisma);
    await prisma.invitation.update({ where: { id: invitations.pending.id }, data: { createdAt: new Date('2026-11-01T00:00:00Z') } });
    await prisma.invitation.create({
      data: { tokenHash: 'old', boardId: board.id, role: 'viewer', invitedById: members.robin.id, expiresAt: new Date(Date.now() - 1000) },
    });
    const made = await member.post(`/api/boards/${board.id}/invitations`).send({ role: 'viewer' });

    const response = await member.get(`/api/boards/${board.id}/invitations`);

    expect(response.status).toBe(200);
    expect(response.body.map((invitation: { id: string }) => invitation.id)).toEqual([made.body.invitation.id, invitations.pending.id]);
    expect(JSON.stringify(response.body)).not.toContain(made.body.token);
  });
});

describe('DELETE /api/invitations/:invitationId', () => {
  it('revokes the invitation: its link no longer works', async () => {
    const { invitation, token } = await invited();
    const { cookie } = await sam();

    const response = await member.delete(`/api/invitations/${invitation.id}`);

    expect(response.status).toBe(204);
    const accepted = await api.post('/api/invitations/accept').set('Cookie', cookie).send({ token });
    expect(accepted.status).toBe(404);
  });
});

describe('POST /api/invitations/preview', () => {
  it('shows the board, the role and who invited, to anyone signed in holding the link', async () => {
    const { board, invitation, token } = await invited('viewer');
    const { cookie } = await sam();

    const response = await api.post('/api/invitations/preview').set('Cookie', cookie).send({ token });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      boardId: board.id,
      boardTitle: 'Launch',
      role: 'viewer',
      invitedBy: 'Robin Park',
      expiresAt: invitation.expiresAt,
      alreadyMember: false,
    });
  });

  it('says when the user is a member already', async () => {
    const { token } = await invited();

    const response = await member.post('/api/invitations/preview').send({ token });

    expect(response.body.alreadyMember).toBe(true);
  });

  it('answers 404 with one message for a token unknown, expired or used', async () => {
    const { invitation, token } = await invited();
    const { cookie } = await sam();
    await prisma.invitation.update({ where: { id: invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const responses = [
      await api.post('/api/invitations/preview').set('Cookie', cookie).send({ token: 'not-a-token' }),
      await api.post('/api/invitations/preview').set('Cookie', cookie).send({ token }),
    ];

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Not Found', message: notValid });
    }
  });

  it.each([
    [{ token: '' }, expect.stringMatching(/^token: /)],
    [{ token: 'x'.repeat(101) }, expect.stringMatching(/^token: /)],
    [{ token: 'abc', boardId: 'x' }, 'Unrecognized key: "boardId"'],
  ])('refuses %j with a 400', async (body, message) => {
    const response = await member.post('/api/invitations/preview').send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(message);
  });

  it.each(['preview', 'accept'])('/api/invitations/%s answers 401 without a session', async (action) => {
    const { token } = await invited();

    const response = await api.post(`/api/invitations/${action}`).send({ token });

    expect(response.status).toBe(401);
    expect(await prisma.invitation.count()).toBe(2);
  });
});

describe('POST /api/invitations/accept', () => {
  it('makes the user a member under their name with the role, and uses the invitation up', async () => {
    const { board, invitation, token } = await invited('viewer');
    const { id: samId, cookie } = await sam();

    const response = await api.post('/api/invitations/accept').set('Cookie', cookie).send({ token });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: board.id, title: 'Launch' });
    expect(await prisma.member.findUniqueOrThrow({ where: { boardId_userId: { boardId: board.id, userId: samId } } })).toMatchObject({
      name: 'Sam Patel',
      role: 'viewer',
    });
    expect(await prisma.invitation.findUnique({ where: { id: invitation.id } })).toBeNull();
    expect((await api.get(`/api/boards/${board.id}`).set('Cookie', cookie)).body.role).toBe('viewer');
  });

  it('lets nobody else in with the same link', async () => {
    const { board, token } = await invited();
    await api.post('/api/invitations/accept').set('Cookie', (await sam()).cookie).send({ token });
    const alex = await createAccount(prisma, 'Alex Moreno', 'alex@example.com');

    const response = await api.post('/api/invitations/accept').set('Cookie', alex.cookie).send({ token });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe(notValid);
    expect(await prisma.member.count({ where: { boardId: board.id, userId: alex.id } })).toBe(0);
  });

  it('refuses a member of the board with a 409, and leaves the invitation for whom it was meant', async () => {
    const { invitation, token } = await invited();

    const response = await member.post('/api/invitations/accept').send({ token });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('You are already a member of this board');
    expect(await prisma.invitation.findUnique({ where: { id: invitation.id } })).not.toBeNull();
  });

  it('refuses an expired invitation', async () => {
    const { board, invitation, token } = await invited();
    const { id: samId, cookie } = await sam();
    await prisma.invitation.update({ where: { id: invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const response = await api.post('/api/invitations/accept').set('Cookie', cookie).send({ token });

    expect(response.status).toBe(404);
    expect(await prisma.member.count({ where: { boardId: board.id, userId: samId } })).toBe(0);
  });

  it('lets in only the first of two people accepting the same link at once', async () => {
    const { board, invitation, token } = await invited();
    const second = await sam();
    let secondAccepts: Promise<unknown> = Promise.resolve();

    // Someone else accepting first, part-way through: their transaction has taken the invitation.
    await prisma.$transaction(async (tx) => {
      await tx.invitation.delete({ where: { id: invitation.id } });
      secondAccepts = acceptInvitation(prisma, { id: second.id, email: 'sam@example.com', name: 'Sam Patel' }, token);
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    await expect(secondAccepts).resolves.toBeNull();
    expect(await prisma.member.count({ where: { boardId: board.id, userId: second.id } })).toBe(0);
  });
});
