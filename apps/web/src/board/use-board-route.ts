// The open board in the address bar, /boards/<id>, so a reload or a shared link opens the same board.
// The History API alone: the app has no other pages to route.
import { useSyncExternalStore } from 'react';

const PREFIX = '/boards/';
// pushState fires no event of its own.
const NAVIGATED = 'flowboard:navigated';

/** The board id in the address, or null on any other path, such as /. */
export function useBoardRoute(): string | null {
  return useSyncExternalStore(subscribe, readBoardId);
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
  if (window.location.pathname === path) return;
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

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAVIGATED, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAVIGATED, onChange);
  };
}
