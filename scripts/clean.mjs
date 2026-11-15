#!/usr/bin/env node
/**
 * Removes the builds of every workspace package (`make clean`), and with
 * `--all` every node_modules too (`make clean-all`). In Node rather than
 * `rm -rf`, which PowerShell lacks.
 */
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const all = process.argv.includes('--all');

// Mirrors the `packages` globs in pnpm-workspace.yaml.
const WORKSPACE_DIRS = ['apps', 'packages'];

const packages = WORKSPACE_DIRS.map((dir) => join(ROOT, dir))
  .filter((dir) => existsSync(dir))
  .flatMap((dir) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(dir, entry.name)),
  );

// The web app keeps its .tsbuildinfo files in node_modules/.tmp, so --all
// also resets the incremental type-check.
const targets = [
  ...packages.map((pkg) => join(pkg, 'dist')),
  ...(all ? [...packages.map((pkg) => join(pkg, 'node_modules')), join(ROOT, 'node_modules')] : []),
];

const existing = targets.filter((path) => existsSync(path));
for (const target of existing) {
  rmSync(target, { recursive: true, force: true });
  console.log(`removed ${relative(ROOT, target).replaceAll('\\', '/')}`);
}
if (existing.length === 0) console.log('nothing to remove');
