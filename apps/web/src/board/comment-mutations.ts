// Comment writes. Each waits for the API, then puts its answer into the card's cached comments, and keeps the
// card's comment count on the cached board in step.
import type { CardComment, CreateCommentRequest, UpdateCommentRequest } from '@flowboard/shared';
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { sendEmpty, sendJson } from '../api.ts';
import { updateBoard } from './board-cache.ts';
import { cardCommentsQuery } from './board-queries.ts';

export function useCreateComment(boardId: string, cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateCommentRequest) =>
      sendJson<CardComment>('POST', `/cards/${encodeURIComponent(cardId)}/comments`, request),
    onSuccess: (comment) => {
      updateComments(queryClient, cardId, (comments) => [...comments, comment]);
      changeCount(queryClient, boardId, cardId, 1);
    },
  });
}

export function useUpdateComment(cardId: string, commentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: UpdateCommentRequest) =>
      sendJson<CardComment>('PATCH', `/comments/${encodeURIComponent(commentId)}`, changes),
    onSuccess: (comment) => {
      updateComments(queryClient, cardId, (comments) => comments.map((existing) => (existing.id === comment.id ? comment : existing)));
    },
  });
}

export function useDeleteComment(boardId: string, cardId: string, commentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sendEmpty('DELETE', `/comments/${encodeURIComponent(commentId)}`),
    onSuccess: () => {
      updateComments(queryClient, cardId, (comments) => comments.filter((comment) => comment.id !== commentId));
      changeCount(queryClient, boardId, cardId, -1);
    },
  });
}

// Nothing happens while the comments are not cached: the next read brings them.
function updateComments(queryClient: QueryClient, cardId: string, change: (comments: CardComment[]) => CardComment[]): void {
  queryClient.setQueryData(cardCommentsQuery(cardId).queryKey, (comments) => (comments === undefined ? undefined : change(comments)));
}

function changeCount(queryClient: QueryClient, boardId: string, cardId: string, by: number): void {
  updateBoard(queryClient, boardId, (board) => ({
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards.map((card) => (card.id === cardId ? { ...card, commentCount: card.commentCount + by } : card)),
    })),
  }));
}
