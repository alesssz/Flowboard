// The signed-in user's role on the open board, given by BoardView to the parts that hide what it cannot change.
// The API refuses those changes anyway (403): this only keeps the controls away.
import type { MemberRole } from '@flowboard/shared';
import { createContext, useContext } from 'react';

export const BoardRoleContext = createContext<MemberRole>('viewer');

/** Columns, cards and labels: an owner's or an editor's. */
export function useCanEdit(): boolean {
  return useContext(BoardRoleContext) !== 'viewer';
}

/** The board's title, its deletion and its members. */
export function useIsOwner(): boolean {
  return useContext(BoardRoleContext) === 'owner';
}
