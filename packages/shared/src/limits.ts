// Field limits: enforced by the request schemas, and given to the web app's inputs as maxLength.
// Kept free of Zod, so importing them does not bring the schemas into the browser bundle.

/** Longest card title, in characters, after trimming. */
export const cardTitleMaxLength = 200;

/** Longest card description, in characters, after trimming. */
export const cardDescriptionMaxLength = 10_000;

/** Longest column title, in characters, after trimming. */
export const columnTitleMaxLength = 100;
