// Column writes. Each waits for the API, then puts its answer into the cached board.
import type { Column, CreateColumnRequest, UpdateColumnRequest } from '@flowboard/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendEmpty, sendJson } from '../api.ts';
import { updateBoard } from './board-cache.ts';
import { boardQuery, cardCommentsQuery } from './board-queries.ts';

export function useCreateColumn(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateColumnRequest) =>
      sendJson<Column>('POST', `/boards/${encodeURIComponent(boardId)}/columns`, request),
    onSuccess: (column) => {
      updateBoard(queryClient, boardId, (board) => ({ ...board, columns: [...board.columns, column] }));
    },
  });
}

export function useUpdateColumn(boardId: string, columnId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: UpdateColumnRequest) =>
      sendJson<Column>('PATCH', `/columns/${encodeURIComponent(columnId)}`, changes),
    onSuccess: (column) => {
      updateBoard(queryClient, boardId, (board) => ({
        ...board,
        columns: board.columns.map((existing) => (existing.id === column.id ? column : existing)),
      }));
    },
  });
}

export function useDeleteColumn(boardId: string, columnId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sendEmpty('DELETE', `/columns/${encodeURIComponent(columnId)}`),
    onSuccess: () => {
      // The API deleted the column's cards with it: their comments go from the cache too.
      const cards = queryClient.getQueryData(boardQuery(boardId).queryKey)?.columns.find((column) => column.id === columnId)?.cards ?? [];
      updateBoard(queryClient, boardId, (board) => ({
        ...board,
        columns: board.columns.filter((column) => column.id !== columnId),
      }));
      for (const card of cards) queryClient.removeQueries({ queryKey: cardCommentsQuery(card.id).queryKey });
    },
  });
}
