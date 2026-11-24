// Bodies of the column write requests: the Zod schemas the API checks them with, and the types clients send.
import { z } from 'zod';
import { columnTitleMaxLength } from './limits.ts';
import { paletteColors } from './palette.ts';

const columnTitle = z.string().trim().min(1, 'must not be empty').max(columnTitleMaxLength);
const columnColor = z.enum(paletteColors);

/** POST /api/boards/:boardId/columns. The column goes after the board's last one, with no cards. */
export const createColumnRequestSchema = z.strictObject({
  title: columnTitle,
  color: columnColor,
});

/** PATCH /api/columns/:columnId. Only the fields given change; at least one is required. */
export const updateColumnRequestSchema = z
  .strictObject({
    title: columnTitle.optional(),
    color: columnColor.optional(),
  })
  .refine((changes) => Object.keys(changes).length > 0, 'must change at least one field');

/** POST /api/columns/:columnId/move. The column goes to `index` among the board's columns; past the end puts it last. */
export const moveColumnRequestSchema = z.strictObject({
  index: z.int().min(0),
});

export type CreateColumnRequest = z.input<typeof createColumnRequestSchema>;
export type UpdateColumnRequest = z.input<typeof updateColumnRequestSchema>;
export type MoveColumnRequest = z.input<typeof moveColumnRequestSchema>;
