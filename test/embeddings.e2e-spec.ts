import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '../scripts/database/lib/client.js';
import { embeddingConfig } from '../apps/src/embeddings/config.js';
import type { EmbeddingProvider } from '../apps/src/embeddings/embedding-provider.js';
import { EmbeddingsService } from '../apps/src/embeddings/embeddings.service.js';
import {
  candidates,
  persistEmbedding,
  validateEmbeddings,
  type Candidate,
} from '../apps/src/embeddings/embedding-store.js';
import { SemanticSearchService } from '../apps/src/search/semantic-search.service.js';
import type {
  Prisma,
  PrismaClient,
} from '../apps/src/generated/prisma/client.js';
import { buildKnowledge } from '../scripts/knowledge/pipeline.js';
import { config } from '../scripts/knowledge/chunking.js';
const db = createPrismaClient();
const cfg = {
  ...embeddingConfig({}),
  provider: 'test-only',
  model: 'deterministic-fixture',
  version: randomUUID(),
  batchSize: 32,
};
const vector = (x: number, y = 0) => [x, y, ...Array(1534).fill(0)];
class FakeProvider implements EmbeddingProvider {
  apiCalls = 0;
  space = cfg;
  async embed(_text: string) {
    this.apiCalls++;
    return vector(1);
  }
  async embedBatch(texts: string[]) {
    this.apiCalls++;
    return texts.map(() => vector(1));
  }
}
const rollback = new Error('rollback test');
async function isolated(
  fn: (tx: Prisma.TransactionClient, client: PrismaClient) => Promise<void>,
) {
  try {
    await db.$transaction(
      async (tx) => {
        const client = new Proxy(tx, {
          get(target, key) {
            if (key === '$transaction')
              return (
                callback: (t: Prisma.TransactionClient) => Promise<unknown>,
              ) => callback(tx);
            return Reflect.get(target, key);
          },
        }) as PrismaClient;
        await fn(tx, client);
        throw rollback;
      },
      { timeout: 120000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
}
afterAll(() => db.$disconnect());
describe.sequential(
  'pgvector embeddings (fake provider, rollback-only fixtures)',
  () => {
    it('inserts vectors, ranks cosine distance, filters in SQL and preserves provenance', () =>
      isolated(async (tx) => {
        const chunks = (await candidates(tx, cfg)).slice(0, 3);
        expect(chunks).toHaveLength(3);
        await persistEmbedding(tx, chunks[0], cfg, vector(1));
        await persistEmbedding(tx, chunks[1], cfg, vector(0, 1));
        await persistEmbedding(tx, chunks[2], cfg, vector(-1));
        const search = new SemanticSearchService(tx, new FakeProvider());
        const results = await search.search('query', { topK: 3 });
        expect(results.map((r) => r.chunkId)).toEqual(chunks.map((c) => c.id));
        expect(results.map((r) => r.score)).toEqual([1, 0, -1]);
        const first = results[0];
        expect(first.policySectionId).toBe(
          `${first.policyId}:${first.policySectionOrdinal}`,
        );
        expect(first.sectionHeading).toBeTruthy();
        const filtered = await search.search('query', {
          topK: 10,
          documentType: 'POLICY',
          policyId: first.policyId!,
          policySectionId: first.policySectionId!,
          category: first.category!,
        });
        expect(filtered.length).toBeGreaterThan(0);
        expect(
          filtered.every((r) => r.policySectionId === first.policySectionId),
        ).toBe(true);
        expect(
          await search.search('query', { category: "x' OR true --" }),
        ).toEqual([]);
        expect(
          await search.search('query', { documentType: 'SCENARIO' }),
        ).toEqual([]);
        const stored = await tx.$queryRaw<
          { dimensions: number }[]
        >`SELECT vector_dims(embedding) AS dimensions FROM knowledge_chunk_embeddings WHERE embedding_provider = 'test-only'`;
        expect(stored.every((r) => r.dimensions === 1536)).toBe(true);
      }));
    it('prevents duplicates and replaces changed content while excluding stale vectors', () =>
      isolated(async (tx) => {
        const [chunk] = await candidates(tx, cfg);
        await persistEmbedding(tx, chunk, cfg, vector(1));
        await persistEmbedding(tx, chunk, cfg, vector(1));
        expect(
          await tx.knowledgeChunkEmbedding.count({
            where: { embeddingProvider: cfg.provider },
          }),
        ).toBe(1);
        expect((await candidates(tx, cfg)).some((c) => c.id === chunk.id)).toBe(
          false,
        );
        expect(
          (await candidates(tx, { ...cfg, model: 'another-model' })).some(
            (c) => c.id === chunk.id,
          ),
        ).toBe(true);
        expect(
          (await candidates(tx, { ...cfg, version: 'another-version' })).some(
            (c) => c.id === chunk.id,
          ),
        ).toBe(true);
        const changed = { ...chunk, contentHash: 'a'.repeat(64) };
        await tx.knowledgeChunk.update({
          where: { id: chunk.id },
          data: { contentHash: changed.contentHash, content: 'New content' },
        });
        expect((await candidates(tx, cfg)).some((c) => c.id === chunk.id)).toBe(
          true,
        );
        const search = new SemanticSearchService(tx, new FakeProvider());
        expect(await search.search('query')).toEqual([]);
        expect(await persistEmbedding(tx, chunk, cfg, vector(1))).toBe(0);
        await persistEmbedding(tx, changed, cfg, vector(0, 1));
        expect((await search.search('query'))[0].score).toBe(0);
        expect(
          await tx.knowledgeChunkEmbedding.count({
            where: { embeddingProvider: cfg.provider },
          }),
        ).toBe(1);
        await tx.knowledgeChunk.update({
          where: { id: chunk.id },
          data: { chunkingVersion: 'new-algorithm' },
        });
        expect(await search.search('query')).toEqual([]);
      }));
    it(
      'builds in batches, skips unchanged rows with zero API calls and preserves embeddings through metadata rebuild',
      () =>
        isolated(async (tx, client) => {
          const provider = new FakeProvider();
          const service = new EmbeddingsService(client, provider, cfg);
          const first = await service.build();
          expect(first.embedded).toBeGreaterThan(0);
          expect(first.apiCalls).toBe(
            Math.ceil(first.embedded / cfg.batchSize),
          );
          const before = await tx.knowledgeChunkEmbedding.findMany({
            where: { embeddingProvider: cfg.provider },
          });
          const second = await service.build();
          expect(second).toMatchObject({
            embedded: 0,
            apiCalls: 0,
            skipped: first.embedded,
          });
          expect(
            await tx.knowledgeChunkEmbedding.findMany({
              where: { embeddingProvider: cfg.provider },
            }),
          ).toEqual(before);
          const chunk = await tx.knowledgeChunk.findFirstOrThrow();
          await tx.knowledgeChunk.update({
            where: { id: chunk.id },
            data: { metadata: { test: 'metadata-only' } },
          });
          await buildKnowledge(client, config({}));
          expect(
            await tx.knowledgeChunkEmbedding.findMany({
              where: { embeddingProvider: cfg.provider },
            }),
          ).toEqual(before);
          expect(await validateEmbeddings(tx, cfg, true)).toMatchObject({
            validation: 'PASS',
            missing: 0,
          });
        }),
      120000,
    );
    it('database rejects wrong vector dimensions and dangling chunks', () =>
      isolated(async (tx) => {
        const [chunk] = await candidates(tx, cfg);
        await expect(
          tx.$executeRaw`INSERT INTO knowledge_chunk_embeddings (chunk_id,embedding_provider,embedding_model,embedding_version,embedding_dimensions,embedding,content_hash_at_embedding,chunking_version_at_embedding) VALUES (${chunk.id},'test-only','test','v',1536,'[1,2]'::vector,${chunk.contentHash},${chunk.chunkingVersion})`,
        ).rejects.toThrow();
      }));
    it('database rejects a nonexistent chunk FK', () =>
      isolated(async (tx) => {
        await expect(
          tx.$executeRaw`INSERT INTO knowledge_chunk_embeddings (chunk_id,embedding_provider,embedding_model,embedding_version,embedding_dimensions,embedding,content_hash_at_embedding,chunking_version_at_embedding) VALUES ('does-not-exist','test-only','test','v',1536,${JSON.stringify(vector(1))}::vector,${'a'.repeat(64)},'v')`,
        ).rejects.toThrow();
      }));
  },
);
