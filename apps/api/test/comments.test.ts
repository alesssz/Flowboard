// Comments: a card's comments, writing one as the signed-in member, and editing or deleting one's own only.
import { commentBodyMaxLength } from '@flowboard/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createBoard, createMemberAccount } from './fixtures.ts';
import { useTestApp } from './test-app.ts';

const { member, prisma } = useTestApp();
// Robin Park's account exists in every test, board or not, so `member` is signed in.
beforeEach(() => createMemberAccount(prisma));

describe('GET /api/cards/:cardId/comments', () => {
  it("lists the comments oldest first, with their authors, ISO times, and which are the user's", async () => {
    const { cards, members, comments } = await createBoard(prisma);

    const response = await member.get(`/api/cards/${cards.first.id}/comments`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: comments.question.id,
        body: 'Who takes this?',
        createdAt: '2026-11-19T09:00:00.000Z',
        editedAt: null,
        author: { id: members.alex.id, name: 'Alex Moreno', color: 'amber' },
        mine: false,
      },
      {
        id: comments.reply.id,
        body: 'Done on my side',
        createdAt: '2026-11-20T10:00:00.000Z',
        editedAt: null,
        author: { id: members.robin.id, name: 'Robin Park', color: 'green' },
        mine: true,
      },
    ]);
  });

  it('lists none for a card without comments', async () => {
    const { cards } = await createBoard(prisma);

    const response = await member.get(`/api/cards/${cards.second.id}/comments`);

    expect(response.body).toEqual([]);
  });

  it('answers 404 for a card that does not exist', async () => {
    const response = await member.get('/api/cards/missing/comments');

    expect(response.status).toBe(404);
  });
});

describe('POST /api/cards/:cardId/comments', () => {
  it('adds a comment by the signed-in member, trimmed but with its line breaks, last in the list', async () => {
    const { board, cards, members } = await createBoard(prisma);

    const response = await member.post(`/api/cards/${cards.first.id}/comments`).send({ body: '  First line\nSecond line \n' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(String),
      body: 'First line\nSecond line',
      createdAt: expect.any(String),
      editedAt: null,
      author: { id: members.robin.id, name: 'Robin Park', color: 'green' },
      mine: true,
    });
    const list = await member.get(`/api/cards/${cards.first.id}/comments`);
    expect(list.body.at(-1).id).toBe(response.body.id);
    const after = await member.get(`/api/boards/${board.id}`);
    expect(after.body.columns[0].cards[0].commentCount).toBe(3);
  });

  it.each([
    ['an empty body', { body: '   ' }, 'body: must not be empty'],
    ['a body over the limit', { body: 'x'.repeat(commentBodyMaxLength + 1) }, expect.stringContaining('body:')],
    ['a field it does not know', { body: 'Hello', authorId: 'someone' }, expect.stringContaining('authorId')],
  ])('refuses %s with a 400', async (_scenario, body, message) => {
    const { cards } = await createBoard(prisma);

    const response = await member.post(`/api/cards/${cards.first.id}/comments`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(message);
    expect(await prisma.comment.count({ where: { cardId: cards.first.id } })).toBe(2);
  });

  it('answers 404 for a card that does not exist', async () => {
    const response = await member.post('/api/cards/missing/comments').send({ body: 'Hello' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not Found', message: 'No card with id missing' });
  });
});

describe('PATCH /api/comments/:commentId', () => {
  it("changes the body of one's own comment and records when", async () => {
    const { comments } = await createBoard(prisma);
    const before = Date.now();

    const response = await member.patch(`/api/comments/${comments.reply.id}`).send({ body: ' Done, and tested ' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: comments.reply.id, body: 'Done, and tested', createdAt: '2026-11-20T10:00:00.000Z', mine: true });
    expect(new Date(response.body.editedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("refuses someone else's comment with a 403, and leaves it as it was", async () => {
    const { comments } = await createBoard(prisma);

    const response = await member.patch(`/api/comments/${comments.question.id}`).send({ body: 'Rewritten' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Forbidden', message: 'Only its author can change or delete a comment' });
    expect(await prisma.comment.findUniqueOrThrow({ where: { id: comments.question.id } })).toMatchObject({ body: 'Who takes this?', editedAt: null });
  });

  it('refuses an empty body with a 400', async () => {
    const { comments } = await createBoard(prisma);

    const response = await member.patch(`/api/comments/${comments.reply.id}`).send({ body: '' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('body: must not be empty');
  });

  it('answers 404 for a comment that does not exist', async () => {
    const response = await member.patch('/api/comments/missing').send({ body: 'Hello' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not Found', message: 'No comment with id missing' });
  });
});

describe('DELETE /api/comments/:commentId', () => {
  it("deletes one's own comment", async () => {
    const { comments } = await createBoard(prisma);

    const response = await member.delete(`/api/comments/${comments.reply.id}`);

    expect(response.status).toBe(204);
    expect(await prisma.comment.count({ where: { id: comments.reply.id } })).toBe(0);
  });

  it("refuses someone else's comment with a 403, and keeps it", async () => {
    const { comments } = await createBoard(prisma);

    const response = await member.delete(`/api/comments/${comments.question.id}`);

    expect(response.status).toBe(403);
    expect(await prisma.comment.count({ where: { id: comments.question.id } })).toBe(1);
  });

  it('answers 404 for a comment that does not exist', async () => {
    const response = await member.delete('/api/comments/missing');

    expect(response.status).toBe(404);
  });
});
