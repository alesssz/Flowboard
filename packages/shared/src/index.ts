// Public entry point of @flowboard/shared: the types, limits and palette both apps use. The schemas are in ./schemas.ts.
export type { User } from './auth.ts';
export type { SignInRequest, SignUpRequest } from './auth-requests.ts';
export type { Board, BoardSummary, Card, CardComment, Column, Label, Member } from './board.ts';
export type { CreateCardRequest, MoveCardRequest, UpdateCardRequest } from './card-requests.ts';
export type { CreateColumnRequest, MoveColumnRequest, UpdateColumnRequest } from './column-requests.ts';
export type { ApiError } from './error.ts';
export type { HealthResponse } from './health.ts';
export {
  cardDescriptionMaxLength,
  cardTitleMaxLength,
  columnTitleMaxLength,
  emailMaxLength,
  passwordMaxLength,
  passwordMinLength,
  userNameMaxLength,
} from './limits.ts';
export { type PaletteColor, paletteColors } from './palette.ts';
