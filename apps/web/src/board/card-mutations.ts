// Card writes. Each waits for the API, then puts its answer into the cached board, so every view of
// the card updates without reloading the board.
import type { Card, CreateCardRequest, UpdateCardRequest } from '@flowboard/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendDelete, sendJson } from '../api.ts';
import { updateBoard } from './board-cache.ts';
import { cardCommentsQuery } from './board-queries.ts';

export function useCreateCard(boardId: string, columnId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateCardRequest) =>
      sendJson<Card>('POST', `/columns/${encodeURIComponent(columnId)}/cards`, request),
    onSuccess: (card) => {
      updateBoard(queryClient, boardId, (board) => ({
        ...board,
        columns: board.columns.map((column) =>
          column.id === columnId ? { ...column, cards: [...column.cards, card] } : column,
        ),
      }));
    },
  });
}

export function useUpdateCard(boardId: string, cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: UpdateCardRequest) =>
      sendJson<Card>('PATCH', `/cards/${encodeURIComponent(cardId)}`, changes),
    onSuccess: (card) => {
      updateBoard(queryClient, boardId, (board) => ({
        ...board,
        columns: board.columns.map((column) => ({
          ...column,
          cards: column.cards.map((existing) => (existing.id === card.id ? card : existing)),
        })),
      }));
    },
  });
}

export function useDeleteCard(boardId: string, cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sendDelete(`/cards/${encodeURIComponent(cardId)}`),
    onSuccess: () => {
      updateBoard(queryClient, boardId, (board) => ({
        ...board,
        columns: board.columns.map((column) => ({
          ...column,
          cards: column.cards.filter((card) => card.id !== cardId),
        })),
      }));
      queryClient.removeQueries({ queryKey: cardCommentsQuery(cardId).queryKey });
    },
  });
}
