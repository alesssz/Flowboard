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
  - [FEAT-3 A board's labels cannot be managed](#feat-3-a-boards-labels-cannot-be-managed)
  - [FEAT-4 Comments cannot be written](#feat-4-comments-cannot-be-written)
- [Tooling (OPS)](#tooling-ops)
  - [OPS-1 Resetting the data covers neither file storage nor production](#ops-1-resetting-the-data-covers-neither-file-storage-nor-production)
  - [OPS-2 The Makefile does not share its common targets with Chronovault and AtleoPlan](#ops-2-the-makefile-does-not-share-its-common-targets-with-chronovault-and-atleoplan)
  - [OPS-3 `prisma generate` asks a question and hangs `pnpm check` in a terminal](#ops-3-prisma-generate-asks-a-question-and-hangs-pnpm-check-in-a-terminal)
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

## Tooling (OPS)

### OPS-1 Resetting the data covers neither file storage nor production

**Priority:** low · **Kind:** tooling · **Found:** 2026-11-22

**What is wrong.** `make db-reset` empties the local database, applies the migrations and seeds it; nothing does the same for files or for production. Once attachments arrive (Roadmap: S3-compatible storage, Cloudflare R2 as in Chronovault), a database reset would leave the bucket holding objects no row points to; once deployed, the production database and bucket could only be emptied by hand.

**Where.** `db:reset` in `apps/api/package.json` and its `Makefile` target; a new script in `scripts/` for the bucket; the production configuration, still to come.

**Options.**
- A) One reset per environment, database and bucket together: `make db-reset` also empties the local bucket, and `make prod-reset` does the same in production, naming the database and bucket it is about to empty and asking for the project's name typed back.
- B) Separate targets per store (`db-reset`, `storage-reset`) in each environment, combined by hand.

**Recommended.** A: the database and the files are only consistent when emptied together. To be done with attachments (bucket) and deployment (production); the names follow OPS-2. Done when a local reset leaves a seeded database and an empty bucket, and the production one does the same only after the typed confirmation, which `yes=1` does not skip.

### OPS-2 The Makefile does not share its common targets with Chronovault and AtleoPlan

**Priority:** low · **Kind:** tooling · **Found:** 2026-11-22

**What is wrong.** The three projects' Makefiles do the same everyday jobs under different names, or leave some out, so moving between them means reading `make help` each time. Starting everything is `make dev` here (after `make db-up`), `make local` in Chronovault, `make start` in AtleoPlan; stopping is `db-down`, `stop`, `down`; rebuilding the database is `db-reset`, `db-reset`, `fresh`. `doctor` and `lint-fix` are missing here, `urls`, `branch`, `sync` and `push` in Chronovault.

**Where.** The `Makefile` and the README's scripts section of each repository; the Makefile rule in each `CLAUDE.md`.

**Options.**
- A) One list of shared targets, each with one meaning, the same section order and the same help format in the three Makefiles: `help`, `doctor`, `setup`, `install`, `urls`, `start` (everything: containers, then the dev servers), `stop`, `dev` (the dev servers only), `build`, `db-reset`, `db-migrate`, `db-seed`, `db-studio`, `lint`, `lint-fix`, `typecheck`, `test`, `check`, `audit`, `github-check`, `branch`, `sync`, `push`, `merge`, `clean`, `clean-all`. Each project writes the recipes its own way and keeps its own targets after them.
- B) A common `.mk` file included by the three Makefiles.

**Recommended.** A: the recipes differ (pnpm and Prisma, pnpm and Supabase, Docker, Composer and npm), so only the names and meanings can be shared, and a file shared across repositories would need copying anyway. The list goes in each `CLAUDE.md`, the same text in all three; a target that does not apply yet (`test` here) is left out, not faked. Done when the shared targets have the same name and meaning in the three `make help` outputs and the old names are gone.

### OPS-3 `prisma generate` asks a question and hangs `pnpm check` in a terminal

**Priority:** high · **Kind:** tooling bug · **Found:** 2026-11-22

**What is wrong.** Run from a terminal, `prisma generate` (Prisma 7.10) asks "Install Prisma's agent skills so AI coding tools work better with this project?", a prompt meant to close by itself after 30 seconds. Inside `pnpm --recursive` the question never shows, and the system stops the process when it reads the keyboard (state `T` in `ps`), so the timeout never fires. `pnpm check`, `pnpm typecheck`, `pnpm build` and `make merge` hang after "Prisma schema loaded from prisma/schema.prisma.". Ctrl+C leaves the stopped `prisma generate` and `pnpm` processes behind, and only `kill -9` ends them. CI, and any run without a terminal, never sees the prompt.

**Where.** `dev`, `build`, `typecheck` and `db:generate` in `apps/api/package.json`; the README's Troubleshooting table.

**Options.**
- A) `--no-hints` on every `prisma generate` in the scripts: it hides Prisma's hints and prompts, and keeps errors and warnings.
- B) Keep the scripts, and merge with `make merge checks=0`, leaving the checks to CI.

**Recommended.** A: one flag, the same in PowerShell and zsh, and a script has no use for hints. B only works around the hang for merges, while `pnpm check` must pass before every commit. Add the symptom and its fix to Troubleshooting. Done when `pnpm check` and `make merge` finish in a terminal on Windows and macOS.

## Documentation (DOCS)

### DOCS-1 The README is a setup guide, not yet the project's showcase

**Priority:** low · **Kind:** docs · **Found:** 2026-11-15

**What is wrong.** The README opens with the status and then setup material: layout, getting started, scripts, troubleshooting. A visitor sees how to run the project before seeing what it does. The showcase shape puts first a centred header (logo, name, one line, CI badge), screenshots (three phone screens and one desktop, dark theme, from a demo account), the features, the engineering highlights (each a constraint and the choice it led to) and the stack with an architecture sketch; then a short quick start, the docs and the status.

**Where.** `README.md`; the setup, scripts and troubleshooting sections move to `docs/`.

**Options.**
- A) Now: move the setup material to `docs/` and add the highlights, without screenshots.
- B) Once the board is usable: the whole rewrite at once, screenshots included.

**Recommended.** B: until the board exists there is nothing to show, and moving the setup twice is wasted work. Done when the README follows the shape above and every section it dropped has a home in `docs/`.
