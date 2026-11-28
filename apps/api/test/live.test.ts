// Live updates through real connections: who may connect and follow a board, and which writes tell whom.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type LiveClientEvents, type LiveServerEvents, liveSocketHeader, liveSocketPath } from '@flowboard/shared';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { createLive } from '../src/live/live.ts';
import { createAccount, createBoard, createMemberAccount, memberCookie } from './fixtures.ts';
import { useTestApp } from './test-app.ts';

const { prisma } = useTestApp();

type Client = Socket<LiveServerEvents, LiveClientEvents>;

let server: Server;
let closeLive: () => Promise<void>;
let base: string;
let api: ReturnType<typeof request>;
const clients: Client[] = [];

beforeEach(async () => {
  await createMemberAccount(prisma);
  const live = createLive(prisma);
  const app = createApp(prisma, { live: live.live });
  server = createServer(app);
  live.attach(server);
  closeLive = live.close;
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  api = request(base);
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.close();
  await closeLive();
});

/**
 * A connection with these headers; rejects when it is refused: 'websocket error' (or 'xhr poll error' over
 * polling) for a handshake refused before the upgrade, the server's reason for one refused after it.
 */
function connect(headers: Record<string, string>, transport: 'websocket' | 'polling' = 'websocket'): Promise<Client> {
  const client: Client = io(base, { path: liveSocketPath, transports: [transport], extraHeaders: headers, reconnection: false, forceNew: true });
  clients.push(client);
  return new Promise((resolve, reject) => {
    client.on('connect', () => resolve(client));
    client.on('connect_error', reject);
  });
}

const asRobin = () => connect({ Cookie: memberCookie });

/** The next notice of that kind within a second, or 'none'. */
function nextNotice(client: Client, event: keyof LiveServerEvents, ms = 1000): Promise<unknown> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('none'), ms);
    (client as Socket).once(event, (notice: unknown) => {
      clearTimeout(timer);
      resolve(notice);
    });
  });
}

/** The board, with Alex Moreno given an account and the editor role: someone else following it. */
async function boardWithAlex() {
  const fixture = await createBoard(prisma);
  const alex = await createAccount(prisma, 'Alex Moreno', 'alex@example.com');
  await prisma.member.update({ where: { id: fixture.members.alex.id }, data: { userId: alex.id, role: 'editor' } });
  return { ...fixture, alex };
}

describe('connecting', () => {
  it('refuses a connection without a session', async () => {
    await expect(connect({})).rejects.toThrow('Not signed in');
  });

  it('refuses a connection opened by a page of another site, before the upgrade', async () => {
    await expect(connect({ Cookie: memberCookie, Origin: 'https://evil.example' })).rejects.toThrow('websocket error');
    await expect(connect({ Cookie: memberCookie, Origin: 'https://evil.example' }, 'polling')).rejects.toThrow('xhr poll error');
  });

  // Over WebSocket only: Node's polling client does not send a Host header of the caller's.
  it("refuses a Host that is not the API's own, before the upgrade", async () => {
    await expect(connect({ Cookie: memberCookie, Host: 'evil.example' })).rejects.toThrow('websocket error');
  });

  it('accepts its own origin', async () => {
    const client = await connect({ Cookie: memberCookie, Origin: 'http://localhost:5873' });

    expect(client.connected).toBe(true);
  });
});

describe('board:watch', () => {
  it("follows a board of the user's, and refuses another user's as if it did not exist", async () => {
    const mine = await createBoard(prisma, 'Mine');
    const theirs = await createBoard(prisma, 'Theirs', { ofAnotherUser: true });
    const client = await asRobin();

    expect(await client.emitWithAck('board:watch', mine.board.id)).toEqual({ ok: true });
    expect(await client.emitWithAck('board:watch', theirs.board.id)).toEqual({ ok: false, error: `No board with id ${theirs.board.id}` });
  });

  it('closes a connection whose session has ended', async () => {
    const { board } = await createBoard(prisma);
    const client = await asRobin();
    const closed = new Promise((resolve) => client.on('disconnect', resolve));
    await prisma.session.deleteMany();

    expect(await client.emitWithAck('board:watch', board.id)).toEqual({ ok: false, error: 'Not signed in' });
    await closed;
  });
});

