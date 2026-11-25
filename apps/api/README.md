# @flowboard/api

Flowboard's REST API: **Node.js 24**, **Express 5** and **TypeScript**, as native ES modules, on **PostgreSQL** through **Prisma 7**.

## Running

The API needs `apps/api/.env` (copied from [`.env.example`](.env.example)) and the development database, both set up as in the root README's [Getting started](../../README.md#getting-started). Then, from the repository root:

```powershell
pnpm dev                              # API and web app together
pnpm --filter @flowboard/api dev      # API only
```

The server listens on `127.0.0.1` port 3700 (http://localhost:3700), out of reach of other devices on the network; set `PORT` to change the port (`$env:PORT=4700` in PowerShell, or in `.env`). The web app's dev proxy targets `127.0.0.1:3700`, so update `apps/web/vite.config.ts` too. It answers only requests addressed to itself: a `Host` header other than `localhost`, `127.0.0.1`, `[::1]` or one of `ALLOWED_HOSTS` gets a `403` ([docs/security.md](../../docs/security.md)). The server starts even while the database is down; requests that need it answer `500` until it is back. Known problems: [Troubleshooting](../../README.md#troubleshooting).

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `prisma generate --no-hints && tsx watch --env-file-if-exists=.env src/index.ts` | Runs the TypeScript sources directly and restarts on change (no type-checking) |
| `build` | `prisma generate --no-hints && tsc` | Type-checks and compiles `src/` to `dist/` |
| `start` | `node --env-file-if-exists=.env dist/index.js` | Runs the compiled build |
| `typecheck` | `prisma generate --no-hints && tsc --noEmit && tsc --noEmit -p test` | Type-checks the sources, then the tests, without emitting |
| `test` | `prisma generate --no-hints && vitest run` | Runs the tests once ([Tests](#tests)); `pnpm --filter @flowboard/api exec vitest` keeps watching |
| `db:generate` | `prisma generate --no-hints` | Regenerates the Prisma client from the schema |
| `db:migrate` | `prisma migrate dev` | Applies pending migrations; after a schema change, first creates one (`--name <name>`) |
| `db:seed` | `prisma db seed` | Runs `src/db/seed.ts`: replaces every board with the sample board |
| `db:reset` | `prisma migrate reset && prisma db seed` | Drops every table, applies every migration, seeds (asks first) |
| `db:studio` | `prisma studio --port 6255` | Prisma Studio on http://localhost:6255: browse and edit the data |

`--no-hints` keeps `prisma generate` from asking a question when run from a terminal: inside `pnpm --recursive` the process would be stopped waiting for an answer, hanging `pnpm check`.

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
├── app.ts                 createApp(prisma, options): middleware, routes, JSON 404, error handler
├── security.ts            the Host check (ALLOWED_HOSTS) and the security headers, before every route
├── errors.ts              HttpError, JSON error responses (ApiError), the error-handling middleware
├── validation.ts          parseBody(): a request body against a shared Zod schema, or a 400
├── boards/
│   ├── board-routes.ts    GET /api/boards, GET /api/boards/:boardId
│   └── board-queries.ts   board reads, mapped to the @flowboard/shared types
├── columns/
│   ├── column-routes.ts   column create, update, delete
│   └── column-queries.ts  column writes; columnFields and toColumn, shared with the board query
├── cards/
│   ├── card-routes.ts     card create, update, delete; a card's comments
│   └── card-queries.ts    card reads and writes; cardFields and toCard, shared with the column and board queries
├── db/
│   ├── client.ts          PrismaClient with the PostgreSQL adapter; DATABASE_URL check
│   └── seed.ts            the sample board (pnpm db:seed)
└── generated/prisma/      generated Prisma client (gitignored)
test/
├── global-setup.ts        once per run: picks the test database, applies the migrations
├── test-app.ts            useTestApp(): the app and a Prisma client, the database emptied before each test
├── fixtures.ts            createBoard(): a board with columns, cards, labels, members and comments
├── *.test.ts              what every route shares (app, security), then one file per resource (boards,
│                          columns, cards)
└── tsconfig.json          the tests' type-check, extending the API's
vitest.config.ts           test files, global setup, one file at a time
```

`app.ts` builds the app and `index.ts` starts it, so tests can exercise `createApp()` in-process without binding a port. The Prisma client is passed in, not imported, so a test can hand it one connected to its own database.

## Endpoints

| Method | Path | Description | Response |
|---|---|---|---|
| `GET` | `/api/health` | Liveness probe; does not touch the database | `200` `{ "status": "ok", "timestamp", "uptimeSeconds" }` |
| `GET` | `/api/boards` | Every board, oldest first | `200` `BoardSummary[]` |
| `GET` | `/api/boards/:boardId` | A board with its columns and cards in display order, and the board's labels and members | `200` `Board` · `404` |
| `POST` | `/api/boards/:boardId/columns` | Adds a column after the board's last one, with no cards; body `CreateColumnRequest` | `201` `Column` · `400` · `404` |
| `PATCH` | `/api/columns/:columnId` | Renames or recolours the column; body `UpdateColumnRequest` | `200` `Column` · `400` · `404` |
| `POST` | `/api/columns/:columnId/move` | Moves the column to another place on its board; body `MoveColumnRequest` | `200` `Board` · `400` · `404` |
| `DELETE` | `/api/columns/:columnId` | Deletes the column with its cards and their comments | `204`, no body · `404` |
| `POST` | `/api/columns/:columnId/cards` | Adds a card at the bottom of the column; body `CreateCardRequest` | `201` `Card` · `400` · `404` |
| `PATCH` | `/api/cards/:cardId` | Changes the fields given; body `UpdateCardRequest` | `200` `Card` · `400` · `404` |
| `POST` | `/api/cards/:cardId/move` | Moves the card within its column or to another on the same board; body `MoveCardRequest` | `200` `Board` · `400` · `404` |
| `DELETE` | `/api/cards/:cardId` | Deletes the card and its comments | `204`, no body · `404` |
| `GET` | `/api/cards/:cardId/comments` | A card's comments, oldest first | `200` `CardComment[]` · `404` |
| any | any other path | No matching route | `404` |

Body types are in `@flowboard/shared`. Every error is an `ApiError`, `{ "error": "Not Found", "message": "No board with id …" }`:

| Status | When |
|---|---|
| `400` | Malformed JSON, or a write with no JSON body; a body that fails its schema, one `field: problem` per issue, `;`-separated (`title: must not be empty`); a label, member or column id not on the card's board |
| `403` | A `Host` header that is not the API's own (`Host not allowed`), whatever the route |
| `404` | No board, column or card with that id; no route |
| `413` | A body over 100 kB, which is not read |
| `500` | Anything unexpected: logged by the server, no details sent |

**Writes.** A `PATCH` changes only the fields present, and needs at least one. Each write runs in one transaction and answers with the column or card as it now is, so the client needs no reload. A new column goes after the board's last one, a new card after its column's last one; two created at the same moment may share a position until reordering renumbers them. Deleting a column deletes its cards and their comments (database cascades).

**Moves.** A move names the place, not a position: `index` among the column's cards (or the board's columns) counted without the item itself, so `0` is the top, and an index past the end puts it last. The move renumbers the positions of the columns it touches from 0, in one `UPDATE` per column, which also closes gaps and ties. Moves on the same columns (or, for column moves, the same board) wait for each other through row locks taken in id order, so two at once neither interleave nor deadlock. The answer is the whole board, which the web app puts in place of the order it guessed.

**Column writes.** Titles are trimmed and keep at least one character (limit: `columnTitleMaxLength` in `@flowboard/shared`). `color` is one of `paletteColors`; the API does not pick one, the client sends it.

**Card writes.** Titles and descriptions are trimmed; a title must keep at least one character (limits: `cardTitleMaxLength`, `cardDescriptionMaxLength` in `@flowboard/shared`). `dueDate` is `'YYYY-MM-DD'` or `null` to remove it. `labelIds` and `assigneeIds` replace the whole set, with no id twice; the card shows its labels in the board's order and its assignees by name, whatever the order sent.

```powershell
Invoke-RestMethod http://localhost:3700/api/boards
```

## Tests

`pnpm test` (or `make test`) runs every route through HTTP: [Supertest](https://github.com/forwardemail/supertest) sends requests to `createApp()` without opening a port, and [Vitest](https://vitest.dev/) runs the files.

- **Database.** The tests use `flowboard_test`, in the same container as the development database, which they never touch. Before the first file, the global setup applies the migrations to it (`prisma migrate deploy`, which creates it on the first run), so a new migration reaches it by itself. PostgreSQL must be up (`pnpm db:up`).
- **Isolation.** Every test starts from an empty database (`TRUNCATE "Board" CASCADE`, which reaches every table) and builds what it needs with `createBoard()`. The files share the database, so they run one at a time.
- **Safety.** A database whose name does not end in `_test` is refused before anything runs, whatever `TEST_DATABASE_URL` says.
- **Fixtures** are created out of display order (the second card before the first, the last label first), so a test of an order checks the API's sorting, not insertion order.
- A test's name states its scenario; it arranges, acts once, then asserts on the status, the body and, for writes, the rows left in the database.

## Environment variables

Set in `apps/api/.env`, documented in [`.env.example`](.env.example).

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | none, required | PostgreSQL connection URL; `.env.example` has the one for `compose.yaml`'s database |
| `PORT` | `3700` | Port the server listens on |
| `HOST` | `127.0.0.1` | Interface the server listens on: the loopback only; `0.0.0.0` in a container |
| `ALLOWED_HOSTS` | none | Host names the API answers besides `localhost`, `127.0.0.1` and `[::1]`, comma-separated, without port: the deployed domain |
| `TEST_DATABASE_URL` | the development container's `flowboard_test` | Database the tests run on; its name must end in `_test`. An environment variable, for CI: the tests never read `.env` |

## Conventions

- Request and response bodies are typed in **`@flowboard/shared`**, imported with `import type`.
- Every route lives under **`/api`**, the only prefix the web app's dev proxy forwards.
- Every response with a body is **JSON**, errors included; a `DELETE` answers `204` with none.
- What must apply to every request (`security.ts`) is mounted before `express.json()`, so a refused request is never parsed, and its answer carries the security headers too.
- Request bodies go through **`parseBody(schema, req.body)`** with a schema from `@flowboard/shared/schemas`, before anything reads them. The API has no Zod dependency of its own: `parseBody` needs only the schema's `safeParse`.
- A request that cannot be served throws **`HttpError(status, message)`** from wherever it is found (a route, a query), and the error handler answers in the `ApiError` shape.
- Queries `select` the fields a response needs and map them to the shared types in `*-queries.ts`; routes never return Prisma's objects as they are.
- Relative imports carry the **`.ts`** extension (`import { createApp } from './app.ts'`); `tsc` rewrites it to `.js` (`rewriteRelativeImportExtensions`).
- Type-only imports use **`import type`** (`verbatimModuleSyntax`).
- No `enum` or `namespace` (`erasableSyntaxOnly`): string-literal unions instead. Prisma's generated enums are `as const` objects, which comply.
