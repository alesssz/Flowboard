// Vitest for the API: tests through HTTP (Supertest) against a PostgreSQL database of their own.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // The files share one database and each empties it: one file at a time.
    fileParallelism: false,
  },
});
