# Flowboard's commands: `make help` lists them. Shortcuts for the pnpm scripts,
# plus setup, Git and cleanup steps. Every recipe line is a single pnpm, git or
# node command, so the same Makefile runs from PowerShell (where Make uses
# cmd.exe), Git Bash and zsh: no bash, grep or rm, and no shell quoting.
# Values are passed as variables, since Make reads anything after the target as
# more targets: make branch name=feat/board-ui.

.DEFAULT_GOAL := help
.PHONY: help setup install urls dev dev-web dev-api build \
        typecheck lint check audit github-check \
        branch sync push merge clean clean-all

PNPM := pnpm

help: ## Show this list
	@node scripts/make-help.mjs $(MAKEFILE_LIST)

# --- First run ----------------------------------------------------------------

setup: ## New clone: install the packages and enable the commit identity check (.githooks)
	$(PNPM) install
	git config core.hooksPath .githooks

install: ## Install every package from the lockfile (after a pull that changed it)
	$(PNPM) install

# Through node: echo would print cmd.exe's quotes, or lose the alignment in sh.
urls: ## The local addresses
	@node -e "console.log('Web app (Vite)   http://localhost:5173')"
	@node -e "console.log('API (Express)    http://localhost:3000')"
	@node -e "console.log('Health check     http://localhost:3000/api/health')"

# --- Development --------------------------------------------------------------

dev: ## Start the web app and the API, reloading on change (http://localhost:5173)
	$(PNPM) dev

dev-web: ## Start the web app only (the API calls fail until the API is up)
	$(PNPM) --filter @flowboard/web dev

dev-api: ## Start the API only (http://localhost:3000)
	$(PNPM) --filter @flowboard/api dev

build: ## Type-check and build every package for production
	$(PNPM) build

# --- Quality ------------------------------------------------------------------

typecheck: ## Type-check every package
	$(PNPM) typecheck

lint: ## ESLint (web app for now)
	$(PNPM) lint

check: ## The CI's checks: type-check, lint, build; run before a commit
	$(PNPM) check

audit: ## Known vulnerabilities in the dependencies (report only, changes nothing)
	$(PNPM) audit

github-check: ## The repository's settings on GitHub and its last runs, against the ones decided (needs gh)
	$(PNPM) github:check

# --- Git ----------------------------------------------------------------------

# Every recipe line is expanded before the first one runs, so a missing name
# stops here with nothing done.
branch: ## New branch from an up-to-date main: make branch name=feat/board-ui
	$(if $(name),,$(error Usage: make branch name=feat/<short-name>))
	git switch main
	git pull --ff-only origin main
	git switch -c $(name)

sync: ## Go to main, bring it up to date with GitHub, forget the branches deleted there
	git switch main
	git pull --ff-only origin main
	git fetch --prune origin

push: ## Push the current branch to GitHub (sets the upstream the first time)
	git push -u origin HEAD

# Make treats anything starting with "--" as one of its own options, so the
# script's flags are variables instead (yes=1 → --yes, checks=0 → --no-checks).
merge: ## Run pnpm check, open a pull request, have GitHub merge it into main once CI passes, delete the branch (asks first; yes=1 skips the question, checks=0 the checks)
	$(PNPM) merge:main $(if $(yes),--yes) $(if $(filter 0,$(checks)),--no-checks)

# --- Cleanup ------------------------------------------------------------------

clean: ## Remove the builds (dist/ of every package)
	node scripts/clean.mjs

clean-all: ## Also remove every node_modules (then make install)
	node scripts/clean.mjs --all
