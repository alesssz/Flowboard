// Bodies of the card write requests: the Zod schemas the API checks them with, and the types clients send.
import { z } from 'zod';
import { cardDescriptionMaxLength, cardTitleMaxLength } from './limits.ts';

const cardTitle = z.string().trim().min(1, 'must not be empty').max(cardTitleMaxLength);

// Replaces the card's whole set, so the same id twice is a client error, not a duplicate link.
const idSet = z
  .array(z.string().min(1))
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, 'must not list an id twice');

/** POST /api/columns/:columnId/cards. The card goes to the bottom of the column. */
export const createCardRequestSchema = z.strictObject({
  title: cardTitle,
});

/** PATCH /api/cards/:cardId. Only the fields given change; at least one is required. */
export const updateCardRequestSchema = z
  .strictObject({
    title: cardTitle.optional(),
    description: z.string().trim().max(cardDescriptionMaxLength).optional(),
    /** 'YYYY-MM-DD', or null to remove it. */
    dueDate: z.iso.date().nullable().optional(),
    /** true marks the card completed, keeping the time it was first marked; false clears it. */
    completed: z.boolean().optional(),
    /** Ids of the board's labels; replaces the card's labels. */
    labelIds: idSet.optional(),
    /** Ids of the board's members; replaces the card's assignees. */
    assigneeIds: idSet.optional(),
  })
  .refine((changes) => Object.keys(changes).length > 0, 'must change at least one field');

/**
 * POST /api/cards/:cardId/move. The card goes to `index` among the cards of `columnId` (its own column, or
 * another on the same board), counted without the card itself; an index past the end puts it last.
 */
export const moveCardRequestSchema = z.strictObject({
  columnId: z.string().min(1),
  index: z.int().min(0),
});

export type CreateCardRequest = z.input<typeof createCardRequestSchema>;
export type UpdateCardRequest = z.input<typeof updateCardRequestSchema>;
export type MoveCardRequest = z.input<typeof moveCardRequestSchema>;
