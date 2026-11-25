// The signed-in user, as the account routes return it.

export interface User {
  id: string;
  /** Trimmed and lowercased. */
  email: string;
  name: string;
}
