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
| `db:seed` | `prisma db seed` | Runs `src/db/seed.ts`: replaces every board with the sample board, and creates the demo account (`demo@flowboard.local`, password `flowboard`) or resets its name and password |
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
- **Deletes** cascade from a board to everything on it. Deleting a user unlinks their members (`userId` set to null) and keeps them.
- **Accounts**: a `User` has an email (stored trimmed and lowercased, unique), a name and a scrypt password hash (`src/auth/passwords.ts`). A `Session` is a signed-in browser: its id is the SHA-256 of the cookie's token, and it ends after 7 days unused or 30 days after sign-in; deleting a user deletes their sessions. A board's `Member` links to at most one user, and a user to at most one member per board ([docs/security.md](../../docs/security.md#accounts)).

## Structure

```
prisma/
├── schema.prisma          models, enum, relations, indexes
└── migrations/            SQL migrations, applied in order
prisma.config.ts           Prisma CLI configuration
src/
├── index.ts               entry point: configuration, listen, graceful shutdown (SIGINT/SIGTERM)
├── app.ts                 createApp(prisma, options): middleware, routes, JSON 404, error handler
├── security.ts            the Host and Origin checks (ALLOWED_HOSTS) and the security headers, before every route
├── auth/
│   ├── auth-routes.ts     sign up, sign in, sign out, GET /api/auth/me; the limits on attempts
│   ├── sessions.ts        startSession, readSession, endSession: the Session rows and the cookie
│   ├── require-session.ts requireSession, in front of the board, column, card, comment and label routes;
│   │                      signedInUser
│   ├── rate-limit.ts      RateLimiter: attempts per key in fixed windows, in memory
│   └── passwords.ts       hashPassword, verifyPassword, needsRehash: scrypt, stored as a PHC string
├── errors.ts              HttpError, JSON error responses (ApiError), the error-handling middleware
├── validation.ts          parseBody(): a request body against a shared Zod schema, or a 400
├── boards/
│   ├── access.ts          memberOf, editorOf, ownerOf, cardOf, commentOf: what a user may reach and change,
│   │                      filtered in every query; refuseByRole, the 403
│   ├── board-routes.ts    the user's boards, one board; create, rename, delete
│   └── board-queries.ts   board reads and writes, mapped to the @flowboard/shared types
├── columns/
│   ├── column-routes.ts   column create, update, delete
│   └── column-queries.ts  column writes; columnFields and toColumn, shared with the board query
├── cards/
│   ├── card-routes.ts     card create, update, delete
│   └── card-queries.ts    card reads and writes; cardFields and toCard, shared with the column and board queries
├── comments/
│   ├── comment-routes.ts  a card's comments; write one; edit or delete one's own
│   └── comment-queries.ts comment reads and writes, with the author check
├── members/
│   ├── member-routes.ts   a board's members; change a role; remove a member, or leave
│   └── member-queries.ts  member reads and writes, keeping an owner on every board
├── labels/
│   ├── label-routes.ts    label create, update, delete
│   └── label-queries.ts   label writes, with the check that a name is free on the board
├── db/
│   ├── client.ts          PrismaClient with the PostgreSQL adapter; DATABASE_URL check
│   └── seed.ts            the sample board and the demo account (pnpm db:seed)
└── generated/prisma/      generated Prisma client (gitignored)
test/
├── global-setup.ts        once per run: picks the test database, applies the migrations
├── test-app.ts            useTestApp(): the app with and without a session (member, api) and a Prisma
│                          client, the database emptied before each test
├── fixtures.ts            createBoard(): a board with columns, cards, labels, members and comments, one
│                          member signed in by memberCookie; createMemberAccount()
├── *.test.ts              what every route shares (app, security), accounts and sessions (auth), who may
│                          reach a board (permissions), one file per resource (boards, columns, cards,
│                          comments, labels), and password hashing (passwords)
└── tsconfig.json          the tests' type-check, extending the API's
vitest.config.ts           test files, global setup, one file at a time
```

`app.ts` builds the app and `index.ts` starts it, so tests can exercise `createApp()` in-process without binding a port. The Prisma client is passed in, not imported, so a test can hand it one connected to its own database.

## Endpoints

| Method | Path | Description | Response |
|---|---|---|---|
| `GET` | `/api/health` | Liveness probe; does not touch the database | `200` `{ "status": "ok", "timestamp", "uptimeSeconds" }` |
| `POST` | `/api/auth/sign-up` | Creates an account and signs it in; body `SignUpRequest` | `201` `User`, with the session cookie · `400` · `409` · `429` |
| `POST` | `/api/auth/sign-in` | Signs in, ending any session the browser held; body `SignInRequest` | `200` `User`, with the session cookie · `400` · `401` · `429` |
| `POST` | `/api/auth/sign-out` | Ends the browser's session and clears its cookie | `204`, no body, with or without a session |
| `GET` | `/api/auth/me` | The signed-in user | `200` `User` · `401` |
| `GET` | `/api/boards` | The boards the user is a member of, oldest first | `200` `BoardSummary[]` |
| `POST` | `/api/boards` | Creates a board with the user as its member and the columns To do, In progress and Done; body `CreateBoardRequest` | `201` `Board` · `400` |
| `GET` | `/api/boards/:boardId` | A board with its columns and cards in display order, and the board's labels and members | `200` `Board` · `404` |
| `PATCH` | `/api/boards/:boardId` | Renames the board; body `UpdateBoardRequest` | `200` `BoardSummary` · `400` · `404` |
| `DELETE` | `/api/boards/:boardId` | Deletes the board with its columns, cards, comments, labels and members | `204`, no body · `404` |
| `POST` | `/api/boards/:boardId/columns` | Adds a column after the board's last one, with no cards; body `CreateColumnRequest` | `201` `Column` · `400` · `404` |
| `PATCH` | `/api/columns/:columnId` | Renames or recolours the column; body `UpdateColumnRequest` | `200` `Column` · `400` · `404` |
| `POST` | `/api/columns/:columnId/move` | Moves the column to another place on its board; body `MoveColumnRequest` | `200` `Board` · `400` · `404` |
| `DELETE` | `/api/columns/:columnId` | Deletes the column with its cards and their comments | `204`, no body · `404` |
| `POST` | `/api/columns/:columnId/cards` | Adds a card at the bottom of the column; body `CreateCardRequest` | `201` `Card` · `400` · `404` |
| `PATCH` | `/api/cards/:cardId` | Changes the fields given; body `UpdateCardRequest` | `200` `Card` · `400` · `404` |
| `POST` | `/api/cards/:cardId/move` | Moves the card within its column or to another on the same board; body `MoveCardRequest` | `200` `Board` · `400` · `404` |
| `DELETE` | `/api/cards/:cardId` | Deletes the card and its comments | `204`, no body · `404` |
| `GET` | `/api/cards/:cardId/comments` | A card's comments, oldest first, each saying whether it is the user's (`mine`) | `200` `CardComment[]` · `404` |
| `POST` | `/api/cards/:cardId/comments` | Adds a comment by the user's member on the board; body `CreateCommentRequest` | `201` `CardComment` · `400` · `404` |
| `PATCH` | `/api/comments/:commentId` | Changes the body of one's own comment, and sets `editedAt`; body `UpdateCommentRequest` | `200` `CardComment` · `400` · `403` · `404` |
| `DELETE` | `/api/comments/:commentId` | Deletes one's own comment | `204`, no body · `403` · `404` |
| `POST` | `/api/boards/:boardId/labels` | Adds a label after the board's last one; body `CreateLabelRequest` | `201` `Label` · `400` · `404` · `409` |
| `PATCH` | `/api/labels/:labelId` | Renames or recolours the label, on every card that has it; body `UpdateLabelRequest` | `200` `Label` · `400` · `404` · `409` |
| `DELETE` | `/api/labels/:labelId` | Deletes the label, which leaves every card that had it | `204`, no body · `404` |
| `GET` | `/api/boards/:boardId/members` | The board's members with an account, by name, with their roles, and which one is the user (`you`) | `200` `BoardMember[]` · `404` |
| `PATCH` | `/api/members/:memberId` | Changes a member's role; body `UpdateMemberRequest` | `200` `BoardMember` · `400` · `403` · `404` · `409` |
| `DELETE` | `/api/members/:memberId` | Takes the member's account off the board: an owner removing them, or the user leaving | `204`, no body · `403` · `404` · `409` |
| any | any other path | No matching route | `404` |

Body types are in `@flowboard/shared`. Every error is an `ApiError`, `{ "error": "Not Found", "message": "No board with id …" }`:

| Status | When |
|---|---|
| `400` | Malformed JSON, or a write with no JSON body; a body that fails its schema, one `field: problem` per issue, `;`-separated (`title: must not be empty`); a label, member or column id not on the card's board |
| `401` | Wrong email or password, the same answer for both; no session, or one that has ended (`Not signed in`), on `/api/auth/me` and on every board, column, card, comment and label route |
| `403` | A `Host` header that is not the API's own (`Host not allowed`), whatever the route; a write whose `Origin` is another site's (`Origin not allowed`); a write the user's role does not allow on a board they can see (a viewer changing columns, cards or labels; anyone but an owner renaming or deleting the board, changing a role or removing someone else); editing or deleting someone else's comment |
| `404` | No board, column, card, comment, label or member (with an account) with that id on a board the user is a member of: another user's answers as one that does not exist; no route |
| `409` | Sign-up with an email that already has an account, in any case; a label name the board already has, in any case; a role change or a removal that would leave the board without an owner |
| `413` | A body over 100 kB, which is not read |
| `429` | Too many sign-ups and sign-ins from one address (100 in 15 minutes), or failed sign-ins for one email (10 in 15 minutes, counted from zero after a success); `Retry-After` gives the seconds to wait |
| `500` | Anything unexpected: logged by the server, no details sent |

**Writes.** A `PATCH` changes only the fields present, and needs at least one. Each write runs in one transaction and answers with the column or card as it now is, so the client needs no reload. A new column goes after the board's last one, a new card after its column's last one; two created at the same moment may share a position until reordering renumbers them. Deleting a column deletes its cards and their comments (database cascades).

**Moves.** A move names the place, not a position: `index` among the column's cards (or the board's columns) counted without the item itself, so `0` is the top, and an index past the end puts it last. The move renumbers the positions of the columns it touches from 0, in one `UPDATE` per column, which also closes gaps and ties. Moves on the same columns (or, for column moves, the same board) wait for each other through row locks taken in id order, so two at once neither interleave nor deadlock. The answer is the whole board, which the web app puts in place of the order it guessed.

**Board writes.** Titles are trimmed and keep at least one character (limit: `boardTitleMaxLength` in `@flowboard/shared`). A new board's member, its owner, is the user, under their account's name, with an avatar colour derived from their id, the same on every board they create; it starts with the columns To do (gray), In progress (blue) and Done (green), and no labels. Deleting a board deletes its comments first, in the same transaction, as their authors' `NoAction` would stop the cascade; columns, cards, labels and members go with the board.

**Column writes.** Titles are trimmed and keep at least one character (limit: `columnTitleMaxLength` in `@flowboard/shared`). `color` is one of `paletteColors`; the API does not pick one, the client sends it.

**Card writes.** Titles and descriptions are trimmed; a title must keep at least one character (limits: `cardTitleMaxLength`, `cardDescriptionMaxLength` in `@flowboard/shared`). `dueDate` is `'YYYY-MM-DD'` or `null` to remove it. `completed: true` sets `completedAt` to the time of the request, or keeps it when the card is already completed; `false` clears it. `labelIds` and `assigneeIds` replace the whole set, with no id twice; the card shows its labels in the board's order and its assignees by name, whatever the order sent.

**Comment writes.** A body is trimmed at both ends, keeps its line breaks, and must keep at least one character (limit: `commentBodyMaxLength` in `@flowboard/shared`). The author is the user's member on the card's board, never a field of the request. Only the author may change or delete a comment; a change sets `editedAt`.

**Label writes.** Names are trimmed and keep at least one character (limit: `labelNameMaxLength` in `@flowboard/shared`), and are unique on a board whatever their case: another label's name is a `409`, its own in another case is a rename. Label writes on the same board wait for each other through a lock on the board's row, so two at once cannot both take a name. `color` is one of `paletteColors`, sent by the client. A label's place among the board's labels is the order it was created in. Deleting a label takes it off every card (database cascade on the link table).

**Member writes.** A role is `owner`, `editor` or `viewer` (`memberRoles` in `@flowboard/shared`). Only an owner changes a role, their own included, and removes another member; anyone leaves. A board keeps at least one owner with an account: the change that would take the last one away is a `409`. Member writes on the same board wait for each other through a lock on the board's row, taken before anything is read, so two owners stepping down at once cannot both succeed. Removing a member, or leaving, unlinks their account (`userId` set to null) without deleting the member, so their name stays on their comments and cards; members without an account are not listed, and have no role to change.

**Accounts.** Emails are trimmed and lowercased; names are trimmed. A password is kept exactly as typed, 15 to 256 characters at sign-up (`passwordMinLength`, `passwordMaxLength`); sign-in checks no minimum, so a rule raised later does not lock out older passwords. Sign-up and sign-in set the session cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, 30 days; named `flowboard_session` over plain HTTP on the loopback (development), and `__Host-flowboard_session`, `Secure`, everywhere else. Design and reasons: [docs/security.md](../../docs/security.md#accounts).

**Permissions.** Every route under `/api/boards`, `/api/columns`, `/api/cards`, `/api/comments`, `/api/labels` and `/api/members` needs a session (`requireSession`, mounted in `app.ts`; a new kind of resource adds its path there), and reaches only the boards the user is a member of (`memberOf` in `boards/access.ts`): each query filters on it while it reads or writes, so a check and a write never drift apart, and another user's board, column, card, comment, label or member is a `404`. Writes filter on the role they need in the same way: `editorOf` (owner or editor) for columns, cards and labels, `ownerOf` for the board's title, its deletion and roles. When a filtered write finds nothing, `refuseByRole` tells the two cases apart: a member whose role does not allow it gets a `403` (they can see the board, so there is nothing to hide), anyone else the `404`. Any member, viewers included, reads the board and comments; only the author edits or deletes a comment (`403`). The threats this covers and their tests: [docs/security.md](../../docs/security.md#defences).

```powershell
Invoke-RestMethod http://localhost:3700/api/boards
```

## Tests

`pnpm test` (or `make test`) runs every route through HTTP: [Supertest](https://github.com/forwardemail/supertest) sends requests to `createApp()` without opening a port, and [Vitest](https://vitest.dev/) runs the files.

- **Database.** The tests use `flowboard_test`, in the same container as the development database, which they never touch. Before the first file, the global setup applies the migrations to it (`prisma migrate deploy`, which creates it on the first run), so a new migration reaches it by itself. PostgreSQL must be up (`pnpm db:up`).
- **Isolation.** Every test starts from an empty database (`TRUNCATE "Board", "User" CASCADE`, which reaches every table) and builds what it needs with `createBoard()`. The files share the database, so they run one at a time.
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
- A board, column or card query takes the signed-in user's id (`signedInUser(res).id`) and filters on `memberOf(userId)`: through the board's members, never an id from the request alone.
- What must apply to every request (`security.ts`) is mounted before `express.json()`, so a refused request is never parsed, and its answer carries the security headers too.
- Request bodies go through **`parseBody(schema, req.body)`** with a schema from `@flowboard/shared/schemas`, before anything reads them. The API has no Zod dependency of its own: `parseBody` needs only the schema's `safeParse`.
- A request that cannot be served throws **`HttpError(status, message)`** from wherever it is found (a route, a query), and the error handler answers in the `ApiError` shape.
- Queries `select` the fields a response needs and map them to the shared types in `*-queries.ts`; routes never return Prisma's objects as they are.
- Relative imports carry the **`.ts`** extension (`import { createApp } from './app.ts'`); `tsc` rewrites it to `.js` (`rewriteRelativeImportExtensions`).
- Type-only imports use **`import type`** (`verbatimModuleSyntax`).
- No `enum` or `namespace` (`erasableSyntaxOnly`): string-literal unions instead. Prisma's generated enums are `as const` objects, which comply.
