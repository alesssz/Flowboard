// Runs once before the test files: picks the test database and applies the migrations to it.
import { execSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

// The development container's credentials (compose.yaml), on a database of its own. CI sets TEST_DATABASE_URL.
const LOCAL_TEST_DATABASE_URL = 'postgresql://flowboard:flowboard@localhost:6132/flowboard_test';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default function setup(project: TestProject): void {
  const url = process.env.TEST_DATABASE_URL ?? LOCAL_TEST_DATABASE_URL;
  // Each test empties the database it runs on, so it must be one meant for that.
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(`The test database's name must end in _test; TEST_DATABASE_URL names ${name}`);
  }

  try {
    // Creates the database on the first run. An explicit DATABASE_URL wins over the one in apps/api/.env.
    // Through a shell: on Windows `pnpm` is `pnpm.cmd`, which only a shell finds.
    execSync('pnpm exec prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  } catch (error) {
    const output = (error as { stderr?: Buffer }).stderr?.toString().trim() ?? String(error);
    throw new Error(`Cannot prepare the test database ${name} (is PostgreSQL up? pnpm db:up):\n${output}`);
  }

  project.provide('databaseUrl', url);
}
