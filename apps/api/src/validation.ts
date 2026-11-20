// Request bodies checked against the shared Zod schemas: a mismatch is a 400 naming each wrong field.
import { HttpError } from './errors.ts';

// The part of a Zod schema used here, so the API needs no Zod import of its own.
interface Schema<T> {
  safeParse(
    data: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: readonly Issue[] } };
}

interface Issue {
  path: readonly PropertyKey[];
  message: string;
}

/** The parsed body (trimmed, as the schema says), or an HttpError 400 such as "title: must not be empty". */
export function parseBody<T>(schema: Schema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  const message = result.error.issues
    .map((issue) => (issue.path.length === 0 ? issue.message : `${issue.path.map(String).join('.')}: ${issue.message}`))
    .join('; ');
  throw new HttpError(400, message);
}
