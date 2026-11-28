// Invitation writes, an owner's. Each waits for the API, then puts its answer into the cached invitations.
import type { CreatedInvitation, CreateInvitationRequest } from '@flowboard/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendEmpty, sendJson } from '../api.ts';
import { boardInvitationsQuery } from './board-queries.ts';

/** The answer carries the link's token, which no later read gives back. */
export function useCreateInvitation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateInvitationRequest) =>
      sendJson<CreatedInvitation>('POST', `/boards/${encodeURIComponent(boardId)}/invitations`, request),
    onSuccess: ({ invitation }) => {
      queryClient.setQueryData(boardInvitationsQuery(boardId).queryKey, (invitations) => invitations && [invitation, ...invitations]);
    },
  });
}

export function useRevokeInvitation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => sendEmpty('DELETE', `/invitations/${encodeURIComponent(invitationId)}`),
    onSuccess: (_answer, invitationId) => {
      queryClient.setQueryData(boardInvitationsQuery(boardId).queryKey, (invitations) =>
        invitations?.filter((invitation) => invitation.id !== invitationId),
      );
    },
  });
}
