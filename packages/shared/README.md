# @flowboard/shared

What the web app and the API agree on: the types of every request and response body, the field limits, and the Zod schemas the API validates request bodies with.

## Entry points

| Import | Contents | Used by |
|---|---|---|
| `@flowboard/shared` | Types (`Board`, `Card`, `UpdateCardRequest`…) and limits (`cardTitleMaxLength`…) | both apps |
| `@flowboard/shared/schemas` | Zod schemas of the request bodies (`createCardRequestSchema`, `updateCardRequestSchema`) | the API |

```ts
import { type Card, cardTitleMaxLength } from '@flowboard/shared';
import { updateCardRequestSchema } from '@flowboard/shared/schemas';
```

The schemas have their own entry point so the web app never bundles Zod: the main entry point imports no Zod at runtime (request types are `export type` from the schema module, erased at compile time), and the limits live in a module of their own. Request types are derived from the schemas (`z.input<typeof schema>`), so a body's type and its validation cannot drift apart.

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
├── index.ts           main entry point: types and limits
├── schemas.ts         @flowboard/shared/schemas: the Zod schemas
├── board.ts           Board, BoardSummary, Column, Card, CardComment, Label, Member, PaletteColor
├── card-requests.ts   card request schemas, and CreateCardRequest, UpdateCardRequest
├── limits.ts          field limits, free of Zod
├── error.ts           ApiError, the body of every API error response
└── health.ts          HealthResponse (GET /api/health)
```
