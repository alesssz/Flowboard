// Board writes. Each waits for the API, then puts its answer into the cached board list and the cached board.
import type { Board, BoardSummary, CreateBoardRequest, UpdateBoardRequest } from '@flowboard/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendEmpty, sendJson } from '../api.ts';
import { updateBoard } from './board-cache.ts';
import { boardQuery, boardsQuery, cardCommentsQuery } from './board-queries.ts';

export function useCreateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateBoardRequest) => sendJson<Board>('POST', '/boards', request),
    onSuccess: (board) => {
      // Last, as the API lists boards oldest first.
      queryClient.setQueryData(boardsQuery.queryKey, (boards) => boards && [...boards, { id: board.id, title: board.title }]);
      queryClient.setQueryData(boardQuery(board.id).queryKey, board);
    },
  });
}

export function useRenameBoard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdateBoardRequest) =>
      sendJson<BoardSummary>('PATCH', `/boards/${encodeURIComponent(boardId)}`, request),
    onSuccess: ({ title }) => {
      queryClient.setQueryData(boardsQuery.queryKey, (boards) =>
        boards?.map((board) => (board.id === boardId ? { ...board, title } : board)),
      );
      updateBoard(queryClient, boardId, (board) => ({ ...board, title }));
    },
  });
}

export function useDeleteBoard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sendEmpty('DELETE', `/boards/${encodeURIComponent(boardId)}`),
    onSuccess: () => {
      const cards = queryClient.getQueryData(boardQuery(boardId).queryKey)?.columns.flatMap((column) => column.cards) ?? [];
      queryClient.setQueryData(boardsQuery.queryKey, (boards) => boards?.filter((board) => board.id !== boardId));
      // Once the caller has moved to another board: a query removed while still shown would be fetched again.
      setTimeout(() => {
        for (const queryKey of [boardQuery(boardId).queryKey, ...cards.map((card) => cardCommentsQuery(card.id).queryKey)]) {
          queryClient.removeQueries({ queryKey, exact: true, type: 'inactive' });
        }
      });
    },
  });
}
