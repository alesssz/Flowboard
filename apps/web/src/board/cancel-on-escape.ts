// Escape in an in-place editor undoes the edit, and only that.
import type { KeyboardEvent } from 'react';

/** preventDefault keeps the key from also closing a dialog, or a panel around the editor. */
export function cancelOnEscape(event: KeyboardEvent<HTMLElement>, cancel: () => void): void {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  cancel();
}
