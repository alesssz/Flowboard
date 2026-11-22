// Public entry point of @flowboard/shared: the types, limits and palette both apps use. The schemas are in ./schemas.ts.
export type { Board, BoardSummary, Card, CardComment, Column, Label, Member } from './board.ts';
export type { CreateCardRequest, UpdateCardRequest } from './card-requests.ts';
export type { CreateColumnRequest, UpdateColumnRequest } from './column-requests.ts';
export type { ApiError } from './error.ts';
export type { HealthResponse } from './health.ts';
export { cardDescriptionMaxLength, cardTitleMaxLength, columnTitleMaxLength } from './limits.ts';
export { type PaletteColor, paletteColors } from './palette.ts';
