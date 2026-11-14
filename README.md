# Flowboard

A real-time collaborative kanban board: boards, columns and cards you drag around, with every change showing up live for everyone looking at the same board.

React and TypeScript in the browser, Node.js and TypeScript on the server, in a single pnpm workspace that shares types between the two.

## Status

🚧 **Early development.** The workspace is set up and the web app reaches the API through the development proxy. Next: the first board UI. See the [roadmap](#roadmap).

## Tech stack

| Area | Technology | Why |
|---|---|---|
| Language | [TypeScript](https://www.typescriptlang.org/) 6, `strict` | One language on both sides; type errors are caught in the editor, not in production |
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
├── .githooks/              Git hooks (commit identity check)
├── package.json            Workspace-wide scripts
└── pnpm-workspace.yaml     Workspace definition and allowed install scripts
```

## Getting started

**Prerequisites:** Node.js 24+, pnpm 12+ (the exact version is pinned in `package.json`), Git.

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

On Windows, if PowerShell refuses to run `pnpm` ("running scripts is disabled on this system"), allow local scripts for your user once: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

## Scripts

Run from the repository root; each runs the script of the same name in every package that defines it.

| Command | What it does |
|---|---|
| `pnpm dev` | Starts the web app and the API in parallel, reloading on change. **Does not type-check** |
| `pnpm build` | Type-checks and builds every package for production |
| `pnpm typecheck` | Type-checks every package |
| `pnpm lint` | Runs ESLint (web app for now) |

One package only: `pnpm --filter @flowboard/api dev`.

## Conventions

- TypeScript `strict` with `noUncheckedIndexedAccess`, `verbatimModuleSyntax` and `erasableSyntaxOnly` (string-literal unions instead of enums).
- Every API route lives under `/api`, and every response, errors included, is JSON.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## Roadmap

**Core**
- [x] pnpm workspace with a Vite + React web app and an Express API
- [ ] Boards, columns and cards in React (local state)
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
- [ ] Tests (Vitest, Playwright), CI/CD with GitHub Actions, Docker Compose
