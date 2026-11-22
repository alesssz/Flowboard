# @flowboard/web

Flowboard's single-page app: **React 19** and **TypeScript**, served and built by **Vite**, with API data through **TanStack Query**.

## Running

From the repository root:

```powershell
pnpm dev                              # web app and API together (recommended)
pnpm --filter @flowboard/web dev      # web app only
```

Open http://localhost:5873. The board comes from the API, and every edit is saved there, so it needs the API and its database ([Getting started](../../README.md#getting-started)). Without the API, the header reads "API offline", retries on its own and offers a retry button, and the board area shows the error with **Try again**. Known problems: [Troubleshooting](../../README.md#troubleshooting).

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
│   ├── main.tsx        mounts <App /> into #root, inside TanStack Query's QueryClientProvider
│   ├── App.tsx         app shell: header, then the board
│   ├── api.ts          fetchJson, sendJson, sendDelete: /api/… requests; an error status throws
│   │                   ApiRequestError with the API's message, no answer a plain Error
│   ├── Logo.tsx        the mark, coloured by the theme tokens (same shapes as public/favicon.svg)
│   ├── Tooltip.tsx     hover text drawn above its parent
│   ├── api-status/     header badge: GET /api/health on load, retried while it fails
│   ├── board/          BoardPage (loads the board) → BoardView (with AddColumn) → BoardColumn (with
│   │                   ColumnHeader: rename, colour, Delete column; and AddCard) → BoardCard;
│   │                   CardDialog (a card's detail, loads its comments) with CardFields (each field
│   │                   edited in place, Delete card); FieldControls, the pencil, save state and delete
│   │                   confirmation both editors use; their parts (Labels, DueDate, Assignees, Avatar);
│   │                   queries (board-queries.ts), writes (column-mutations.ts, card-mutations.ts,
│   │                   through board-cache.ts), date helpers
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
- API data is read with **TanStack Query**: each query's key and fetcher are defined once with `queryOptions` (`board/board-queries.ts`) and used with `useQuery`. Keys go from general to specific (`['boards']`, `['boards', id]`, `['cards', id, 'comments']`), so related data can be refreshed together. A 4xx is not retried (`main.tsx`); other failures are retried 3 times.
- A component reading a query renders its data first, then the error, then the loading state: a failed background refresh keeps what is on screen.
- Writes are TanStack Query mutations (`board/column-mutations.ts`, `board/card-mutations.ts`). Each waits for the API, then writes the column or card it returns into the cached board (`updateBoard` in `board/board-cache.ts`, over `setQueryData`), so every view of it changes together without reloading the board. Deleting a column or a card also drops the cached comments of the cards that went. Nothing changes on screen before the API has accepted it; optimistic updates come with drag and drop.
- Card fields are edited in place (`board/CardFields.tsx`), each with its own mutation: a pencil button (and a click on the title) opens the editor, which shows "Saving…" while the request runs and stays open with the API's message if it fails. Enter saves a single-line field, Ctrl or ⌘ + Enter the description, Escape cancels; the title also saves when it loses the focus. Labels and assignees are checkboxes, each change saved at once.
- Columns follow the same pattern (`board/ColumnHeader.tsx`): a click on the title, or its pencil, renames the column; the options button (`aria-expanded`) shows the colour, as radio buttons saved at once, and **Delete column**, which says how many cards go with it. Where the pointer can hover, the pencil and the options button show only on hover or focus. A new column (`board/AddColumn.tsx`) gets the first palette colour no column has.
- Escape inside a field calls `preventDefault()` (`board/cancel-on-escape.ts`), so it cancels the edit without also closing the dialog or the column options around it.
- While a request runs, buttons stay enabled and their handlers ignore clicks (`aria-disabled` shows the state): a disabled button would drop the keyboard focus. An edit closed from inside it gives the focus back to its pencil button; one closed by clicking elsewhere leaves it there. After a column is deleted, the focus goes to the row of columns.
- Inputs take their `maxLength` from the limits in `@flowboard/shared`, the ones the API enforces. The web app imports only types and limits from the package, never its schemas, so Zod stays out of the bundle.
- ESLint runs the recommended rule sets of `@eslint/js` and `typescript-eslint`, plus `react-hooks` and `react-refresh`.
- Components are functions named in **PascalCase**; their props are typed with `interface XxxProps`.
- Event handlers are named `handleXxx`; the props that receive them `onXxx`.
- State with several shapes is a **discriminated union** (see `ApiStatus` in `api-status/ApiStatusBadge.tsx`).
- CSS class names follow **BEM** (`block__element--modifier`).
- Each component imports its own stylesheet, beside it (`BoardCard.tsx` → `BoardCard.css`); colours, radius and gutter come only from the tokens in `index.css`.
- Code is grouped by feature (`board/`, `api-status/`), not by kind.
- Colours a user picks (`paletteColors` in `@flowboard/shared`) are set with `data-color="…"`: it gives the element the `--tone-*` variables (`index.css`), so no component needs a modifier per colour. A new palette colour adds its four tokens per theme and its `data-color` rule.
- Text only screen readers need (what a colour alone shows) goes in a `.visually-hidden` element (`index.css`).
- Dialogs are a native `<dialog>` opened with `showModal()` (`board/CardDialog.tsx`): the browser traps focus, closes on Escape and gives focus back to the element that opened it. The component is mounted only while open, and its `onClose` unmounts it.
- A clickable card is an `<article>` with the click handler, holding a real `<button>` (its title) for the keyboard and screen readers; the button's click bubbles to the card.
- Hover text is a `<Tooltip>`, never a `title` attribute, which some browsers and webviews do not show. The tooltip is hidden from screen readers, so its text is also in the markup (visible or `.visually-hidden`).
- Due dates are calendar days (`'YYYY-MM-DD'`), compared as strings and shown in the browser's time zone with the helpers in `board/due-date.ts`; never `new Date('YYYY-MM-DD')`, which is midnight UTC and the previous day west of Greenwich.
