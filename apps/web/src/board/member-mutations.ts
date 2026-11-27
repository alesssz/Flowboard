// Member writes. Each waits for the API, then puts its answer into the cached members list; a change to the
// user's own membership also reaches the cached board (their role) or the board list (leaving).
import type { BoardMember, UpdateMemberRequest } from '@flowboard/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendEmpty, sendJson } from '../api.ts';
import { updateBoard } from './board-cache.ts';
import { boardMembersQuery, boardsQuery } from './board-queries.ts';

interface RoleChange {
  member: BoardMember;
  changes: UpdateMemberRequest;
}

export function useUpdateMember(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ member, changes }: RoleChange) =>
      sendJson<BoardMember>('PATCH', `/members/${encodeURIComponent(member.id)}`, changes),
    onSuccess: (updated) => {
      queryClient.setQueryData(boardMembersQuery(boardId).queryKey, (members) =>
        members?.map((member) => (member.id === updated.id ? updated : member)),
      );
      // An owner stepping down: what the board lets them change follows at once.
      if (updated.you) updateBoard(queryClient, boardId, (board) => ({ ...board, role: updated.role }));
    },
  });
}

/** Removes a member, or, for the user's own, leaves the board: the caller then opens another board. */
export function useRemoveMember(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (member: BoardMember) => sendEmpty('DELETE', `/members/${encodeURIComponent(member.id)}`),
    onSuccess: (_answer, removed) => {
      if (removed.you) {
        queryClient.setQueryData(boardsQuery.queryKey, (boards) => boards?.filter((board) => board.id !== boardId));
        return;
      }
      queryClient.setQueryData(boardMembersQuery(boardId).queryKey, (members) =>
        members?.filter((member) => member.id !== removed.id),
      );
    },
  });
}
