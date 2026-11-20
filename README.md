# Flowboard

[![CI](https://github.com/alesssz/Flowboard/actions/workflows/ci.yml/badge.svg)](https://github.com/alesssz/Flowboard/actions/workflows/ci.yml)
[![Audit](https://github.com/alesssz/Flowboard/actions/workflows/audit.yml/badge.svg)](https://github.com/alesssz/Flowboard/actions/workflows/audit.yml)

A real-time collaborative kanban board: boards, columns and cards you drag around, with every change showing up live for everyone looking at the same board.

React and TypeScript in the browser, Node.js and TypeScript on the server, in a single pnpm workspace that shares types between the two.

## Status

🚧 **Early development.** The web app shows a board, with columns, cards and each card's detail and comments, read from the API, which stores them in PostgreSQL; the board is read-only for now. Next: board editing. See the [roadmap](#roadmap).

**This repository.** A personal project, in development and not deployed, made public to be read. There is no licence: the code can be read and studied, but all rights are reserved, so it may not be reused or redistributed without permission. Contributions are not expected for now; a security problem is reported privately, as [SECURITY.md](SECURITY.md) explains.

## Contents

- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)
- [CI and security](#ci-and-security)
- [Conventions](#conventions)
- [Roadmap](#roadmap)

## Tech stack

| Area | Technology | Why |
|---|---|---|
| Language | [TypeScript](https://www.typescriptlang.org/) 6, `strict` | One language and shared types across the web app and the API |
| Web app | [React](https://react.dev/) 19 | The board's libraries: dnd-kit for drag and drop, TanStack Query for optimistic updates |
| Server state | [TanStack Query](https://tanstack.com/query) 5 | Caching, retries and background refresh of API data; optimistic updates once the board is editable |
| Build tool | [Vite](https://vite.dev/) 8 | Its dev proxy gives the app and the API one origin; a static production build |
| API | [Node.js](https://nodejs.org/) 24 LTS + [Express](https://expressjs.com/) 5 | Minimal, well-understood HTTP layer; Express 5 forwards async errors natively |
| Database | [PostgreSQL](https://www.postgresql.org/) 18, in Docker for development | Relational data (boards own columns, columns own cards) with constraints and cascades |
| ORM | [Prisma](https://www.prisma.io/) 7 | Schema-first models, generated migrations, query results typed from the schema |
| Dev runner | [tsx](https://tsx.is/) | Runs the API's TypeScript directly, restarting on change |
| Package manager | [pnpm](https://pnpm.io/) workspaces | One lockfile, strict dependency resolution, internal packages without publishing |

Planned: Zod, dnd-kit, Socket.IO, Vitest and Playwright, Docker for the whole stack.

## Architecture

```
                         development
┌─────────┐  /api/*  ┌─────────────────┐  /api/*  ┌─────────────┐  Prisma  ┌────────────┐
│ Browser │ ───────▶ │ Vite dev server │ ───────▶ │ Express API │ ───────▶ │ PostgreSQL │
│         │ ◀─────── │      :5873      │ ◀─────── │    :3700    │ ◀─────── │   :6132    │
└─────────┘          └─────────────────┘          └─────────────┘          └────────────┘
                       serves apps/web               apps/api           Docker, compose.yaml
```

The web app only ever calls relative `/api/...` URLs. In development Vite proxies them to the API, so the browser sees a single origin: no CORS configuration, and no API host in the frontend code. Production will keep the same contract by serving both from one domain.

The API is the only process that talks to the database. It returns the `@flowboard/shared` types, never database rows: positions and foreign keys stay on the server.

## Repository layout

```
Flowboard/
├── apps/
│   ├── web/                React single-page app (@flowboard/web)  → apps/web/README.md
│   └── api/                Express REST API (@flowboard/api)       → apps/api/README.md
├── packages/
│   └── shared/             Types shared by both apps (@flowboard/shared)  → packages/shared/README.md
├── docs/                   Developer documentation
├── scripts/                Repository tooling (merge, GitHub settings check, make help and clean)
├── .github/                CI and audit workflows, shared setup action, Dependabot
├── .githooks/              Git hooks (commit identity check)
├── compose.yaml            Development PostgreSQL (Docker)
├── Makefile                Shortcuts for the scripts, plus setup, database, Git and cleanup steps
├── package.json            Workspace-wide scripts
└── pnpm-workspace.yaml     Workspace definition, allowed install scripts, version overrides, skipped advisories
```

## Getting started

**Prerequisites:** Node.js 24 (`.nvmrc`), pnpm 12+ (the exact version is pinned in `package.json` and fetched automatically), Git, Docker with Compose v2 for the development database (Docker Desktop on Windows and macOS). Optional: [GitHub CLI](https://cli.github.com), for `pnpm github:check` and `pnpm merge:main`; GNU Make, for the [Makefile](#makefile) (Windows: `winget install ezwinports.make`; macOS: included in the Command Line Tools, `xcode-select --install`). Commands are written for PowerShell; in bash or zsh they are the same, except environment variables (`PORT=3701 pnpm dev` instead of `$env:PORT=3701`).

```powershell
pnpm install                                  # every package, from the single lockfile
git config core.hooksPath .githooks           # once per clone: enables the commit identity check
cp apps/api/.env.example apps/api/.env        # once per clone: the API's settings (DATABASE_URL)
pnpm db:up                                    # PostgreSQL in Docker, waiting until it accepts connections
pnpm db:migrate                               # creates the tables
pnpm db:seed                                  # the sample board
pnpm dev                                      # web app and API together, with reload on change
```

With Make: `make setup`, the `cp` line, `make db-up db-migrate db-seed`, then `make dev`.

Open http://localhost:5873: the header reads **API online** when both sides are up, and the board loads from the database.

Later sessions: `pnpm db:up`, then `pnpm dev`. The container has no restart policy, so it is down after Docker or the computer restarts; its data stays in the `db-data` volume until `docker compose down --volumes`. After pulling a new migration: `pnpm db:migrate`. Seeding again replaces every board with the sample board, its due dates counted from that day.

| Service | Address |
|---|---|
| Web app (Vite) | http://localhost:5873 |
| API (Express) | http://localhost:3700 |
| Health check | http://localhost:3700/api/health |
| PostgreSQL | `localhost:6132`, database, user and password `flowboard` (development only, bound to localhost) |
| Prisma Studio | http://localhost:6255, while `pnpm db:studio` runs |

The ports are Vite's, Express's, PostgreSQL's and Prisma Studio's usual ones plus 700, so Flowboard runs beside other projects left on 5173, 3000, 5432 and 5555. Any PostgreSQL client reaches the database with the details above; table names are the Prisma model names, quoted in SQL (`SELECT * FROM "Card"`).

## Scripts

Run from the repository root. `dev`, `build`, `typecheck` and `lint` run the script of the same name in every package that defines it; the `db:` scripts work on the development database.

| Command | What it does |
|---|---|
| `pnpm dev` | Starts the web app and the API in parallel, reloading on change (transpile only, no type-checking) |
| `pnpm build` | Type-checks and builds every package for production |
| `pnpm typecheck` | Type-checks every package |
| `pnpm lint` | Runs ESLint (web app for now) |
| `pnpm check` | The CI's checks: type-check, lint, build |
| `pnpm db:up` | Starts PostgreSQL in Docker (`compose.yaml`) and waits until it accepts connections |
| `pnpm db:down` | Stops and removes the container; the data stays in its volume |
| `pnpm db:migrate` | Applies pending migrations; after a change to `apps/api/prisma/schema.prisma`, first creates one (`pnpm db:migrate --name add-card-cover`) |
| `pnpm db:seed` | Replaces every board with the sample board |
| `pnpm db:reset` | Drops every table, applies every migration and seeds (asks first) |
| `pnpm db:studio` | Opens Prisma Studio on http://localhost:6255: the data by model, with relations and enums, editable |
| `pnpm audit` | Checks every dependency against the advisory database |
| `pnpm github:check` | Compares the repository's GitHub settings with the ones decided (needs [GitHub CLI](https://cli.github.com)) |
| `pnpm merge:main` | Merges the current branch into `main` through a pull request, once CI passes ([docs/ci-and-security.md](docs/ci-and-security.md#merging)) |

One package only: `pnpm --filter @flowboard/api dev`.

### Makefile

`make help` (or `make` alone) lists every target. Most are the scripts above under the same name, with `-` for `:` (`make dev`, `make check`, `make db-up`…); the others:

| Command | What it does |
|---|---|
| `make setup` | New clone: `pnpm install` and `git config core.hooksPath .githooks` |
| `make urls` | The local addresses |
| `make dev-web` · `make dev-api` | One app only |
| `make db-migrate name=add-card-cover` | `pnpm db:migrate --name add-card-cover`; without `name`, applies the pending migrations |
| `make branch name=feat/board-ui` | New branch from an up-to-date `main` |
| `make sync` | Back to `main`, updated from GitHub, branches deleted there forgotten (`fetch --prune`) |
| `make push` | Pushes the current branch, setting its upstream the first time |
| `make merge` | `pnpm merge:main`; `yes=1` adds `--yes`, `checks=0` adds `--no-checks` |
| `make clean` · `make clean-all` | Removes every package's `dist/`; `clean-all` also every `node_modules` (then `make install`) |

It runs from PowerShell, Git Bash and zsh alike. Options are passed as variables (`name=…`, `yes=1`), not as flags.

## Troubleshooting

| Problem | Solution |
|---|---|
| PowerShell: `pnpm.ps1 cannot be loaded because running scripts is disabled on this system` | Windows' default execution policy blocks the `pnpm.ps1` shim. Once per user: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` |
| `ERR_PNPM_IGNORED_BUILDS` after adding a dependency | pnpm blocked its install script. Review it with `pnpm approve-builds` (select with Space) and commit the `allowBuilds` entry it writes to `pnpm-workspace.yaml`, or leave it blocked |
| `Cannot start the server on port 3700: listen EADDRINUSE` | Another process holds the port, usually a forgotten `pnpm dev`. Stop it, or run the API elsewhere (`$env:PORT=3701`) and change the proxy `target` in `apps/web/vite.config.ts` to match |
| `Error: Port 5873 is already in use` | Another Vite dev server is running (`strictPort` stops instead of moving to 5874). Stop it |
| The header shows **API offline** | The API is not running or crashed: check the `apps/api` lines in the `pnpm dev` output, or start it alone with `pnpm --filter @flowboard/api dev`. The badge retries on its own (after 1 s, doubling up to 30 s); **Retry** checks at once |
| `[vite] http proxy error: /api/health` with `ECONNREFUSED 127.0.0.1:3700` when `pnpm dev` starts | Harmless: an open tab reloaded before the API was listening. The badge reconnects on its own; Vite logs every failed proxy request and has no option to silence it |
| The API exits at once with `DATABASE_URL is not set`, or `pnpm db:migrate` fails with `The datasource.url property is required in your Prisma config file` | `apps/api/.env` is missing or has no `DATABASE_URL` line: copy `apps/api/.env.example` to it |
| The board reads **Cannot load the boards**, and the API logs `Can't reach database server at localhost:6132` | PostgreSQL is not running: start Docker, then `pnpm db:up`. The board shows the error after the request's 3 retries; **Try again** asks once more |
| In the browser's Network tab every `/api` request appears twice, the first one canceled | Development only, and expected: React's StrictMode mounts each component, unmounts it and mounts it again, and the unmount cancels the request it started (TanStack Query and the API status badge abort what is no longer used). The production build sends each request once |
| `pnpm dev` works but `pnpm typecheck` or CI fails | `pnpm dev` only strips types (tsx, Vite). Type errors show in the editor and in `pnpm typecheck` |
| `pre-commit: refused, identity is '…'` | The commit identity is not the GitHub noreply address: set it for this clone with `git config user.email "<id>+<user>@users.noreply.github.com"` |

## CI and security

Every push runs type-checking, linting and the production build on GitHub Actions; a weekly audit, and any change to the dependencies, runs `pnpm audit`. Workflows use only GitHub's own actions, pinned to commit hashes, with a read-only token. The repository has secret scanning with push protection, CodeQL, private vulnerability reporting and a ruleset protecting `main`. Details and the reasons behind each setting: [docs/ci-and-security.md](docs/ci-and-security.md). To report a vulnerability: [SECURITY.md](SECURITY.md).

## Conventions

- TypeScript `strict` with `noUncheckedIndexedAccess`, `verbatimModuleSyntax` and `erasableSyntaxOnly` (string-literal unions instead of enums).
- Every API route lives under `/api`, and every response, errors included, is JSON.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## Roadmap

The directions; the points ready to be picked up are in [docs/backlog.md](docs/backlog.md).

**Usable board**
- [x] pnpm workspace with a Vite + React web app and an Express API
- [x] CI (types, lint, build), weekly dependency audit, repository security settings
- [x] Board layout: coloured column lanes, cards with labels, due dates, assignees and comment counts
- [x] Card detail, read-only: full description and comments
- [x] Read API for boards and comments, on PostgreSQL with Prisma; the web app loads it with TanStack Query
- [ ] Board editing, through the API: add, rename, move and delete columns, cards and labels; write comments
- [x] Shared types (`@flowboard/shared`)
- [ ] Request validation with Zod, in the shared package
- [ ] Drag and drop (dnd-kit) with optimistic updates (TanStack Query)
- [ ] Tests in CI: API and web app (Vitest)

**Collaboration**
- [ ] Accounts and sign-in (JWT)
- [ ] Live updates and presence (Socket.IO)
- [ ] Board roles and permissions
- [ ] Concurrent editing of card descriptions (Yjs)

**Production**
- [ ] Docker Compose for the whole stack
- [ ] Online deployment, with continuous deployment from `main`
- [ ] End-to-end tests (Playwright)

**Later**
- [ ] Due-date reminders (BullMQ + Redis)
- [ ] Attachments on S3-compatible storage
- [ ] Undo/redo, offline use (PWA), virtualised long columns
- [ ] AI assistant that drafts cards
