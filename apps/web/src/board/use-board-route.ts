// The app's addresses: /boards/<id>, the open board, so a reload or a shared link opens the same board; and
// /invite#<token>, an invitation, its token after the #, which browsers never send to a server. The History
// API alone: the app has no other pages to route.
import { useSyncExternalStore } from 'react';

const PREFIX = '/boards/';
const INVITE_PATH = '/invite';
// pushState fires no event of its own.
const NAVIGATED = 'flowboard:navigated';

/** The board id in the address, or null on any other path, such as /. */
export function useBoardRoute(): string | null {
  return useSyncExternalStore(subscribe, readBoardId);
}

/** The invitation token in the address, or null anywhere but /invite. */
export function useInviteToken(): string | null {
  return useSyncExternalStore(subscribe, readInviteToken);
}

/** The full link an invitation's token makes, to be copied and sent. */
export function inviteLink(token: string): string {
  return `${window.location.origin}${INVITE_PATH}#${token}`;
}

// Set by openBoard for the board's title to take the focus once it shows: what the user was on is gone.
let focusRequested = false;

/** The address of a board, for links. */
export function boardPath(boardId: string): string {
  return `${PREFIX}${encodeURIComponent(boardId)}`;
}

/**
 * Puts the board in the address, as a new history entry; `replace` for one that should not be gone back to,
 * such as a deleted board's. Null is /, the user's first board.
 */
export function openBoard(boardId: string | null, { replace = false } = {}): void {
  const path = boardId === null ? '/' : boardPath(boardId);
  if (window.location.pathname === path && window.location.hash === '') return;
  focusRequested = true;
  if (replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  window.dispatchEvent(new Event(NAVIGATED));
}

/** True once after openBoard: the board's title takes the focus. */
export function takeFocusRequest(): boolean {
  const requested = focusRequested;
  focusRequested = false;
  return requested;
}

function readBoardId(): string | null {
  const { pathname } = window.location;
  if (!pathname.startsWith(PREFIX)) return null;
  const id = decodeURIComponent(pathname.slice(PREFIX.length));
  return id === '' ? null : id;
}

function readInviteToken(): string | null {
  const { pathname, hash } = window.location;
  return pathname === INVITE_PATH && hash.length > 1 ? hash.slice(1) : null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener('hashchange', onChange);
  window.addEventListener(NAVIGATED, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener(NAVIGATED, onChange);
  };
}
