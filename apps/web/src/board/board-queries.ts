// TanStack Query options for the board's data: each query's cache key beside the request that fills it.
import type { Board, BoardMember, BoardSummary, CardComment } from '@flowboard/shared';
import { queryOptions } from '@tanstack/react-query';
import { fetchJson } from '../api.ts';

export const boardsQuery = queryOptions({
  queryKey: ['boards'],
  queryFn: ({ signal }) => fetchJson<BoardSummary[]>('/boards', signal),
});

export function boardQuery(boardId: string) {
  return queryOptions({
    queryKey: ['boards', boardId],
    queryFn: ({ signal }) => fetchJson<Board>(`/boards/${encodeURIComponent(boardId)}`, signal),
  });
}

export function boardMembersQuery(boardId: string) {
  return queryOptions({
    queryKey: ['boards', boardId, 'members'],
    queryFn: ({ signal }) => fetchJson<BoardMember[]>(`/boards/${encodeURIComponent(boardId)}/members`, signal),
  });
}

export function cardCommentsQuery(cardId: string) {
  return queryOptions({
    queryKey: ['cards', cardId, 'comments'],
    queryFn: ({ signal }) => fetchJson<CardComment[]>(`/cards/${encodeURIComponent(cardId)}/comments`, signal),
  });
}
