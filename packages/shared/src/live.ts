// Live updates: the Socket.IO events between the API and the web app, and where they travel. Notices carry
// ids only, never a board's content: the web app reads that again through the API, which checks each request.

/** The Socket.IO path, under /api so it shares the API's origin and the dev proxy. */
export const liveSocketPath = '/api/socket.io';

/** Sent with each write: the writer's own connection, which the notice of that write skips. */
export const liveSocketHeader = 'X-Flowboard-Socket';

export type WatchAnswer = { ok: true } | { ok: false; error: string };

export interface LiveClientEvents {
  /** Follow the board's notices, and stop following any other; null stops following. */
  'board:watch': (boardId: string | null, answer: (result: WatchAnswer) => void) => void;
}

export interface LiveServerEvents {
  /** Something on the board changed: its title, columns, cards, labels or members; or it is gone. */
  'board:changed': (notice: { boardId: string }) => void;
  /** A card's comments changed, and the card's comment count with them. */
  'comments:changed': (notice: { boardId: string; cardId: string }) => void;
}
