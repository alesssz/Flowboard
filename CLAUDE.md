# Flowboard — notes for AI assistants

A real-time collaborative kanban board (boards, columns, draggable cards, live updates between users). One pnpm workspace: a React 19 / TypeScript / Vite single-page app (`apps/web`) and a Node.js 24 / Express 5 / TypeScript API (`apps/api`). Start from [README.md](README.md); the package READMEs ([apps/web](apps/web/README.md), [apps/api](apps/api/README.md)) describe each side.

## Running things

- **pnpm only**, from the repository root; the version is pinned by `packageManager` in `package.json`. Never mix in `npm install` or `yarn`: they would ignore the workspace and the lockfile.
- Everyday scripts, run in every package that defines them: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`. One package only: `pnpm --filter @flowboard/api <script>`.
- Ports: the web app on **5173** (`strictPort`), the API on **3000** (`PORT` overrides it). In development Vite proxies `/api/*` to the API, so the browser sees a single origin and CORS is not involved.
- **`pnpm dev` does not type-check**: tsx and Vite only strip types. `pnpm typecheck` and `pnpm lint` must pass before a commit.
- Dependency install scripts are blocked by pnpm unless allowlisted in `pnpm-workspace.yaml` (`allowBuilds`). Add an entry only for a package whose script is understood and needed.
- The development machine is Windows: commands in the docs are written for PowerShell.
- `.env` files hold secrets: never read or print them; new variables are documented in a committed `.env.example`.
- **CI and security** ([docs/ci-and-security.md](docs/ci-and-security.md)): GitHub runs `ci.yml` (typecheck, lint, build) on every push and `audit.yml` (`pnpm audit`) weekly and on dependency changes; both share `.github/actions/setup`. Workflows use **only GitHub's own actions**, pinned to a full commit hash with the release in a comment, with `permissions: contents: read` and `persist-credentials: false`. A new action, permission or secret is a decision to document there first. An advisory is fixed (update, or `overrides` in `pnpm-workspace.yaml` with a comment saying why and when to remove it), never silenced. `pnpm github:check` compares the repository's settings on GitHub with the documented ones (read-only, needs `gh`).

## Code conventions

- TypeScript `strict` plus `noUncheckedIndexedAccess`; `verbatimModuleSyntax` (type-only imports use `import type`); `erasableSyntaxOnly` (no `enum` or `namespace`: string-literal unions instead).
- API: ESM with `module: nodenext`; relative imports carry the `.ts` extension, rewritten to `.js` by `tsc` (`rewriteRelativeImportExtensions`). Every route lives under `/api` and every response, errors included, is JSON. `app.ts` builds the app, `index.ts` starts it.
- Web: components in PascalCase, props typed with `interface XxxProps`, event handlers named `handleXxx` and the props that receive them `onXxx`, multi-shape state modelled as discriminated unions, CSS class names in BEM.
- Semicolons, single quotes.

## Working rules

- **Everything in the repository is in English**: code, comments, docs, UI text, commit messages.
- **Comments explain why**, for a developer who knows the stack: decisions, constraints, trade-offs, edge cases, behaviour that is not obvious from the code. No explanations of what the language or the framework does. Each source and configuration file opens with a short header saying what it is for.
- **A change updates the docs it touches in the same commit**: the root README (status, stack, setup, scripts, troubleshooting, roadmap), the package READMEs (scripts, endpoints, environment variables, structure), `docs/`, this file.
- **Docs read as a well-kept project, not a course**: setup, commands, configuration, decisions and known problems, written for someone who will run or maintain the project. A problem actually met goes in the root README's Troubleshooting table (symptom, then fix). No tutorials, no explanations of the stack itself.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- Git identity: the GitHub noreply address only. `.githooks/pre-commit` refuses any other identity (active after `git config core.hooksPath .githooks`).
