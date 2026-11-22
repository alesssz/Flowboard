// The cached board, changed by the write hooks once the API has answered, so every view updates without
// reloading it.
import type { Board } from '@flowboard/shared';
import type { QueryClient } from '@tanstack/react-query';
import { boardQuery } from './board-queries.ts';

/** Applies `change` to the cached board; nothing happens while the board is not cached. */
export function updateBoard(queryClient: QueryClient, boardId: string, change: (board: Board) => Board): void {
  queryClient.setQueryData(boardQuery(boardId).queryKey, (board) => (board === undefined ? undefined : change(board)));
}
