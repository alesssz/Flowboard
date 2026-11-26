// Field limits: enforced by the request schemas, and given to the web app's inputs as maxLength.
// Kept free of Zod, so importing them does not bring the schemas into the browser bundle.

/** Longest card title, in characters, after trimming. */
export const cardTitleMaxLength = 200;

/** Longest card description, in characters, after trimming. */
export const cardDescriptionMaxLength = 10_000;

/** Longest comment, in characters, after trimming. */
export const commentBodyMaxLength = 5_000;

/** Longest column title, in characters, after trimming. */
export const columnTitleMaxLength = 100;

/** Shortest password at sign-up, in characters: NIST SP 800-63B-4's minimum for a password used alone. */
export const passwordMinLength = 15;

/** Longest password, in characters: room for any passphrase, a bound on the work of hashing it. */
export const passwordMaxLength = 256;

/** Longest email address, in characters (RFC 5321's limit on a path). */
export const emailMaxLength = 254;

/** Longest display name, in characters, after trimming. */
export const userNameMaxLength = 100;
