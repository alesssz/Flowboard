#!/usr/bin/env node
/**
 * Prints the Makefile's targets with their `## description`: what `make help`
 * shows. In Node rather than grep and awk, which PowerShell lacks.
 *
 *   node scripts/make-help.mjs Makefile [more makefiles…]
 */
import { readFileSync } from 'node:fs';
import { styleText } from 'node:util';

// `target: prerequisites ## description`; targets without `##` stay unlisted.
const TARGET = /^([a-zA-Z0-9_-]+):[^#]*## (.+)$/;

const files = process.argv.slice(2);
const targets = files.flatMap((file) =>
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => TARGET.exec(line))
    .filter((match) => match !== null)
    .map(([, name, description]) => ({ name: name ?? '', description: description ?? '' })),
);

const width = Math.max(...targets.map(({ name }) => name.length)) + 2;

console.log('Flowboard - available commands:');
for (const { name, description } of targets) {
  console.log(`  ${styleText('cyan', name.padEnd(width))}${description}`);
}
