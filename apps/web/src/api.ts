// Requests to the API: relative /api URLs, JSON bodies, failures thrown as errors with a readable message.
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
  const response = await request(path, { headers: { Accept: 'application/json' }, signal });
  // Unchecked cast until responses are validated against shared schemas.
  return (await response.json()) as T;
}

/** POST or PATCH `/api${path}` with a JSON body; resolves to the JSON the API answers with. */
export async function sendJson<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> {
  const response = await request(path, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

/** POST or DELETE `/api${path}` with no body, to a route that answers 204 with none. */
export async function sendEmpty(method: 'POST' | 'DELETE', path: string): Promise<void> {
  await request(path, { method, headers: { Accept: 'application/json' } });
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch (error) {
    // An abort is TanStack Query cancelling the request: it must reach it unchanged.
    if (init.signal?.aborted) throw error;
    // fetch's own message ('Failed to fetch', 'Load failed') differs by browser and says little.
    throw new Error('The server cannot be reached', { cause: error });
  }

  if (!response.ok) {
    // The dev proxy answers 5xx with no JSON body while the API is down.
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(response.status, body?.message ?? `The server responded with status ${response.status}`);
  }
  return response;
}

/** 4xx: asking again gets the same answer. */
export function isClientError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status >= 400 && error.status < 500;
}
