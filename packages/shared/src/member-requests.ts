// Bodies of the member write requests: the Zod schemas the API checks them with, and the types clients send.
import { z } from 'zod';
import { memberRoles } from './roles.ts';

/** PATCH /api/members/:memberId. Only an owner changes a role; the board keeps at least one owner. */
export const updateMemberRequestSchema = z.strictObject({
  role: z.enum(memberRoles),
});

export type UpdateMemberRequest = z.input<typeof updateMemberRequestSchema>;
