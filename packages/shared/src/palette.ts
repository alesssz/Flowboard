// The colours a user can pick for columns, labels and avatars; the web app has shades of each for both themes.
// Kept free of Zod, like limits.ts: the web app imports the list for its colour pickers.

/** In the order colour pickers show them. The database's PaletteColor enum must list the same values. */
export const paletteColors = ['gray', 'coral', 'red', 'amber', 'green', 'blue', 'violet'] as const;

export type PaletteColor = (typeof paletteColors)[number];
