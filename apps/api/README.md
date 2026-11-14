# @flowboard/api

Flowboard's REST API: **Node.js 24**, **Express 5** and **TypeScript**, as native ES modules.

## Running

From the repository root:

```powershell
pnpm dev                              # API and web app together
pnpm --filter @flowboard/api dev      # API only
```

The server listens on http://localhost:3000; set `PORT` to change it (`$env:PORT=4000` in PowerShell). The web app's dev proxy targets port 3000, so update `apps/web/vite.config.ts` too. Known problems: [Troubleshooting](../../README.md#troubleshooting).

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `tsx watch src/index.ts` | Runs the TypeScript sources directly and restarts on change (no type-checking) |
| `build` | `tsc` | Type-checks and compiles `src/` to `dist/` |
| `start` | `node dist/index.js` | Runs the compiled build |
| `typecheck` | `tsc --noEmit` | Type-checks without emitting |

## Structure

```
src/
├── index.ts    entry point: configuration, listen, graceful shutdown (SIGINT/SIGTERM)
└── app.ts      createApp(): middleware, routes, JSON 404
```

`app.ts` builds the app and `index.ts` starts it, so tests can exercise `createApp()` in-process without binding a port.

## Endpoints

| Method | Path | Description | Response |
|---|---|---|---|
| `GET` | `/api/health` | Liveness probe | `200` `{ "status": "ok", "timestamp", "uptimeSeconds" }` |
| any | any other path | No matching route | `404` `{ "error": "Not Found", "message" }` |

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |

## Conventions

- Every route lives under **`/api`**, the only prefix the web app's dev proxy forwards.
- Every response is **JSON**, errors included.
- Relative imports carry the **`.ts`** extension (`import { createApp } from './app.ts'`); `tsc` rewrites it to `.js` (`rewriteRelativeImportExtensions`).
- Type-only imports use **`import type`** (`verbatimModuleSyntax`).
- No `enum` or `namespace` (`erasableSyntaxOnly`): string-literal unions instead.
