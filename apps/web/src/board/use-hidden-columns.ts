// The columns this browser hides on a board: a personal view, kept in localStorage per board, so hiding a
// column never hides it from anyone else. Ids of columns deleted since are ignored by the callers.
import { useState } from 'react';

export function useHiddenColumns(boardId: string) {
  const key = `flowboard:hidden-columns:${boardId}`;
  const [hiddenIds, setState] = useState(() => read(key));

  function setHiddenIds(ids: string[]) {
    setState(ids);
    write(key, ids);
  }

  return { hiddenIds, setHiddenIds };
}

function read(key: string): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    // Storage blocked by the browser, or an entry that is not JSON: every column shows.
    return [];
  }
}

function write(key: string, ids: string[]) {
  try {
    if (ids.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Storage blocked or full: the view still changes, and lasts until the page reloads.
  }
}
