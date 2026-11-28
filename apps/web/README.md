# @flowboard/web

Flowboard's single-page app: **React 19** and **TypeScript**, served and built by **Vite**, with API data through **TanStack Query**.

## Running

From the repository root:

```powershell
pnpm dev                              # web app and API together (recommended)
pnpm --filter @flowboard/web dev      # web app only
```

Open http://localhost:5873 and sign in, or create an account. The board comes from the API, and every edit is saved there, so it needs the API and its database ([Getting started](../../README.md#getting-started)). Without the API, the header reads "API offline", retries on its own and offers a retry button, and the board area shows the error with **Try again**. Known problems: [Troubleshooting](../../README.md#troubleshooting).

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
│   ├── App.tsx         app shell: header and board when signed in, else the sign-in page alone
│   ├── api.ts          fetchJson, sendJson, sendEmpty: /api/… requests; an error status throws
│   │                   ApiRequestError with the API's message, no answer a plain Error
│   ├── PageMessage.tsx what stands in for a page while it loads or fails, with Try again
│   ├── Logo.tsx        the mark, coloured by the theme tokens (same shapes as public/favicon.svg)
│   ├── Tooltip.tsx     hover text drawn above its parent
│   ├── api-status/     header badge: GET /api/health on load, retried while it fails
│   ├── auth/           AuthPage (sign in, or create an account, over AuthBackdrop, a pictured board),
│   │                   AccountMenu (the name and Sign out in the header), auth-queries.ts (who is signed
│   │                   in, and the writes that change it)
│   ├── board/          BoardPage (the board in the address, or the first; Create your first board) →
│   │                   BoardView (drag and drop; BoardTitle: the list of boards, with CreateBoardForm,
│   │                   and the rename field; ColumnsPanel; BoardMenu: Members, with MembersDialog,
│   │                   Rename, Delete board; the user's role for all below, board-role.ts) → BoardColumn
│   │                   (sortable, with ColumnHeader: rename, colour, Delete column; and AddCard) →
│   │                   BoardCard; DragHandle, the grip for keyboard moves;
│   │                   CardDialog (a card's detail in two columns) with CardFields (title and
│   │                   description saved by themselves, details in DetailRow panels, Delete card) and
│   │                   CardComments (the list, Edit and Delete on one's own, a field to write one),
│   │                   LabelEditor (a label's name and colour, in the labels panel);
│   │                   FieldControls, the pencil, save state and delete
│   │                   confirmation both editors use; their parts (Labels, DueDate, Assignees, Avatar);
│   │                   queries (board-queries.ts), writes (board-mutations.ts, column-mutations.ts,
│   │                   card-mutations.ts, comment-mutations.ts, invitation-mutations.ts,
│   │                   label-mutations.ts, member-mutations.ts, move-mutations.ts, through board-cache.ts),
│   │                   the addresses (use-board-route.ts: /boards/<id>, /invite#<token>), date helpers
│   ├── invite/         InvitePage (an invitation in the address: Join board or Not now), invite-queries.ts
│   └── index.css       global styles, design tokens, light and dark themes
├── vite.config.ts      React plugin, dev proxy /api → 127.0.0.1:3700
├── tsconfig.json       solution file referencing the two projects below
├── tsconfig.app.json   browser code (src/)
├── tsconfig.node.json  vite.config.ts (Node)
└── eslint.config.js    ESLint flat config
```

## Conventions

- Request and response bodies are typed in **`@flowboard/shared`**, imported with `import type`.
- The API is called with relative URLs under `/api` (`fetch('/api/health')`), never with a host: the dev proxy forwards them, and production will serve both from one origin.
- API data is read with **TanStack Query**: each query's key and fetcher are defined once with `queryOptions` (`board/board-queries.ts`) and used with `useQuery`. Keys go from general to specific (`['boards']`, `['boards', id]`, `['cards', id, 'comments']`), so related data can be refreshed together. A 4xx is not retried (`main.tsx`); other failures are retried 3 times.
- Who is signed in is a query too (`meQuery` in `auth/auth-queries.ts`, `GET /api/auth/me`), a `SessionState`: `signed-in` with the user, or `signed-out` for the API's 401, so having no session is data, not an error. `App.tsx` shows the board when signed in and `AuthPage` when not. The session itself is an `HttpOnly` cookie the browser sends with every `/api` request; the web app never sees it. Signing up, in or out writes the new state into that query, then, once the page has changed, removes every query no component reads any more, so nothing read as the previous user stays on screen or in the cache.
- A session can end while the app is open (it expired, or was signed out from another browser). Any query or mutation the API answers with 401 while signed in (`handleSessionEnded`, wired in `main.tsx`: the query cache's `onError`, the mutation cache's `onSettled`, after a move has put its board back) turns the state to `signed-out` with `ended`, and the sign-in page says the session has ended. So does a 401 from `/api/auth/me` itself, refetched when the window regains focus, after being signed in. The API answers a board that is not the user's as one that does not exist: a new account sees **No boards yet**.
- The sign-in page has no header: a panel on frosted glass over a pictured board (`auth/AuthBackdrop.tsx`, fixed markup hidden from screen readers; with no session there is no data to show), solid when the system asks for less transparency. **Sign in** and **Create account** are ARIA tabs over one form: the arrows, Home and End switch them and keep the focus on the tabs, and the typed email and password stay. The browser checks the fields first (`required`, `type="email"`, the minimum length at sign-up), then the API: a message about one field (`email: …`) shows under it, marks it `aria-invalid` and takes the focus there; any other (a wrong password, too many attempts) shows above the button.
- A component reading a query renders its data first, then the error, then the loading state: a failed background refresh keeps what is on screen.
- Writes are TanStack Query mutations (`board/column-mutations.ts`, `board/card-mutations.ts`). Each waits for the API, then writes the column or card it returns into the cached board (`updateBoard` in `board/board-cache.ts`, over `setQueryData`), so every view of it changes together without reloading the board. Deleting a column or a card also drops the cached comments of the cards that went. Nothing changes on screen before the API has accepted it, except moves.
- Moves are optimistic (`board/move-mutations.ts`): the cached board changes at once, with `moveCardInBoard` and `moveColumnInBoard` in `board/board-cache.ts`, the same rule as the API's, then the API's board replaces it, unless more moves are still on their way. A refused move puts back the board as it was before it, and the board's header says why (**Not moved: …**, with **Dismiss**).
- Drag and drop uses dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`), held in `board/BoardView.tsx`: columns in a horizontal sortable list, each column's cards in a vertical one, a card crossing into another column joining it as the pointer crosses. The mouse drags a whole card after 6 px, a touch after a 250 ms press (a swipe still scrolls), and a column by its grip. The keyboard lifts a card or a column from its grip (`board/DragHandle.tsx`): Space or Enter, the arrows (Left and Right change a card's column), Space or Enter to drop, Escape to cancel; announcements name the item and its place ("position 2 of 4 in Review"). A copy follows the pointer (`DragOverlay`) while the item's place shows faded; after the drop the dropped order stays on screen until the cache has it, so the drop animation lands where the item went.
- The card dialog's **Column** row moves a card without dragging: another column (to its bottom) or another position.
- The user's role on the board (`Board.role`) reaches every part through a context (`board/board-role.ts`, `useCanEdit`, `useIsOwner`), and each hides what the role cannot change; the API refuses it anyway (`403`). A viewer sees **View only** beside the title, no grips, no **Add a card** or **Add a column**, no column options, and the card dialog as text: the title and description read-only, the details without their panels, the completion box disabled, no **Delete card**; comments stay open to them. Only an owner gets **Rename board** and **Delete board** in the board's menu (⋯).
- **Members**, in the board's menu, opens a dialog (`board/MembersDialog.tsx`, `board/member-mutations.ts`) listing the members with an account, each with their role. An owner picks a role from a list, saved at once, and removes a member after a confirmation; everyone leaves the board from their own row, which then opens the first remaining board. A refused change (the last owner) shows the API's reason on its row. An owner stepping down sees the board change at once, as their role in the cached board follows.
- An owner invites from the same dialog (`board/invitation-mutations.ts`): a role, **Create a link**, then the link, shown this once with **Copy** (the clipboard needs a secure page, `localhost` or HTTPS; elsewhere the link is selected to be copied by hand), and the invitations waiting to be used, each with **Revoke**. Opening a link (`invite/InvitePage.tsx`, `invite/invite-queries.ts`) shows who invites to which board and with what role, then **Join board** or **Not now**; both leave the invitation's address out of the history. Signed out, the sign-in page says the user is invited and keeps the address, so the invitation shows once they are in. A link used, revoked or expired says so; a member already is offered the board.
- Comments (`board/CardComments.tsx`, `board/comment-mutations.ts`): a field under the list writes one, its **Comment** button showing once something is typed; Ctrl or ⌘ + Enter sends it. The user's own comments (`mine`, from the API) have an options button (⋯) at the end of the name's line, shown on hover or focus where the pointer can hover, which opens a menu (a native `popover`, through `board/use-popover-panel.ts`) with **Edit** and **Delete**. The editor replaces the text: **Save** or Ctrl or ⌘ + Enter saves, Escape cancels without closing the dialog, and the focus goes back to the options button. **Delete** asks inside the menu, then the focus goes to the field. A changed comment reads "edited", with the time on hover. Each write updates the card's cached comments and its comment count on the board.
- The card dialog never changes shape while a card is edited (`board/CardDialog.tsx`, `board/CardFields.tsx`). Two columns: title, description and comments; then the details (labels, due date, assignees) and **Delete card**, which move under the title on a phone.
- A round checkbox before the title marks the card completed (`CompletedBox` in `board/CardFields.tsx`), saved at once; the line above the title then reads "Completed" and the day. A completed card's due date is green whatever the day, on the board and in the dialog, and screen readers hear "Completed, was due"; on the board the title starts with a green check, read as "Completed:".
- Title and description are text areas drawn as text (a tint on hover, a ring on focus) and save by themselves (`board/use-autosave-text.ts`): on leaving the field, on Enter (title) or Ctrl or ⌘ + Enter (description), and for the description a second after typing stops. A status beside the field reads "Saving…" (with a spinner), then "Saved" in a green pill with a check, for two seconds; a refused save keeps the text, with the API's message and **Try again**. Escape restores the saved text; with nothing to restore it closes the dialog. An empty title is never sent. The dialog opens with the focus on Close, so a stray key edits nothing.
- Each detail is a button opening a panel over the dialog (`board/DetailRow.tsx`, a native `popover`, as the Columns panel: the browser closes it on Escape or a click outside, and `board/use-popover-panel.ts` places it below the button and moves the focus in and back). Labels and assignees save each tick; the due date saves when the panel closes, as a date typed by hand passes through unwanted valid days, and Escape discards it. Each save shows the same badge beside the detail's name (`board/use-saved-notice.ts`); a refused one shows its message under the value and in the panel.
- The board's labels are managed from the labels panel (`board/LabelEditor.tsx`, `board/label-mutations.ts`): each label has a pencil, and **Create label** ends the list; both turn the panel into an editor with the name, the colour (a draft, saved with **Save**; a new label starts with the first palette colour no label has) and a preview of the pill. A name the board already has, in any case, is refused before any request. A label created there goes on the card. **Delete label** says how many cards have it. Escape or **Cancel** goes back to the list without closing the panel; the focus goes back to the label's pencil, to the new label's checkbox, or after a deletion to **Create label**. Each write updates the board's labels and every card's in the cache.
- Columns follow the same pattern (`board/ColumnHeader.tsx`): a click on the title, or its pencil, renames the column; the options button (`aria-expanded`) shows the colour, as radio buttons saved at once, and **Delete column**, which says how many cards go with it. Where the pointer can hover, the pencil and the options button show only on hover or focus.
- The open board is in the address, `/boards/<id>` (`board/use-board-route.ts`, the History API with no router): a reload or a shared link opens the same board, and Back and Forward move between boards. `/` shows the user's first board. An address whose board is not in the user's list (deleted, or another user's) says so, with a link to the first board, without asking the API. `/invite#<token>` is an invitation, its token after the `#`, which browsers never send to a server. Vite's dev server answers any path with the app; the production host will need the same fallback.
- The board's title is the switcher (`board/BoardTitle.tsx`): its initial on a colour, its name and a chevron, a button that opens the list of the user's boards, as links with the open one marked (`aria-current`), and **New board** at the end, which turns into a field in place (`board/CreateBoardForm.tsx`; Escape goes back) and opens the new board. The colour is derived from the board's id, so it needs no field. A long title is cut with an ellipsis, so the header stays on one line; on a phone the card count is hidden and **Columns** shows its icon alone, both still read by screen readers. The options button (⋯) at the end of the header (`board/BoardMenu.tsx`) has **Rename board**, which puts a field in place of the title (Enter or leaving it saves, Escape keeps the title), and **Delete board**, which says how many columns and cards go with it, then opens the first remaining board in place of the deleted one's address. After switching, creating, renaming or deleting a board, the focus goes to the switcher. With no board at all, the page offers **Create your first board** instead.
- The board's **Columns** button (`board/ColumnsPanel.tsx`) opens a panel listing every column with a checkbox: which ones this browser shows, a personal view kept in `localStorage` per board (`board/use-hidden-columns.ts`) and never sent to the API. Hidden columns stay out of the drag and drop; a column dropped among the shown ones lands next to the one it was dropped on. The panel also adds a column, which gets the first palette colour no column has, and the board scrolls to it. With every column hidden, the board offers **Show all columns**.
- Escape inside an editor calls `preventDefault()` when it undoes something (`board/cancel-on-escape.ts` for columns, `undoOnEscape` for cards, the label editor's own handler), so it does not also close the dialog, the column options or the panel around it.
- While a request runs, buttons stay enabled and their handlers ignore clicks (`aria-disabled` shows the state): a disabled button would drop the keyboard focus. A column edit closed from inside it gives the focus back to its pencil button, and a card detail's panel to its button; one closed by clicking elsewhere leaves the focus there. After a column is deleted, the focus goes to the row of columns; after a card is deleted, to the card that took its place in the column, else the one before it, else the column's **Add a card** (`BoardView.tsx`, by the column's and card's `data-` ids).
- Inputs take their `maxLength` from the limits in `@flowboard/shared`, the ones the API enforces. The web app imports only types and limits from the package, never its schemas, so Zod stays out of the bundle.
- ESLint runs the recommended rule sets of `@eslint/js` and `typescript-eslint`, plus `react-hooks` and `react-refresh`.
- Components are functions named in **PascalCase**; their props are typed with `interface XxxProps`.
- Event handlers are named `handleXxx`; the props that receive them `onXxx`.
- State with several shapes is a **discriminated union** (see `ApiStatus` in `api-status/ApiStatusBadge.tsx`).
- CSS class names follow **BEM** (`block__element--modifier`).
- Each component imports its own stylesheet, beside it (`BoardCard.tsx` → `BoardCard.css`); colours, radius and gutter come only from the tokens in `index.css`.
- Code is grouped by feature (`board/`, `auth/`, `api-status/`), not by kind.
- Colours a user picks (`paletteColors` in `@flowboard/shared`) are set with `data-color="…"`: it gives the element the `--tone-*` variables (`index.css`), so no component needs a modifier per colour. A new palette colour adds its four tokens per theme and its `data-color` rule.
- Text only screen readers need (what a colour alone shows) goes in a `.visually-hidden` element (`index.css`).
- Dialogs are a native `<dialog>` opened with `showModal()` (`board/CardDialog.tsx`): the browser traps focus, closes on Escape and gives focus back to the element that opened it. The component is mounted only while open, and its `onClose` unmounts it.
- A clickable card is an `<article>` with the click handler, holding a real `<button>` (its title) for the keyboard and screen readers; the button's click bubbles to the card.
- Hover text is a `<Tooltip>`, never a `title` attribute, which some browsers and webviews do not show. The tooltip is hidden from screen readers, so its text is also in the markup (visible or `.visually-hidden`).
- Due dates are calendar days (`'YYYY-MM-DD'`), compared as strings and shown in the browser's time zone with the helpers in `board/due-date.ts`; never `new Date('YYYY-MM-DD')`, which is midnight UTC and the previous day west of Greenwich.
