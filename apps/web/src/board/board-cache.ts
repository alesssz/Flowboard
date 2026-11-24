// The cached board, changed by the write hooks once the API has answered, so every view updates without
// reloading it; and the moves, also applied before the API answers (optimistic updates).
import type { Board } from '@flowboard/shared';
import type { QueryClient } from '@tanstack/react-query';
import { boardQuery } from './board-queries.ts';

/** Applies `change` to the cached board; nothing happens while the board is not cached. */
export function updateBoard(queryClient: QueryClient, boardId: string, change: (board: Board) => Board): void {
  queryClient.setQueryData(boardQuery(boardId).queryKey, (board) => (board === undefined ? undefined : change(board)));
}

/**
 * The board with the card at `index` among the cards of `columnId`, counted without the card itself; past
 * the end puts it last. The same rule as the API's move, so the guess shown before it answers matches.
 */
export function moveCardInBoard(board: Board, cardId: string, columnId: string, index: number): Board {
  const card = board.columns.flatMap((column) => column.cards).find((candidate) => candidate.id === cardId);
  if (card === undefined) return board;
  return {
    ...board,
    columns: board.columns.map((column) => {
      const cards = column.cards.filter((candidate) => candidate.id !== cardId);
      if (column.id === columnId) cards.splice(Math.min(index, cards.length), 0, card);
      return cards.length === column.cards.length && column.id !== columnId ? column : { ...column, cards };
    }),
  };
}

/** The board with the column at `index` among its columns; past the end puts it last. */
export function moveColumnInBoard(board: Board, columnId: string, index: number): Board {
  const column = board.columns.find((candidate) => candidate.id === columnId);
  if (column === undefined) return board;
  const columns = board.columns.filter((candidate) => candidate.id !== columnId);
  columns.splice(Math.min(index, columns.length), 0, column);
  return { ...board, columns };
}
