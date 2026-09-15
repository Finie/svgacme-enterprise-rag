import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx scripts/database/seed.ts' },
  // Generation/build does not require a database; connection commands require this value.
  datasource: { url: process.env.DATABASE_URL },
});
