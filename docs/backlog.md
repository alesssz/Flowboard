# Backlog

Work that is known and waiting: bugs, interface fixes, features, API and data changes, tooling, docs. One entry per point, each small enough to be picked up and finished on its own, with what is wrong (or missing), where, the options and the one recommended.

The README's [Roadmap](../README.md#roadmap) lists the directions; a direction becomes entries here once it is cut into pieces that can be done one at a time.

## Contents

- [How this page works](#how-this-page-works)
  - [Template](#template)
- [Interface (UI)](#interface-ui)
  - [UI-1 Deleting a card leaves the focus nowhere](#ui-1-deleting-a-card-leaves-the-focus-nowhere)
- [Features (FEAT)](#features-feat)
  - [FEAT-1 A finished card still shows as overdue](#feat-1-a-finished-card-still-shows-as-overdue)
  - [FEAT-2 Columns cannot be added, renamed, recoloured or deleted](#feat-2-columns-cannot-be-added-renamed-recoloured-or-deleted)
  - [FEAT-3 A board's labels cannot be managed](#feat-3-a-boards-labels-cannot-be-managed)
  - [FEAT-4 Comments cannot be written](#feat-4-comments-cannot-be-written)
- [Documentation (DOCS)](#documentation-docs)
  - [DOCS-1 The README is a setup guide, not yet the project's showcase](#docs-1-the-readme-is-a-setup-guide-not-yet-the-projects-showcase)

## How this page works

- **One point, one branch** from `main` (`fix/…`, `feat/…`, `chore/…`, `docs/…`); several small points may share one.
- **Done means deleted.** The branch that does a point removes its entry in the same commit. What the change did is told by the commit and by the docs it touched, not here.
- **IDs are never reused.** Each entry has an area prefix and a number (`UI-5`, `API-2`), kept for good. Each area counts on its own; the next number is one above the highest ever used in that area (`git log -S "UI-" -- docs/backlog.md` finds deleted ones).
- **Areas** appear with their first entry and go when they empty:

  | Prefix | Area |
  |---|---|
  | `UI` | Web app: layout, interaction, accessibility |
  | `FEAT` | New features, or changes to what an existing one does |
  | `API` | Server: routes, services, performance |
  | `DATA` | Database: schema, migrations |
  | `OPS` | Tooling, CI, deployment, dependencies |
  | `DOCS` | Documentation |

  A point that touches several areas goes where most of the work is.
- **Priority** is high (broken, or in the way), medium (worse than it should be) or low (polish). Within an area entries are in the order they were added.

### Template

```markdown
### UI-n Short statement of the problem

**Priority:** high | medium | low · **Kind:** e.g. layout bug, missing feature · **Found:** YYYY-MM-DD

**What is wrong.** What happens, where it shows, how to see it, and why it matters.

**Where.** Files and parts of them.

**Options.**
- A) …
- B) …

**Recommended.** Which option, why, and how to check it is done.
```

## Interface (UI)

### UI-1 Deleting a card leaves the focus nowhere

**Priority:** low · **Kind:** accessibility · **Found:** 2026-11-20

**What is wrong.** After **Delete card** is confirmed, the dialog closes and gives the focus back to the button that opened it, the deleted card's title, which is gone: the focus falls to the page. A keyboard or screen reader user starts again from the top of the page.

**Where.** `DeleteCard` in `apps/web/src/board/CardFields.tsx`; `handleDeleted` in `CardDialog.tsx`; `BoardView.tsx`, which knows the columns.

**Options.**
- A) Focus the card that took the deleted one's place in its column (the next, else the previous), else the column's **Add a card**.
- B) Always focus the column's **Add a card**.

**Recommended.** A: it keeps the user where they were in the column. Done when, after a deletion, the focus is on a neighbouring card or on **Add a card**, checked with the keyboard alone.

## Features (FEAT)

### FEAT-1 A finished card still shows as overdue

**Priority:** medium · **Kind:** missing feature · **Found:** 2026-11-18

**What is wrong.** A card's due date turns red once the day has passed, wherever the card is. Columns carry no meaning (`Column.color` is only a colour), so the web app cannot tell that a card in "Done" is finished: one with a past due date reads as late. The sample board hides it by giving its done cards no due date.

**Where.** `Card` in `packages/shared/src/board.ts`; `getDueStatus` in `apps/web/src/board/due-date.ts`; `DueDate.tsx`.

**Options.**
- A) A completed flag on the card (`completedAt: string | null`), set by a checkbox on the card; a completed card's date loses the overdue colour.
- B) A column marked as the finishing one; cards in it are completed.
- C) A due date leaves the card when it moves to a finishing column.

**Recommended.** A: it keeps columns free of meaning, works on boards with any workflow and records when the work ended. To be done with board editing, which brings the controls. Done when a completed card with a past due date is not red, and its state is announced to screen readers.

### FEAT-2 Columns cannot be added, renamed, recoloured or deleted

**Priority:** high · **Kind:** missing feature · **Found:** 2026-11-20

**What is wrong.** Cards can be edited, columns cannot: a board keeps the columns of the seed.

**Where.** New routes in `apps/api/src/columns/` and schemas in `packages/shared/src/` (as for cards); `BoardColumn.tsx`, `BoardView.tsx`.

**Options.**
- A) The column header edits in place like a card's title (rename), with a menu for the colour and **Delete column**; **Add a column** after the last lane.
- B) A board settings dialog listing the columns.

**Recommended.** A, matching card editing. Deleting a column with cards asks first and says how many go with it. Moving columns waits for drag and drop. Done when a column can be added, renamed, recoloured and deleted, each through the API.

### FEAT-3 A board's labels cannot be managed

**Priority:** medium · **Kind:** missing feature · **Found:** 2026-11-20

**What is wrong.** A card can be given any of the board's labels, but the labels themselves (name, colour, order) come from the seed.

**Where.** `Label` in `apps/api/prisma/schema.prisma`; the labels editor in `CardFields.tsx`.

**Options.**
- A) **Create label** and an edit button per label inside the card's labels editor.
- B) A labels section in a board settings dialog.

**Recommended.** A: labels are created when a card needs one, as in most boards. Deleting a label removes it from every card, after a confirmation naming how many. Done when labels can be created, renamed, recoloured and deleted.

### FEAT-4 Comments cannot be written

**Priority:** medium · **Kind:** missing feature · **Found:** 2026-11-20

**What is wrong.** A card's comments can be read, not written. A comment has an author, and there are no accounts yet.

**Where.** `apps/api/src/cards/`; the comments section of `CardDialog.tsx`.

**Options.**
- A) Now, with the author picked from the board's members (or a fixed one), replaced by the signed-in user later.
- B) With accounts and sign-in.

**Recommended.** B: an author chosen by hand would be thrown away with sign-in, and so would the code choosing it. Done when a signed-in member can write, edit and delete their own comments.

## Documentation (DOCS)

### DOCS-1 The README is a setup guide, not yet the project's showcase

**Priority:** low · **Kind:** docs · **Found:** 2026-11-15

**What is wrong.** The README opens with the status and then setup material: layout, getting started, scripts, troubleshooting. A visitor sees how to run the project before seeing what it does. The showcase shape puts first a centred header (logo, name, one line, CI badge), screenshots (three phone screens and one desktop, dark theme, from a demo account), the features, the engineering highlights (each a constraint and the choice it led to) and the stack with an architecture sketch; then a short quick start, the docs and the status.

**Where.** `README.md`; the setup, scripts and troubleshooting sections move to `docs/`.

**Options.**
- A) Now: move the setup material to `docs/` and add the highlights, without screenshots.
- B) Once the board is usable: the whole rewrite at once, screenshots included.

**Recommended.** B: until the board exists there is nothing to show, and moving the setup twice is wasted work. Done when the README follows the shape above and every section it dropped has a home in `docs/`.
