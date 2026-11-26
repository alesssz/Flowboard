// Who is signed in, and the writes that change it: sign up, sign in, sign out.
import type { SignInRequest, SignUpRequest, User } from '@flowboard/shared';
import { type QueryClient, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, fetchJson, sendEmpty, sendJson } from '../api.ts';

/** The signed-in user, or null when this browser has no session (the API's 401). */
export const meQuery = queryOptions({
  queryKey: ['auth', 'me'],
  queryFn: async ({ signal }): Promise<User | null> => {
    try {
      return await fetchJson<User>('/auth/me', signal);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) return null;
      throw error;
    }
  },
});

export function useSignUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SignUpRequest) => sendJson<User>('POST', '/auth/sign-up', request),
    onSuccess: (user) => showAs(queryClient, user),
  });
}

export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SignInRequest) => sendJson<User>('POST', '/auth/sign-in', request),
    onSuccess: (user) => showAs(queryClient, user),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sendEmpty('POST', '/auth/sign-out'),
    onSuccess: () => showAs(queryClient, null),
  });
}

// Everything else in the cache was read as the previous user (or as nobody): it goes, so the next
// user never sees it, not even for the moment a refetch takes.
function showAs(queryClient: QueryClient, user: User | null): void {
  queryClient.setQueryData(meQuery.queryKey, user);
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meQuery.queryKey[0] });
}
