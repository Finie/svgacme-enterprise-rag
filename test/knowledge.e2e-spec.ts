import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../scripts/database/lib/client.js';
import { config } from '../scripts/knowledge/chunking.js';
import {
  buildKnowledge,
  validateKnowledge,
} from '../scripts/knowledge/pipeline.js';
const prisma = createPrismaClient();
afterAll(async () => {
  await prisma.$disconnect();
});
describe.sequential('knowledge PostgreSQL integration', () => {
  it('builds twice without changing any row or timestamp', async () => {
    const cfg = config({});
    await buildKnowledge(prisma, cfg);
    const first = await prisma.knowledgeChunk.findMany({
      orderBy: { id: 'asc' },
    });
    expect(first.length).toBeGreaterThan(0);
    expect(await buildKnowledge(prisma, cfg)).toMatchObject({
      written: 0,
      removed: 0,
      unchanged: first.length,
    });
    expect(
      await prisma.knowledgeChunk.findMany({ orderBy: { id: 'asc' } }),
    ).toEqual(first);
    expect(await validateKnowledge(prisma, cfg)).toMatchObject({
      validation: 'PASS',
    });
  }, 120000);
  it('builds selected narratives and removes them on deselection', async () => {
    const source = await prisma.scenario.findFirstOrThrow({
      orderBy: { scenarioId: 'asc' },
    });
    try {
      const cfg = { ...config({}), scenarioIds: [source.scenarioId] };
      expect(
        (await buildKnowledge(prisma, cfg)).scenarioChunks,
      ).toBeGreaterThan(0);
      expect(await validateKnowledge(prisma, cfg)).toMatchObject({
        validation: 'PASS',
      });
      expect(await buildKnowledge(prisma, cfg)).toMatchObject({
        written: 0,
        removed: 0,
      });
    } finally {
      await buildKnowledge(prisma, config({}));
    }
    expect(
      await prisma.knowledgeChunk.count({
        where: { documentType: 'SCENARIO' },
      }),
    ).toBe(0);
  }, 120000);
  it('database rejects incompatible sources and orphan sections', async () => {
    const row = await prisma.knowledgeChunk.findFirstOrThrow();
    const attempt = async (
      policyId: string | null,
      ordinal: number | null,
      scenarioId: string | null,
    ) =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`INSERT INTO knowledge_chunks (id, document_type, source_id, policy_id, policy_section_ordinal, scenario_id, chunk_index, content, metadata, content_hash, chunking_version, updated_at) VALUES ('invalid-test', 'POLICY', ${row.sourceId}, ${policyId}, ${ordinal}, ${scenarioId}, 99999, 'text', '{}', ${row.contentHash}, 'test', NOW())`;
        throw new Error('UNEXPECTED_ACCEPTANCE');
      });
    for (const args of [
      [row.policyId, row.policySectionOrdinal, 'missing-scenario'],
      [row.policyId, 999999, null],
      [null, null, null],
    ] as const) {
      await expect(attempt(args[0], args[1], args[2])).rejects.not.toThrow(
        'UNEXPECTED_ACCEPTANCE',
      );
    }
  });
});
