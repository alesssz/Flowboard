// Bodies of the comment write requests: the Zod schemas the API checks them with, and the types clients send.
import { z } from 'zod';
import { commentBodyMaxLength } from './limits.ts';

// Trimmed at both ends; line breaks inside are kept.
const body = z.string().trim().min(1, 'must not be empty').max(commentBodyMaxLength);

/** POST /api/cards/:cardId/comments. The signed-in user is the author. */
export const createCommentRequestSchema = z.strictObject({ body });

/** PATCH /api/comments/:commentId. Its author only. */
export const updateCommentRequestSchema = z.strictObject({ body });

export type CreateCommentRequest = z.input<typeof createCommentRequestSchema>;
export type UpdateCommentRequest = z.input<typeof updateCommentRequestSchema>;
