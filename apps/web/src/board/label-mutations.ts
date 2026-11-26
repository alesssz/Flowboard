// Label writes. Each waits for the API, then puts its answer into the cached board: the board's labels, and
// the labels of every card that has the label.
import type { Board, CreateLabelRequest, Label, UpdateLabelRequest } from '@flowboard/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendEmpty, sendJson } from '../api.ts';
import { updateBoard } from './board-cache.ts';

export function useCreateLabel(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateLabelRequest) => sendJson<Label>('POST', `/boards/${encodeURIComponent(boardId)}/labels`, request),
    onSuccess: (label) => {
      updateBoard(queryClient, boardId, (board) => ({ ...board, labels: [...board.labels, label] }));
    },
  });
}

interface LabelChanges {
  labelId: string;
  changes: UpdateLabelRequest;
}

export function useUpdateLabel(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ labelId, changes }: LabelChanges) => sendJson<Label>('PATCH', `/labels/${encodeURIComponent(labelId)}`, changes),
    onSuccess: (label) => {
      const replace = (labels: Label[]) => labels.map((existing) => (existing.id === label.id ? label : existing));
      updateBoard(queryClient, boardId, (board) => withCardLabels({ ...board, labels: replace(board.labels) }, replace));
    },
  });
}

export function useDeleteLabel(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => sendEmpty('DELETE', `/labels/${encodeURIComponent(labelId)}`),
    onSuccess: (_answer, labelId) => {
      const remove = (labels: Label[]) => labels.filter((label) => label.id !== labelId);
      updateBoard(queryClient, boardId, (board) => withCardLabels({ ...board, labels: remove(board.labels) }, remove));
    },
  });
}

function withCardLabels(board: Board, change: (labels: Label[]) => Label[]): Board {
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards.map((card) => ({ ...card, labels: change(card.labels) })),
    })),
  };
}
