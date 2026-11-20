// Requests to the API: relative /api URLs, JSON bodies, failures thrown as ApiRequestError.
import type { ApiError } from '@flowboard/shared';

/** A response with an error status; `message` is the API's own when it sent one. */
export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

/** GET `/api${path}`. */
export async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { headers: { Accept: 'application/json' }, signal });
  } catch (error) {
    // An abort is TanStack Query cancelling the request: it must reach it unchanged.
    if (signal?.aborted) throw error;
    // fetch's own message ('Failed to fetch', 'Load failed') differs by browser and says little.
    throw new Error('The server cannot be reached', { cause: error });
  }

  if (!response.ok) {
    // The dev proxy answers 5xx with no JSON body while the API is down.
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(response.status, body?.message ?? `The server responded with status ${response.status}`);
  }

  // Unchecked cast until responses are validated against shared schemas.
  return (await response.json()) as T;
}

/** 4xx: asking again gets the same answer. */
export function isClientError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status >= 400 && error.status < 500;
}
