# @flowboard/web

Flowboard's single-page app: **React 19** and **TypeScript**, served and built by **Vite**.

## Running

From the repository root:

```powershell
pnpm dev                              # web app and API together (recommended)
pnpm --filter @flowboard/web dev      # web app only
```

Open http://localhost:5873. The board shows sample data; without the API running, the header reads "API offline", retries on its own and offers a retry button. Known problems: [Troubleshooting](../../README.md#troubleshooting).

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
│   ├── App.tsx         app shell: header, then the board
│   ├── Logo.tsx        the mark, coloured by the theme tokens (same shapes as public/favicon.svg)
│   ├── Tooltip.tsx     hover text drawn above its parent
│   ├── api-status/     header badge: GET /api/health on load, retried while it fails
│   ├── board/          BoardView → BoardColumn → BoardCard → DueDate and Assignees, the due-date helpers, the sample board
│   └── index.css       global styles, design tokens, light and dark themes
├── vite.config.ts      React plugin, dev proxy /api → localhost:3700
├── tsconfig.json       solution file referencing the two projects below
├── tsconfig.app.json   browser code (src/)
├── tsconfig.node.json  vite.config.ts (Node)
└── eslint.config.js    ESLint flat config
```

## Conventions

- Request and response bodies are typed in **`@flowboard/shared`**, imported with `import type`.
- The API is called with relative URLs under `/api` (`fetch('/api/health')`), never with a host: the dev proxy forwards them, and production will serve both from one origin.
- ESLint runs the recommended rule sets of `@eslint/js` and `typescript-eslint`, plus `react-hooks` and `react-refresh`.
- Components are functions named in **PascalCase**; their props are typed with `interface XxxProps`.
- Event handlers are named `handleXxx`; the props that receive them `onXxx`.
- State with several shapes is a **discriminated union** (see `ApiStatus` in `api-status/ApiStatusBadge.tsx`).
- CSS class names follow **BEM** (`block__element--modifier`).
- Each component imports its own stylesheet, beside it (`BoardCard.tsx` → `BoardCard.css`); colours, radius and gutter come only from the tokens in `index.css`.
- Code is grouped by feature (`board/`, `api-status/`), not by kind.
- Colours a user picks (`PaletteColor` in `@flowboard/shared`) are set with `data-color="…"`: it gives the element the `--tone-*` variables (`index.css`), so no component needs a modifier per colour. A new palette colour adds its four tokens per theme and its `data-color` rule.
- Text only screen readers need (what a colour alone shows) goes in a `.visually-hidden` element (`index.css`).
- Hover text is a `<Tooltip>`, never a `title` attribute, which some browsers and webviews do not show. The tooltip is hidden from screen readers, so its text is also in the markup (visible or `.visually-hidden`).
- Due dates are calendar days (`'YYYY-MM-DD'`), compared as strings and shown in the browser's time zone with the helpers in `board/due-date.ts`; never `new Date('YYYY-MM-DD')`, which is midnight UTC and the previous day west of Greenwich.
