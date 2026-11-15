# Backlog

Work that is known and waiting: bugs, interface fixes, features, API and data changes, tooling, docs. One entry per point, each small enough to be picked up and finished on its own, with what is wrong (or missing), where, the options and the one recommended.

The README's [Roadmap](../README.md#roadmap) lists the directions; a direction becomes entries here once it is cut into pieces that can be done one at a time.

## Contents

- [How this page works](#how-this-page-works)
  - [Template](#template)
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

## Documentation (DOCS)

### DOCS-1 The README is a setup guide, not yet the project's showcase

**Priority:** low · **Kind:** docs · **Found:** 2026-11-15

**What is wrong.** The README opens with the status and then setup material: layout, getting started, scripts, troubleshooting. A visitor sees how to run the project before seeing what it does. The showcase shape puts first a centred header (logo, name, one line, CI badge), screenshots (three phone screens and one desktop, dark theme, from a demo account), the features, the engineering highlights (each a constraint and the choice it led to) and the stack with an architecture sketch; then a short quick start, the docs and the status.

**Where.** `README.md`; the setup, scripts and troubleshooting sections move to `docs/`.

**Options.**
- A) Now: move the setup material to `docs/` and add the highlights, without screenshots.
- B) Once the board is usable: the whole rewrite at once, screenshots included.

**Recommended.** B: until the board exists there is nothing to show, and moving the setup twice is wasted work. Done when the README follows the shape above and every section it dropped has a home in `docs/`.
