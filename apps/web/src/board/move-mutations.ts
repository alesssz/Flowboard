// Moves of cards and columns. Unlike the other writes they show at once (optimistic update), as a dragged
// card must stay where it was dropped; a refused move puts the board back as it was before it.
import type { Board, MoveCardRequest, MoveColumnRequest } from '@flowboard/shared';
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { sendJson } from '../api.ts';
import { moveCardInBoard, moveColumnInBoard, updateBoard } from './board-cache.ts';
import { boardQuery } from './board-queries.ts';

export interface MoveCardVariables extends MoveCardRequest {
  cardId: string;
}

export interface MoveColumnVariables extends MoveColumnRequest {
  columnId: string;
}

// One key for every move on a board, so a move's answer can tell whether others are still on their way.
function moveKey(boardId: string) {
  return ['boards', boardId, 'move'] as const;
}

export function useMoveCard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: moveKey(boardId),
    mutationFn: ({ cardId, ...request }: MoveCardVariables) =>
      sendJson<Board>('POST', `/cards/${encodeURIComponent(cardId)}/move`, request),
    onMutate: ({ cardId, columnId, index }) =>
      applyMove(queryClient, boardId, (board) => moveCardInBoard(board, cardId, columnId, index)),
    onError: (_error, _variables, previous) => restore(queryClient, boardId, previous),
    onSuccess: (board) => settle(queryClient, boardId, board),
  });
}

export function useMoveColumn(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: moveKey(boardId),
    mutationFn: ({ columnId, ...request }: MoveColumnVariables) =>
      sendJson<Board>('POST', `/columns/${encodeURIComponent(columnId)}/move`, request),
    onMutate: ({ columnId, index }) => applyMove(queryClient, boardId, (board) => moveColumnInBoard(board, columnId, index)),
    onError: (_error, _variables, previous) => restore(queryClient, boardId, previous),
    onSuccess: (board) => settle(queryClient, boardId, board),
  });
}

// Synchronous, with the refetch cancelled rather than awaited: the dragged item must not flash back to
// its old place for a frame between the drop and the cache update. Returns the board before the move.
function applyMove(queryClient: QueryClient, boardId: string, move: (board: Board) => Board): Board | undefined {
  const { queryKey } = boardQuery(boardId);
  void queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData(queryKey);
  updateBoard(queryClient, boardId, move);
  return previous;
}

function restore(queryClient: QueryClient, boardId: string, previous: Board | undefined) {
  if (previous !== undefined) queryClient.setQueryData(boardQuery(boardId).queryKey, previous);
}

// The API's board replaces the guess, unless more moves are on their way: it does not have them yet, and
// would put their cards back for a moment. The last move to answer brings the board up to date.
function settle(queryClient: QueryClient, boardId: string, board: Board) {
  if (queryClient.isMutating({ mutationKey: moveKey(boardId) }) === 1) {
    queryClient.setQueryData(boardQuery(boardId).queryKey, board);
  }
}
