// A board as the web app shows it: columns left to right, cards top to bottom.
// Array order is display order; how positions are stored is up to the API.

export interface Board {
  id: string;
  title: string;
  columns: Column[];
}

export interface Column {
  id: string;
  title: string;
  /** Lane colour, chosen per column; it says nothing about the column's meaning. */
  color: PaletteColor;
  cards: Card[];
}

export interface Card {
  id: string;
  title: string;
  /** Plain text; empty when the card has none. */
  description: string;
  /** In display order; empty when the card has none. */
  labels: Label[];
  /** Calendar day as `YYYY-MM-DD`, with no time or time zone; null when the card has none. */
  dueDate: string | null;
  /** The people working on the card, in display order; empty when nobody is. */
  assignees: Member[];
}

export interface Label {
  id: string;
  name: string;
  color: PaletteColor;
}

/** Someone who can be assigned to a board's cards. */
export interface Member {
  id: string;
  /** Full name; the web app shows its initials. */
  name: string;
  /** Avatar colour. */
  color: PaletteColor;
}

/** The colours a user can pick for columns, labels and avatars; the web app has shades of each for both themes. */
export type PaletteColor = 'gray' | 'coral' | 'red' | 'amber' | 'green' | 'blue' | 'violet';
