// Prisma CLI configuration: schema, migrations, seed command and database URL.
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// The CLI reads no .env of its own. Without one (CI) DATABASE_URL stays unset: prisma generate
// needs no database, while migrate and seed stop and ask for it.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/db/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
