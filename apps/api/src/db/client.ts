// The Prisma client, talking to PostgreSQL through the node-postgres driver adapter.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

export type { PrismaClient };

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** DATABASE_URL, or an error saying where it is set. */
export function readDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is not set: copy apps/api/.env.example to apps/api/.env');
  }
  return url;
}
