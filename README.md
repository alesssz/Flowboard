# Flowboard

[![CI](https://github.com/alesssz/Flowboard/actions/workflows/ci.yml/badge.svg)](https://github.com/alesssz/Flowboard/actions/workflows/ci.yml)
[![Audit](https://github.com/alesssz/Flowboard/actions/workflows/audit.yml/badge.svg)](https://github.com/alesssz/Flowboard/actions/workflows/audit.yml)

A real-time collaborative kanban board: boards, columns and cards you drag around, with every change showing up live for everyone looking at the same board.

React and TypeScript in the browser, Node.js and TypeScript on the server, in a single pnpm workspace that shares types between the two.

## Status

🚧 **Early development.** The workspace is set up and the web app reaches the API through the development proxy. Next: the first board UI. See the [roadmap](#roadmap).

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
| Build tool | [Vite](https://vite.dev/) 8 | Its dev proxy gives the app and the API one origin; a static production build |
| API | [Node.js](https://nodejs.org/) 24 LTS + [Express](https://expressjs.com/) 5 | Minimal, well-understood HTTP layer; Express 5 forwards async errors natively |
| Dev runner | [tsx](https://tsx.is/) | Runs the API's TypeScript directly, restarting on change |
| Package manager | [pnpm](https://pnpm.io/) workspaces | One lockfile, strict dependency resolution, internal packages without publishing |

Planned: PostgreSQL with Prisma, Zod, TanStack Query, dnd-kit, Socket.IO, Vitest and Playwright, Docker.

## Architecture

```
                         development
┌─────────┐   /api/*   ┌──────────────────┐   /api/*   ┌───────────────────┐
│ Browser │ ─────────▶ │  Vite dev server │ ─────────▶ │    Express API    │
│         │ ◀───────── │      :5873       │ ◀───────── │       :3700       │
└─────────┘            └──────────────────┘            └───────────────────┘
                         serves apps/web                   apps/api
```

The web app only ever calls relative `/api/...` URLs. In development Vite proxies them to the API, so the browser sees a single origin: no CORS configuration, and no API host in the frontend code. Production will keep the same contract by serving both from one domain.

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
├── Makefile                Shortcuts for the scripts, plus setup, Git and cleanup steps
├── package.json            Workspace-wide scripts
└── pnpm-workspace.yaml     Workspace definition, allowed install scripts, version overrides, skipped advisories
```

## Getting started

**Prerequisites:** Node.js 24 (`.nvmrc`), pnpm 12+ (the exact version is pinned in `package.json` and fetched automatically), Git. Optional: [GitHub CLI](https://cli.github.com), for `pnpm github:check` and `pnpm merge:main`; GNU Make, for the [Makefile](#makefile) (Windows: `winget install ezwinports.make`; macOS: included in the Command Line Tools, `xcode-select --install`). Commands are written for PowerShell; in bash or zsh they are the same, except environment variables (`PORT=3701 pnpm dev` instead of `$env:PORT=3701`).

```powershell
pnpm install                          # every package, from the single lockfile
git config core.hooksPath .githooks   # once per clone: enables the commit identity check
pnpm dev                              # web app and API together, with reload on change
```

With Make, the same is `make setup` then `make dev`.

Open http://localhost:5873: the status panel reads **API online** when both sides are up.

| Service | URL |
|---|---|
| Web app (Vite) | http://localhost:5873 |
| API (Express) | http://localhost:3700 |
| Health check | http://localhost:3700/api/health |

The ports are Vite's and Express's usual ones plus 700, so Flowboard runs beside other projects left on 5173 and 3000.

## Scripts

Run from the repository root; each runs the script of the same name in every package that defines it.

| Command | What it does |
|---|---|
| `pnpm dev` | Starts the web app and the API in parallel, reloading on change (transpile only, no type-checking) |
| `pnpm build` | Type-checks and builds every package for production |
| `pnpm typecheck` | Type-checks every package |
| `pnpm lint` | Runs ESLint (web app for now) |
| `pnpm check` | The CI's checks: type-check, lint, build |
| `pnpm audit` | Checks every dependency against the advisory database |
| `pnpm github:check` | Compares the repository's GitHub settings with the ones decided (needs [GitHub CLI](https://cli.github.com)) |
| `pnpm merge:main` | Merges the current branch into `main` through a pull request, once CI passes ([docs/ci-and-security.md](docs/ci-and-security.md#merging)) |

One package only: `pnpm --filter @flowboard/api dev`.

### Makefile

`make help` (or `make` alone) lists every target. Most are the scripts above under the same name (`make dev`, `make check`, `make github-check`…); the others:

| Command | What it does |
|---|---|
| `make setup` | New clone: `pnpm install` and `git config core.hooksPath .githooks` |
| `make urls` | The local addresses |
| `make dev-web` · `make dev-api` | One app only |
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
| The start page shows **API unreachable** | The API is not running or crashed: check the `apps/api` lines in the `pnpm dev` output, or start it alone with `pnpm --filter @flowboard/api dev`, then **Retry** |
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
- [ ] Board UI: boards, columns and cards
- [ ] REST API for boards, columns and cards, on PostgreSQL with Prisma
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
