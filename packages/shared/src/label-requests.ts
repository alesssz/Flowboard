// Bodies of the label write requests: the Zod schemas the API checks them with, and the types clients send.
import { z } from 'zod';
import { labelNameMaxLength } from './limits.ts';
import { paletteColors } from './palette.ts';

const labelName = z.string().trim().min(1, 'must not be empty').max(labelNameMaxLength);
const labelColor = z.enum(paletteColors);

/** POST /api/boards/:boardId/labels. The label goes after the board's last one. */
export const createLabelRequestSchema = z.strictObject({
  name: labelName,
  color: labelColor,
});

/** PATCH /api/labels/:labelId. Only the fields given change; at least one is required. */
export const updateLabelRequestSchema = z
  .strictObject({
    name: labelName.optional(),
    color: labelColor.optional(),
  })
  .refine((changes) => Object.keys(changes).length > 0, 'must change at least one field');

export type CreateLabelRequest = z.input<typeof createLabelRequestSchema>;
export type UpdateLabelRequest = z.input<typeof updateLabelRequestSchema>;
