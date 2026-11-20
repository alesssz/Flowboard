// Public entry point of @flowboard/shared: the types and limits both apps use. The schemas are in ./schemas.ts.
export type {
  Board,
  BoardSummary,
  Card,
  CardComment,
  Column,
  Label,
  Member,
  PaletteColor,
} from './board.ts';
export type { CreateCardRequest, UpdateCardRequest } from './card-requests.ts';
export type { ApiError } from './error.ts';
export type { HealthResponse } from './health.ts';
export { cardDescriptionMaxLength, cardTitleMaxLength } from './limits.ts';