describe('notices', () => {
  it("tells the board's other followers that it changed, but not the connection that wrote", async () => {
    const { board, cards, alex } = await boardWithAlex();
    const writer = await asRobin();
    const otherTab = await asRobin();
    const alexClient = await connect({ Cookie: alex.cookie });
    for (const client of [writer, otherTab, alexClient]) await client.emitWithAck('board:watch', board.id);
    const heard = [writer, otherTab, alexClient].map((client) => nextNotice(client, 'board:changed'));

    const response = await api.patch(`/api/cards/${cards.first.id}`).set('Cookie', memberCookie).set(liveSocketHeader, writer.id ?? '').send({ title: 'Renamed' });

    expect(response.status).toBe(200);
    expect(await Promise.all(heard)).toEqual(['none', { boardId: board.id }, { boardId: board.id }]);
  });

  it("does not skip a connection the writer names but does not own", async () => {
    const { board, cards, alex } = await boardWithAlex();
    const alexClient = await connect({ Cookie: alex.cookie });
    await alexClient.emitWithAck('board:watch', board.id);
    const heard = nextNotice(alexClient, 'board:changed');

    await api.patch(`/api/cards/${cards.first.id}`).set('Cookie', memberCookie).set(liveSocketHeader, alexClient.id ?? '').send({ title: 'Renamed' });

    expect(await heard).toEqual({ boardId: board.id });
  });

  it("tells nothing to followers of another board, nor of a write that was refused", async () => {
    const first = await createBoard(prisma, 'First');
    const second = await createBoard(prisma, 'Second');
    const client = await asRobin();
    await client.emitWithAck('board:watch', second.board.id);
    const heard = nextNotice(client, 'board:changed', 500);

    await api.patch(`/api/cards/${first.cards.first.id}`).set('Cookie', memberCookie).send({ title: 'Renamed' });
    await api.patch(`/api/cards/${second.cards.first.id}`).set('Cookie', memberCookie).send({ title: '' });

    expect(await heard).toBe('none');
  });

  it("tells which card's comments changed", async () => {
    const { board, cards, alex } = await boardWithAlex();
    const alexClient = await connect({ Cookie: alex.cookie });
    await alexClient.emitWithAck('board:watch', board.id);
    const heard = nextNotice(alexClient, 'comments:changed');

    await api.post(`/api/cards/${cards.first.id}/comments`).set('Cookie', memberCookie).send({ body: 'Hello' });

    expect(await heard).toEqual({ boardId: board.id, cardId: cards.first.id });
  });

  it('tells a removed member once, then nothing more', async () => {
    const { board, cards, members, alex } = await boardWithAlex();
    const alexClient = await connect({ Cookie: alex.cookie });
    await alexClient.emitWithAck('board:watch', board.id);
    const told = nextNotice(alexClient, 'board:changed');

    await api.delete(`/api/members/${members.alex.id}`).set('Cookie', memberCookie);
    expect(await told).toEqual({ boardId: board.id });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const after = nextNotice(alexClient, 'board:changed', 500);
    await api.patch(`/api/cards/${cards.first.id}`).set('Cookie', memberCookie).send({ title: 'Renamed' });

    expect(await after).toBe('none');
  });

  it('tells the followers of a deleted board, which then has none', async () => {
    const { board, alex } = await boardWithAlex();
    const alexClient = await connect({ Cookie: alex.cookie });
    await alexClient.emitWithAck('board:watch', board.id);
    const told = nextNotice(alexClient, 'board:changed');

    await api.delete(`/api/boards/${board.id}`).set('Cookie', memberCookie);

    expect(await told).toEqual({ boardId: board.id });
    expect(alexClient.connected).toBe(true);
  });
});

describe('signing out', () => {
  it("closes the session's connections", async () => {
    const client = await asRobin();
    const closed = new Promise((resolve) => client.on('disconnect', resolve));

    await api.post('/api/auth/sign-out').set('Cookie', memberCookie);

    await closed;
    expect(client.connected).toBe(false);
  });
});
