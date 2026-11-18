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
  color: ColumnColor;
  cards: Card[];
}

/** A closed palette: the web app has a light and a dark shade for each. */
export type ColumnColor = 'gray' | 'coral' | 'red' | 'blue' | 'green';

export interface Card {
  id: string;
  title: string;
  /** Plain text; empty when the card has none. */
  description: string;
}
