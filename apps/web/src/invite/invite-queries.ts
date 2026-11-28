// The invitation in the address: what it invites to, and joining. The token goes in request bodies only.
import type { BoardSummary, InvitationPreview } from '@flowboard/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { sendJson } from '../api.ts';
import { boardsQuery } from '../board/board-queries.ts';

// A read sent as POST, to keep the token out of URLs. Never refetched: what it shows changes only by joining.
export function invitationPreviewQuery(token: string) {
  return queryOptions({
    queryKey: ['invitations', 'preview', token],
    queryFn: () => sendJson<InvitationPreview>('POST', '/invitations/preview', { token }),
    staleTime: Infinity,
  });
}

export function useAcceptInvitation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sendJson<BoardSummary>('POST', '/invitations/accept', { token }),
    onSuccess: (board) => {
      // The API lists boards by their age, not by when the user joined: at the end until the list is read again.
      queryClient.setQueryData(boardsQuery.queryKey, (boards) => boards && [...boards, board]);
      void queryClient.invalidateQueries({ queryKey: boardsQuery.queryKey, exact: true });
    },
  });
}
