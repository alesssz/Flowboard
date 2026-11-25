// Bodies of the account requests: the Zod schemas the API checks them with, and the types clients send.
import { z } from 'zod';
import { emailMaxLength, passwordMaxLength, passwordMinLength, userNameMaxLength } from './limits.ts';

// Lowercased, so one address cannot hold two accounts by changing case.
const email = z.string().trim().toLowerCase().max(emailMaxLength).pipe(z.email('must be an email address'));

/** POST /api/auth/sign-up. The password is kept exactly as typed: spaces count. */
export const signUpRequestSchema = z.strictObject({
  email,
  name: z.string().trim().min(1, 'must not be empty').max(userNameMaxLength),
  password: z
    .string()
    .min(passwordMinLength, `must be at least ${passwordMinLength} characters`)
    .max(passwordMaxLength),
});

/** POST /api/auth/sign-in. No minimum length: a rule raised later must not lock out older passwords. */
export const signInRequestSchema = z.strictObject({
  email,
  password: z.string().min(1, 'must not be empty').max(passwordMaxLength),
});

export type SignUpRequest = z.input<typeof signUpRequestSchema>;
export type SignInRequest = z.input<typeof signInRequestSchema>;
