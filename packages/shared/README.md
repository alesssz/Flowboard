# @flowboard/shared

What the web app and the API agree on: the types of every request and response body, the field limits, the colour palette, and the Zod schemas the API validates request bodies with.

## Entry points

| Import | Contents | Used by |
|---|---|---|
| `@flowboard/shared` | Types (`Board`, `Card`, `User`, `UpdateCardRequest`…), limits (`cardTitleMaxLength`, `passwordMinLength`…), the palette (`paletteColors`) and the roles (`memberRoles`) | both apps |
| `@flowboard/shared/schemas` | Zod schemas of the request bodies (`createColumnRequestSchema`, `updateCardRequestSchema`, `signUpRequestSchema`…) | the API |

```ts
import { type Card, cardTitleMaxLength } from '@flowboard/shared';
import { updateCardRequestSchema } from '@flowboard/shared/schemas';
```

The schemas have their own entry point so the web app never bundles Zod: the main entry point imports no Zod at runtime (request types are `export type` from the schema module, erased at compile time), and the limits, the palette and the roles live in modules of their own. Request types are derived from the schemas (`z.input<typeof schema>`), so a body's type and its validation cannot drift apart.

## How it is consumed

The package has no build step: `exports` points at the TypeScript sources, and each consumer runs them with its own toolchain.

| Consumer | How it runs the sources |
|---|---|
| Web app | Vite compiles them into the bundle |
| API, development | tsx |
| API, `tsc` | Type-checks them; emits nothing for them, as they are an external package |
| API, production (`node dist/index.js`) | Node 24 strips the types itself. The workspace link resolves to `packages/shared/src`, outside `node_modules`, where Node allows it |

This holds while the sources use only erasable TypeScript (`erasableSyntaxOnly`: no `enum`, `namespace` or parameter properties) and relative imports with the `.ts` extension.

Zod is a dependency of this package, not of the apps: the API reaches it through the schemas.

## Scripts

| Script | Command | Description |
|---|---|---|
| `typecheck` | `tsc --noEmit` | Type-checks the sources (run by `pnpm typecheck` before the apps) |

## Structure

```
src/
├── index.ts               main entry point: types, limits, palette and roles
├── schemas.ts             @flowboard/shared/schemas: the Zod schemas
├── board.ts               Board, BoardSummary, Column, Card, CardComment, Label, Member, BoardMember
├── auth.ts                User, the signed-in user
├── auth-requests.ts       sign-up and sign-in schemas, and SignUpRequest, SignInRequest
├── board-requests.ts      board request schemas, and CreateBoardRequest, UpdateBoardRequest
├── column-requests.ts     column request schemas, and CreateColumnRequest, UpdateColumnRequest
├── card-requests.ts       card request schemas, and CreateCardRequest, UpdateCardRequest
├── comment-requests.ts    comment request schemas, and CreateCommentRequest, UpdateCommentRequest
├── invitation.ts          Invitation, CreatedInvitation, InvitationPreview
├── invitation-requests.ts invitation request schemas, and CreateInvitationRequest, InvitationTokenRequest
├── label-requests.ts      label request schemas, and CreateLabelRequest, UpdateLabelRequest
├── member-requests.ts     the member request schema, and UpdateMemberRequest
├── limits.ts              field and password limits, free of Zod
├── palette.ts             paletteColors and PaletteColor, free of Zod; mirrored by the database enum
├── roles.ts               memberRoles and MemberRole, free of Zod; mirrored by the database enum
├── error.ts               ApiError, the body of every API error response
└── health.ts              HealthResponse (GET /api/health)
```
