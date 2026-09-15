import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { createPrismaClient } from './lib/client.js';
import { seedEnterprise } from './seed-enterprise.js';
import { seedMasterData } from './seed-master-data.js';
import { seedPolicies } from './seed-policies.js';
import { seedScenarios } from './seed-scenarios.js';
import { seedEvaluation } from './seed-evaluation.js';

/**
 * Imports the full generated corpus (data/enterprise, data/master-data,
 * data/policies, data/scenarios, data/test-questions) into PostgreSQL.
 *
 * Runs as one transaction because departments <-> roles and departments <->
 * cost_centers are cyclic FKs (DEFERRABLE INITIALLY DEFERRED); they are only
 * checked once every table in this run has committed. See
 * docs/database/architecture.md.
 *
 * Idempotent: every write is an upsert keyed by the source's own business ID
 * (or composite ordinal key), so running this twice does not duplicate rows.
 */
export async function seedAll(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await seedEnterprise(tx);
      await seedMasterData(tx);
      await seedPolicies(tx);
      await seedScenarios(tx);
      await seedEvaluation(tx);
    },
    { timeout: 5 * 60 * 1000, maxWait: 30 * 1000 },
  );
}

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  try {
    await seedAll(prisma);
    console.log('Seed: OK');
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  });
}
