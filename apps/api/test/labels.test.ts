// Label writes: create on a board, rename or recolour, delete from every card; names unique on a board in any case.
import { beforeEach, describe, expect, it } from 'vitest';
import { createLabel } from '../src/labels/label-queries.ts';
import { createBoard, createMemberAccount } from './fixtures.ts';
import { useTestApp } from './test-app.ts';

const { member, prisma } = useTestApp();
// Robin Park's account exists in every test, board or not, so `member` is signed in.
beforeEach(() => createMemberAccount(prisma));

describe('POST /api/boards/:boardId/labels', () => {
  it("adds a trimmed label after the board's last one", async () => {
    const { board, labels } = await createBoard(prisma);

    const response = await member.post(`/api/boards/${board.id}/labels`).send({ name: '  Copy  ', color: 'amber' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: expect.any(String), name: 'Copy', color: 'amber' });
    const after = await member.get(`/api/boards/${board.id}`);
    expect(after.body.labels.map((label: { id: string }) => label.id)).toEqual([labels.design.id, labels.backend.id, response.body.id]);
  });

  it.each([
    [{ name: '   ', color: 'amber' }, 'name: must not be empty'],
    [{ name: 'x'.repeat(31), color: 'amber' }, 'name: Too big: expected string to have <=30 characters'],
    [{ name: 'Copy' }, expect.stringMatching(/^color: /)],
    [{ name: 'Copy', color: 'pink' }, expect.stringMatching(/^color: /)],
    [{ name: 'Copy', color: 'amber', position: 0 }, 'Unrecognized key: "position"'],
  ])('refuses %j with a 400 naming the field', async (body, message) => {
    const { board } = await createBoard(prisma);

    const response = await member.post(`/api/boards/${board.id}/labels`).send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Bad Request', message });
  });

  it('refuses a name the board already has, in any case, with a 409', async () => {
    const { board } = await createBoard(prisma);

    const response = await member.post(`/api/boards/${board.id}/labels`).send({ name: ' design ', color: 'amber' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'Conflict', message: 'name: the board already has a label with this name' });
    expect(await prisma.label.count({ where: { boardId: board.id } })).toBe(2);
  });

  it("accepts a name another board's label has", async () => {
    const other = await createBoard(prisma, 'Other');
    await prisma.label.create({ data: { boardId: other.board.id, name: 'Copy', color: 'red', position: 2 } });
    const { board } = await createBoard(prisma);

    const response = await member.post(`/api/boards/${board.id}/labels`).send({ name: 'Copy', color: 'amber' });

    expect(response.status).toBe(201);
  });

  it('waits for a label write already under way on the board, then refuses the name it took', async () => {
    const { board } = await createBoard(prisma);
    const user = await createMemberAccount(prisma);
    let created: Promise<unknown> = Promise.resolve();

    // Another label write, part-way through: it holds the board's row and adds 'copy' before committing.
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Board" WHERE id = ${board.id} FOR UPDATE`;
      created = createLabel(prisma, user.id, board.id, { name: 'Copy', color: 'amber' });
      created.catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 200));
      await tx.label.create({ data: { boardId: board.id, name: 'copy', color: 'red', position: 2 } });
    });

    await expect(created).rejects.toMatchObject({ status: 409 });
    expect(await prisma.label.count({ where: { boardId: board.id, name: { equals: 'copy', mode: 'insensitive' } } })).toBe(1);
  });

  it('answers 404 for a board that does not exist', async () => {
    const response = await member.post('/api/boards/missing/labels').send({ name: 'Copy', color: 'amber' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No board with id missing');
  });
});

describe('PATCH /api/labels/:labelId', () => {
  it('renames and recolours the label, and every card shows it changed', async () => {
    const { board, labels } = await createBoard(prisma);

    const response = await member.patch(`/api/labels/${labels.design.id}`).send({ name: ' UX ', color: 'coral' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: labels.design.id, name: 'UX', color: 'coral' });
    const after = await member.get(`/api/boards/${board.id}`);
    expect(after.body.columns[0].cards[0].labels[0]).toEqual({ id: labels.design.id, name: 'UX', color: 'coral' });
  });

  it('changes only the fields given', async () => {
    const { labels } = await createBoard(prisma);

    const response = await member.patch(`/api/labels/${labels.design.id}`).send({ color: 'red' });

    expect(response.body).toEqual({ id: labels.design.id, name: 'Design', color: 'red' });
  });

  it("changes the case of the label's own name", async () => {
    const { labels } = await createBoard(prisma);

    const response = await member.patch(`/api/labels/${labels.design.id}`).send({ name: 'DESIGN' });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('DESIGN');
  });

  it("refuses another label's name, in any case, with a 409", async () => {
    const { labels } = await createBoard(prisma);

    const response = await member.patch(`/api/labels/${labels.design.id}`).send({ name: 'backend' });

    expect(response.status).toBe(409);
    expect(await prisma.label.findUniqueOrThrow({ where: { id: labels.design.id } })).toMatchObject({ name: 'Design' });
  });

  it.each([
    [{}, 'must change at least one field'],
    [{ name: '' }, 'name: must not be empty'],
    [{ color: 'pink' }, expect.stringMatching(/^color: /)],
  ])('refuses %j with a 400', async (body, message) => {
    const { labels } = await createBoard(prisma);

    const response = await member.patch(`/api/labels/${labels.design.id}`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(message);
  });

  it('answers 404 for a label that does not exist', async () => {
    const response = await member.patch('/api/labels/missing').send({ name: 'UX' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No label with id missing');
  });
});

describe('DELETE /api/labels/:labelId', () => {
  it('deletes the label from the board and from every card that had it', async () => {
    const { board, cards, labels } = await createBoard(prisma);

    const response = await member.delete(`/api/labels/${labels.design.id}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    const after = await member.get(`/api/boards/${board.id}`);
    expect(after.body.labels).toEqual([{ id: labels.backend.id, name: 'Backend', color: 'blue' }]);
    expect(after.body.columns[0].cards[0]).toMatchObject({ id: cards.first.id, labels: [{ id: labels.backend.id, name: 'Backend', color: 'blue' }] });
  });

  it('answers 404 for a label that does not exist', async () => {
    const response = await member.delete('/api/labels/missing');

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No label with id missing');
  });
});
