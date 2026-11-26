// Who is signed in, the writes that change it (sign up, sign in, sign out), and a session ending while in use.
import type { SignInRequest, SignUpRequest, User } from '@flowboard/shared';
import { type QueryClient, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, fetchJson, sendEmpty, sendJson } from '../api.ts';

/** This browser's user. `ended`: a request was refused for want of a session while the app was in use. */
export type SessionState = { status: 'signed-in'; user: User } | { status: 'signed-out'; ended: boolean };

export const meQuery = queryOptions({
  queryKey: ['auth', 'me'],
  queryFn: async ({ client, queryKey, signal }): Promise<SessionState> => {
    try {
      return { status: 'signed-in', user: await fetchJson<User>('/auth/me', signal) };
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
      // Refetched on focus too: a 401 after being signed in, or after another request found the session
      // ended, still means it ended while in use.
      const previous = client.getQueryData<SessionState>(queryKey);
      const ended = previous?.status === 'signed-in' || (previous?.status === 'signed-out' && previous.ended);
      return { status: 'signed-out', ended };
    }
  },
});

export function useSignUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SignUpRequest) => sendJson<User>('POST', '/auth/sign-up', request),
    onSuccess: (user) => showAs(queryClient, { status: 'signed-in', user }),
  });
}

export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SignInRequest) => sendJson<User>('POST', '/auth/sign-in', request),
    onSuccess: (user) => showAs(queryClient, { status: 'signed-in', user }),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sendEmpty('POST', '/auth/sign-out'),
    onSuccess: () => showAs(queryClient, { status: 'signed-out', ended: false }),
  });
}

/**
 * For every query and mutation that fails (main.tsx): a 401 while signed in means the session has ended
 * (expired, or signed out from elsewhere), so the sign-in page replaces whatever was on screen.
 */
export function handleSessionEnded(queryClient: QueryClient, error: unknown): void {
  if (!isUnauthorized(error)) return;
  // Signed out already: a 401 is the sign-in form's own answer (a wrong password).
  if (queryClient.getQueryData(meQuery.queryKey)?.status !== 'signed-in') return;
  showAs(queryClient, { status: 'signed-out', ended: true });
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401;
}

// Everything else in the cache was read as the previous user (or as nobody): it goes, so the next
// user never sees it, not even for the moment a refetch takes. Once React has swapped the page: removed
// while the old page still reads them, they would be fetched again at once. Inactive ones only, so the
// new page's own queries stay.
function showAs(queryClient: QueryClient, state: SessionState): void {
  queryClient.setQueryData(meQuery.queryKey, state);
  setTimeout(() => {
    queryClient.removeQueries({ type: 'inactive', predicate: (query) => query.queryKey[0] !== meQuery.queryKey[0] });
  });
}
