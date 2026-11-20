# @flowboard/api

Flowboard's REST API: **Node.js 24**, **Express 5** and **TypeScript**, as native ES modules, on **PostgreSQL** through **Prisma 7**.

## Running

The API needs `apps/api/.env` (copied from [`.env.example`](.env.example)) and the development database, both set up as in the root README's [Getting started](../../README.md#getting-started). Then, from the repository root:

```powershell
pnpm dev                              # API and web app together
pnpm --filter @flowboard/api dev      # API only
```

The server listens on http://localhost:3700; set `PORT` to change it (`$env:PORT=4700` in PowerShell, or in `.env`). The web app's dev proxy targets port 3700, so update `apps/web/vite.config.ts` too. The server starts even while the database is down; requests that need it answer `500` until it is back. Known problems: [Troubleshooting](../../README.md#troubleshooting).

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `prisma generate && tsx watch --env-file-if-exists=.env src/index.ts` | Runs the TypeScript sources directly and restarts on change (no type-checking) |
| `build` | `prisma generate && tsc` | Type-checks and compiles `src/` to `dist/` |
| `start` | `node --env-file-if-exists=.env dist/index.js` | Runs the compiled build |
| `typecheck` | `prisma generate && tsc --noEmit` | Type-checks without emitting |
| `db:generate` | `prisma generate` | Regenerates the Prisma client from the schema |
| `db:migrate` | `prisma migrate dev` | Applies pending migrations; after a schema change, first creates one (`--name <name>`) |
| `db:seed` | `prisma db seed` | Runs `src/db/seed.ts`: replaces every board with the sample board |
| `db:reset` | `prisma migrate reset && prisma db seed` | Drops every table, applies every migration, seeds (asks first) |
| `db:studio` | `prisma studio --port 6255` | Prisma Studio on http://localhost:6255: browse and edit the data |

The root `package.json` forwards the `db:` scripts (`pnpm db:migrate`) and adds `db:up` and `db:down`, which start and stop the database container.

## Database

- **Schema**: [`prisma/schema.prisma`](prisma/schema.prisma). A change to it is followed by `pnpm db:migrate --name <what-changed>`, which writes a migration to `prisma/migrations/` and applies it; the migration is committed with the schema.
- **Configuration**: [`prisma.config.ts`](prisma.config.ts) points the CLI at the schema, the migrations and the seed, and reads `DATABASE_URL` from `.env`. The Prisma 7 CLI loads no `.env` by itself.
- **Client**: generated into `src/generated/prisma/` (gitignored) by every script that runs or compiles the code, so a fresh clone or CI needs no extra step and no database. It connects through the `node-postgres` driver adapter (`@prisma/adapter-pg`).
- **Install script**: `@prisma/engines` downloads the schema engine that `migrate` runs, so it is allowlisted in `pnpm-workspace.yaml`.
- **Order**: rows carry an integer `position` among their siblings (columns on a board, cards in a column, labels on a board). Queries sort by it; the API returns arrays in that order and never the positions.
- **Deletes** cascade from a board to everything on it.

## Structure

```
prisma/
├── schema.prisma          models, enum, relations, indexes
└── migrations/            SQL migrations, applied in order
prisma.config.ts           Prisma CLI configuration
src/
├── index.ts               entry point: configuration, listen, graceful shutdown (SIGINT/SIGTERM)
├── app.ts                 createApp(prisma): middleware, routes, JSON 404, error handler
├── errors.ts              JSON error responses (ApiError) and the error-handling middleware
├── boards/
│   ├── board-routes.ts    /api/boards and /api/cards/:cardId/comments
│   └── board-queries.ts   Prisma queries, mapped to the @flowboard/shared types
├── db/
│   ├── client.ts          PrismaClient with the PostgreSQL adapter; DATABASE_URL check
│   └── seed.ts            the sample board (pnpm db:seed)
└── generated/prisma/      generated Prisma client (gitignored)
```

`app.ts` builds the app and `index.ts` starts it, so tests can exercise `createApp()` in-process without binding a port. The Prisma client is passed in, not imported, so a test can hand it one connected to its own database.

## Endpoints

| Method | Path | Description | Response |
|---|---|---|---|
| `GET` | `/api/health` | Liveness probe; does not touch the database | `200` `{ "status": "ok", "timestamp", "uptimeSeconds" }` |
| `GET` | `/api/boards` | Every board, oldest first | `200` `BoardSummary[]` |
| `GET` | `/api/boards/:boardId` | A board with its columns and cards, in display order | `200` `Board` · `404` |
| `GET` | `/api/cards/:cardId/comments` | A card's comments, oldest first | `200` `CardComment[]` · `404` |
| any | any other path | No matching route | `404` |

Body types are in `@flowboard/shared`. Every error is an `ApiError`, `{ "error": "Not Found", "message": "No board with id …" }`: `400` for a malformed JSON body, `404`, and `500` for anything unexpected, logged by the server with no details sent.

```powershell
Invoke-RestMethod http://localhost:3700/api/boards
```

## Environment variables

Set in `apps/api/.env`, documented in [`.env.example`](.env.example).

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | none, required | PostgreSQL connection URL; `.env.example` has the one for `compose.yaml`'s database |
| `PORT` | `3700` | Port the server listens on |

## Conventions

- Request and response bodies are typed in **`@flowboard/shared`**, imported with `import type`.
- Every route lives under **`/api`**, the only prefix the web app's dev proxy forwards.
- Every response is **JSON**, errors included.
- Queries `select` the fields a response needs and map them to the shared types in `*-queries.ts`; routes never return Prisma's objects as they are.
- Relative imports carry the **`.ts`** extension (`import { createApp } from './app.ts'`); `tsc` rewrites it to `.js` (`rewriteRelativeImportExtensions`).
- Type-only imports use **`import type`** (`verbatimModuleSyntax`).
- No `enum` or `namespace` (`erasableSyntaxOnly`): string-literal unions instead. Prisma's generated enums are `as const` objects, which comply.
