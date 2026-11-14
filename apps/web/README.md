# @flowboard/web

Flowboard's single-page app: **React 19** and **TypeScript**, served and built by **Vite**.

## Running

From the repository root:

```powershell
pnpm dev                              # web app and API together (recommended)
pnpm --filter @flowboard/web dev      # web app only
```

Open http://localhost:5173. Without the API running, the status panel reads "API unreachable" and offers a retry. Known problems: [Troubleshooting](../../README.md#troubleshooting).

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Dev server with hot module replacement (transpile only, no type-checking) |
| `build` | `tsc -b && vite build` | Type-checks, then builds to `dist/` |
| `typecheck` | `tsc -b` | Type-checks the app and the Vite config |
| `lint` | `eslint .` | Lints the sources |
| `preview` | `vite preview` | Serves the production build locally |

## Structure

```
apps/web/
├── index.html          the single HTML page; loads src/main.tsx
├── public/             static files served as-is (favicon)
├── src/
│   ├── main.tsx        mounts <App /> into #root
│   ├── App.tsx         placeholder start page: API connection status
│   ├── App.css         its styles (BEM)
│   └── index.css       global styles, design tokens, light and dark themes
├── vite.config.ts      React plugin, dev proxy /api → localhost:3000
├── tsconfig.json       solution file referencing the two projects below
├── tsconfig.app.json   browser code (src/)
├── tsconfig.node.json  vite.config.ts (Node)
└── eslint.config.js    ESLint flat config
```

## Conventions

- The API is called with relative URLs under `/api` (`fetch('/api/health')`), never with a host: the dev proxy forwards them, and production will serve both from one origin.
- ESLint runs the recommended rule sets of `@eslint/js` and `typescript-eslint`, plus `react-hooks` and `react-refresh`.
- Components are functions named in **PascalCase**; their props are typed with `interface XxxProps`.
- Event handlers are named `handleXxx`; the props that receive them `onXxx`.
- State with several shapes is a **discriminated union** (see `ApiStatus` in `App.tsx`).
- CSS class names follow **BEM** (`block__element--modifier`).
