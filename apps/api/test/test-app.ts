// The app under test, on the test database, which is emptied before each test.
import request from 'supertest';
import { afterAll, beforeEach, inject } from 'vitest';
import { createApp } from '../src/app.ts';
import { createPrismaClient } from '../src/db/client.ts';

/** Called at the top of a test file: `api` sends requests to the app, `prisma` reads and writes the data. */
export function useTestApp() {
  const prisma = createPrismaClient(inject('databaseUrl'));
  const api = request(createApp(prisma));

  beforeEach(async () => {
    // Every table hangs off Board or User, so the cascade empties them all.
    await prisma.$executeRaw`TRUNCATE "Board", "User" CASCADE`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  return { api, prisma };
}
