# CI and repository security

What GitHub checks on every push, the repository settings that protect the code and its supply chain, and how to verify them all from the terminal.

## Contents

- [What runs, and when](#what-runs-and-when)
- [Rules for workflows](#rules-for-workflows)
- [Repository settings](#repository-settings)
- [Checking the settings: pnpm github:check](#checking-the-settings-pnpm-githubcheck)
- [Responding to a problem](#responding-to-a-problem)
- [Merging](#merging)
- [Local safeguards](#local-safeguards)

---

## What runs, and when

| What | Runs | Does | Fails when |
|---|---|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | every push, to any branch; by hand | `pnpm typecheck`, `pnpm lint`, `pnpm build` on a fresh Linux runner | any check fails |
| [`audit.yml`](../.github/workflows/audit.yml) | Mondays 06:00 UTC; a push or fork pull request changing a `package.json`, the lockfile or `pnpm-workspace.yaml`; by hand | `pnpm audit` over the whole workspace, and a list of outdated packages in the job summary | any advisory, of any severity |
| [`dependabot.yml`](../.github/dependabot.yml) | Mondays | one pull request updating the pinned GitHub Actions | never: its own CI run is the check |
| CodeQL default setup (no file) | every push to `main`, and weekly | static analysis of the TypeScript and of the workflows | never fails a push: it opens alerts under **Security → Code scanning** |

Both workflows share [`.github/actions/setup`](../.github/actions/setup/action.yml): Node from `.nvmrc`, pnpm at the version pinned in `package.json`, `pnpm install --frozen-lockfile`, with the pnpm store cached on the lockfile's hash. `--frozen-lockfile` makes a lockfile out of step with a `package.json` fail the run instead of being rewritten on the runner.

CI runs on every branch, so a branch is checked before it reaches `main`, and only through a pull request whose CI passed ([Merging](#merging)). A new push to a branch cancels its run still in progress; on `main` every commit keeps its run. Pull requests from forks run nothing until the owner approves them. The audit runs on pull requests from forks only, since branches of this repository are already audited on push; its job summary lists outdated packages without failing the run.

**Why `pnpm audit` beside Dependabot alerts:** an alert only warns, on GitHub's page, once the vulnerable version is on `main`; the Audit run fails the branch that brings it, next to its CI, and runs the same check locally (`pnpm audit`). Dependabot reads `pnpm-lock.yaml` for the alerts and opens a pull request for a fix when one exists; npm version updates are left out of `dependabot.yml` and made by hand.

An advisory with no fixed version reachable through the normal tree is fixed by forcing a version in `pnpm-workspace.yaml` (`overrides`), with a comment giving the advisory, who still asks for the old version and when to remove the override.

## Rules for workflows

- **Only actions created by GitHub** (`actions/*`, plus `github/codeql-action` run by CodeQL's default setup). A third-party action is code that runs with the repository's token; the repository settings refuse any other before it runs. pnpm is installed with npm for that reason.
- **Pinned to a full commit hash**, with the release in a comment: `actions/checkout@3d3c42e… # v7.0.1`. A tag can be moved by whoever controls the action's repository; a commit cannot. Dependabot updates the hash and the comment together.
- **Read-only token**: every workflow declares `permissions: contents: read`, and checkouts use `persist-credentials: false`, so later steps cannot reuse the token.
- **No secrets** so far. When one is needed, it goes in **Settings → Secrets and variables → Actions** (or an environment restricted to `main`), never in a file.
- `timeout-minutes` on every job, so a stuck run does not burn GitHub's six-hour limit.

## Repository settings

Made by the owner on github.com (or with `gh api`), and verified by `pnpm github:check`.

**Settings → General**

| Setting | Choice | Why |
|---|---|---|
| Features | Wikis, Projects, Discussions off; Issues on | Documentation lives in the repository; fewer surfaces to watch |
| Pull Requests | **Allow merge commits**, **Allow auto-merge**, **Automatically delete head branches** | `pnpm merge:main` hands the merge to GitHub, as a merge commit, once CI passes; merged branches do not pile up |

**Settings → Actions → General**

| Setting | Choice | Why |
|---|---|---|
| Actions permissions | Allow select actions, with only **Allow actions created by GitHub** ticked | See [Rules for workflows](#rules-for-workflows) |
| Approval for running fork pull request workflows | **Require approval for all external contributors** | A stranger's pull request runs nothing until it has been read |
| Workflow permissions | **Read repository contents**; creating and approving pull requests off | The default token cannot write, whatever a workflow asks |

**Settings → Advanced Security** (on some accounts **Code security**)

| Setting | Choice | Why |
|---|---|---|
| Private vulnerability reporting | On | Problems are reported privately from the **Security** tab ([SECURITY.md](../SECURITY.md)), not in a public issue |
| Dependency graph, Dependabot alerts, Dependabot security updates | On | An alert, and a fix pull request when one exists, for a vulnerable npm package or GitHub Action |
| Secret Protection, with Push protection | On | The whole history is scanned, and a push holding a known kind of secret is refused |
| CodeQL analysis | **Default setup**, default query suite | Free on public repositories, run with GitHub's own action |

**Settings → Rules → Rulesets:** a branch ruleset named `main`, **Active**, targeting the default branch, with **Restrict deletions**, **Block force pushes**, **Require a pull request before merging** (no approvals: one contributor) and **Require status checks to pass** (*Types, lint and build*), and no bypass list. Nobody, the owner included, can delete `main`, rewrite its history or bring in a commit whose CI did not pass.

**The account** (outside the repository, but whoever controls it controls the repository): two-factor authentication with an app or a passkey; **Keep my email addresses private** and **Block command line pushes that expose my email**; no personal access tokens or SSH keys that are not in use.

## Checking the settings: pnpm github:check

[`scripts/github-check.mjs`](../scripts/github-check.mjs) reads every setting above through GitHub's REST API and compares it with the decision: ✔ as decided, ⚠ worth a look, ✖ to fix, with where to change it. It also lists open alerts and the last CI and Audit runs on `main`. It only reads.

```powershell
pnpm github:check
```

It needs [GitHub CLI](https://cli.github.com) signed in as the owner (`gh auth login`, once per computer). Run it after changing a setting, and now and then.

## Responding to a problem

- **A secret committed by mistake:** revoke or rotate it first (it is public from the moment it was pushed), then remove it from the code. Push protection stops the known kinds of secret, not all of them.
- **The Audit run fails:** `pnpm audit` locally shows the advisory and `pnpm why -r <package>` who brings the package. Update the direct dependency if a release fixes it; otherwise force a fixed version in `overrides`, with its comment. Never silence a run that stays red: a permanent failure hides the next one.
- **A CodeQL alert:** read it under **Security → Code scanning**; fix it, or dismiss it with a reason when it is a false positive.
- **A private vulnerability report:** it arrives by email and in the **Security** tab; answer there, and fix it like any bug.

## Merging

A branch reaches `main` with `pnpm merge:main` ([`scripts/merge-main.mjs`](../scripts/merge-main.mjs)), from the pushed branch. It stops if the branch is not ready (uncommitted or unpushed work, nothing new, a conflict with `main`), runs `pnpm check` (the CI's checks), shows the commits and asks; then it opens the pull request, or reuses the open one, and turns on auto-merge: GitHub merges once CI passes, with a merge commit listing the branch's commits, even if the terminal is closed. Then it updates `main` and deletes the branch on GitHub and locally. A failed check stops it with nothing merged. `--yes` skips the question, `--no-checks` the local checks (CI still runs them). `make merge` runs the same script, with `yes=1` and `checks=0` for the two flags.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## Local safeguards

- `.githooks/pre-commit` refuses a commit whose author or committer is not the GitHub noreply address, so a real email address never reaches the public history. Enabled once per clone with `git config core.hooksPath .githooks`.
- `.gitignore` keeps `.env` files out; a committed `.env.example` will document the variables, with no values.
- pnpm refuses dependency install scripts that are not allowlisted in `pnpm-workspace.yaml` (`allowBuilds`).
