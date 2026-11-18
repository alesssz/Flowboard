# @flowboard/shared

Types shared by the web app and the API: the shape of every request and response body both sides rely on.

## Using it

Both apps depend on it with the workspace protocol (`"@flowboard/shared": "workspace:*"`) and import its types with `import type`:

```ts
import type { Board, HealthResponse } from '@flowboard/shared';
```

## How it is consumed

The package has no build step: `exports` points at `src/index.ts`, and each consumer compiles the sources with its own toolchain (Vite in the web app, `tsc` and tsx in the API).

This holds while the package exports **types only**. They are erased at compile time, so the API's `dist/` never imports the package at runtime. Runtime code, such as the Zod schemas planned for request validation, needs a build step first: compiled JavaScript with declarations in `dist/`, and `exports` pointing there.

## Scripts

| Script | Command | Description |
|---|---|---|
| `typecheck` | `tsc --noEmit` | Type-checks the sources (run by `pnpm typecheck` before the apps) |

## Structure

```
src/
├── index.ts    public entry point: the only module consumers import
├── board.ts    Board, Column, ColumnColor, Card
└── health.ts   HealthResponse (GET /api/health)
```
