// Bodies of the board write requests: the Zod schemas the API checks them with, and the types clients send.
import { z } from 'zod';
import { boardTitleMaxLength } from './limits.ts';

const boardTitle = z.string().trim().min(1, 'must not be empty').max(boardTitleMaxLength);

/** POST /api/boards. The user becomes its member; it starts with the columns To do, In progress and Done. */
export const createBoardRequestSchema = z.strictObject({
  title: boardTitle,
});

/** PATCH /api/boards/:boardId. */
export const updateBoardRequestSchema = z.strictObject({
  title: boardTitle,
});

export type CreateBoardRequest = z.input<typeof createBoardRequestSchema>;
export type UpdateBoardRequest = z.input<typeof updateBoardRequestSchema>;
