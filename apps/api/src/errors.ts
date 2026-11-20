// Error responses in the API's JSON shape (ApiError), and the handler for errors thrown by routes.
import { STATUS_CODES } from 'node:http';
import type { ApiError } from '@flowboard/shared';
import type { ErrorRequestHandler, Response } from 'express';

export function sendError(res: Response, status: number, message: string): void {
  const body: ApiError = { error: STATUS_CODES[status] ?? 'Error', message };
  res.status(status).json(body);
}

/**
 * Last middleware. Errors from the request itself (malformed JSON, a body over the limit) carry
 * their 4xx status; anything else is a 500, logged, with no details sent to the client.
 */
export const handleError: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  // A response already under way can only be cut off, which Express's own handler does.
  if (res.headersSent) {
    next(error);
    return;
  }

  const status = clientErrorStatus(error);
  if (status !== undefined && error instanceof Error) {
    sendError(res, status, error.message);
    return;
  }

  console.error(error);
  sendError(res, 500, 'The server could not complete the request');
};

// Express's body parsers set `status` on the errors they throw.
function clientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const { status } = error;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}
