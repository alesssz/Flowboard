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
| Web app | [React](https://react.dev/) 19 | Component model and ecosystem for a highly interactive UI |
| Build tool | [Vite](https://vite.dev/) 8 | Instant dev server with hot module replacement, optimised production builds |
| API | [Node.js](https://nodejs.org/) 24 LTS + [Express](https://expressjs.com/) 5 | Minimal, well-understood HTTP layer; Express 5 forwards async errors natively |
| Dev runner | [tsx](https://tsx.is/) | Runs the API's TypeScript directly, restarting on change |
| Package manager | [pnpm](https://pnpm.io/) workspaces | One lockfile, strict dependency resolution, internal packages without publishing |

Planned: PostgreSQL with Prisma, Zod, TanStack Query, dnd-kit, Socket.IO, Vitest and Playwright, Docker.

## Architecture

```
                         development
┌─────────┐   /api/*   ┌──────────────────┐   /api/*   ┌───────────────────┐
│ Browser │ ─────────▶ │  Vite dev server │ ─────────▶ │    Express API    │
│         │ ◀───────── │      :5173       │ ◀───────── │       :3000       │
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
├── packages/               Internal libraries, e.g. shared types (planned)
├── docs/                   Developer documentation
├── scripts/                Repository tooling (GitHub settings check)
├── .github/                CI and audit workflows, shared setup action, Dependabot
├── .githooks/              Git hooks (commit identity check)
├── package.json            Workspace-wide scripts
└── pnpm-workspace.yaml     Workspace definition, allowed install scripts, version overrides
```

## Getting started

**Prerequisites:** Node.js 24 (`.nvmrc`), pnpm 12+ (the exact version is pinned in `package.json` and fetched automatically), Git. Optional: [GitHub CLI](https://cli.github.com), for `pnpm github:check`. Commands are written for PowerShell; in bash or zsh they are the same, except environment variables (`PORT=3001 pnpm dev` instead of `$env:PORT=3001`).

```powershell
pnpm install                          # every package, from the single lockfile
git config core.hooksPath .githooks   # once per clone: enables the commit identity check
pnpm dev                              # web app and API together, with reload on change
```

Open http://localhost:5173: the status panel reads **API online** when both sides are up.

| Service | URL |
|---|---|
| Web app (Vite) | http://localhost:5173 |
| API (Express) | http://localhost:3000 |
| Health check | http://localhost:3000/api/health |

## Scripts

Run from the repository root; each runs the script of the same name in every package that defines it.

| Command | What it does |
|---|---|
| `pnpm dev` | Starts the web app and the API in parallel, reloading on change (transpile only, no type-checking) |
| `pnpm build` | Type-checks and builds every package for production |
| `pnpm typecheck` | Type-checks every package |
| `pnpm lint` | Runs ESLint (web app for now) |
| `pnpm audit` | Checks every dependency against the advisory database |
| `pnpm github:check` | Compares the repository's GitHub settings with the ones decided (needs [GitHub CLI](https://cli.github.com)) |

One package only: `pnpm --filter @flowboard/api dev`.

## Troubleshooting

| Problem | Solution |
|---|---|
| PowerShell: `pnpm.ps1 cannot be loaded because running scripts is disabled on this system` | Windows' default execution policy blocks the `pnpm.ps1` shim. Once per user: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` |
| `ERR_PNPM_IGNORED_BUILDS` after adding a dependency | pnpm blocked its install script. Review it with `pnpm approve-builds` (select with Space) and commit the `allowBuilds` entry it writes to `pnpm-workspace.yaml`, or leave it blocked |
| `Cannot start the server on port 3000: listen EADDRINUSE` | Another process holds the port, usually a forgotten `pnpm dev`. Stop it, or run the API elsewhere (`$env:PORT=3001`) and change the proxy `target` in `apps/web/vite.config.ts` to match |
| `Error: Port 5173 is already in use` | Another Vite dev server is running (`strictPort` stops instead of moving to 5174). Stop it |
| The start page shows **API unreachable** | The API is not running or crashed: check the `apps/api` lines in the `pnpm dev` output, or start it alone with `pnpm --filter @flowboard/api dev`, then **Retry** |
| Two `/api/health` requests on every load in development | Expected: StrictMode runs effects twice in development only |
| `pnpm dev` works but `pnpm typecheck` or CI fails | `pnpm dev` only strips types (tsx, Vite). Type errors show in the editor and in `pnpm typecheck` |
| `pre-commit: refused, identity is '…'` | The commit identity is not the GitHub noreply address: set it for this clone with `git config user.email "<id>+<user>@users.noreply.github.com"` |
## CI and security

Every push runs type-checking, linting and the production build on GitHub Actions; a weekly audit, and any change to the dependencies, runs `pnpm audit`. Workflows use only GitHub's own actions, pinned to commit hashes, with a read-only token. The repository has secret scanning with push protection, CodeQL, private vulnerability reporting and a ruleset protecting `main`. Details and the reasons behind each setting: [docs/ci-and-security.md](docs/ci-and-security.md). To report a vulnerability: [SECURITY.md](SECURITY.md).

## Conventions

- TypeScript `strict` with `noUncheckedIndexedAccess`, `verbatimModuleSyntax` and `erasableSyntaxOnly` (string-literal unions instead of enums).
- Every API route lives under `/api`, and every response, errors included, is JSON.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## Roadmap

**Core**
- [x] pnpm workspace with a Vite + React web app and an Express API
- [x] CI (types, lint, build), weekly dependency audit, repository security settings
- [ ] Board UI: boards, columns and cards
- [ ] REST API for boards, columns and cards
- [ ] PostgreSQL with Prisma
- [ ] Shared types and validation (`@flowboard/shared` + Zod)
- [ ] Authentication with JWT
- [ ] Drag and drop with dnd-kit, optimistic updates with TanStack Query
- [ ] Online deployment

**Advanced**
- [ ] Real-time collaboration (Socket.IO) and user presence
- [ ] Concurrent editing of card descriptions (Yjs / CRDT)
- [ ] Board roles and permissions
- [ ] Background jobs (BullMQ + Redis): due-date reminders
- [ ] Attachments on S3-compatible storage
- [ ] Undo/redo, offline-first PWA, list virtualisation
- [ ] AI assistant to draft cards
- [ ] Tests (Vitest, Playwright) in CI, continuous deployment, Docker Compose
