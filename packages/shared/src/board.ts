// A board as the web app shows it: columns left to right, cards top to bottom.
// Array order is display order; how positions are stored is up to the API.
import type { PaletteColor } from './palette.ts';

export interface Board {
  id: string;
  title: string;
  columns: Column[];
  /** Every label of the board, in display order: the ones a card can be given. */
  labels: Label[];
  /** Everyone on the board, by name: the people a card can be assigned to. */
  members: Member[];
}

/** A board in the board list, without its content. */
export interface BoardSummary {
  id: string;
  title: string;
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
  /** How many comments the card has; the comments themselves come with the card's detail. */
  commentCount: number;
}

/** A comment on a card. Named CardComment because the DOM already has a global Comment type. */
export interface CardComment {
  id: string;
  author: Member;
  /** Plain text; line breaks are kept. */
  body: string;
  /** ISO 8601 instant in UTC, e.g. '2026-11-18T09:30:00.000Z'. */
  createdAt: string;
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
