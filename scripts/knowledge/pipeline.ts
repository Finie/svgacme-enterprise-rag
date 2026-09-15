import type {
  Prisma,
  PrismaClient,
} from '../../apps/src/generated/prisma/client.js';
import { type ChunkConfig, normalize } from './chunking.js';
import {
  documentChunks,
  policyDocument,
  scenarioDocument,
  type Chunk,
  type KnowledgeDocument,
} from './documents.js';

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
type StoredChunk = Omit<Chunk, 'metadata'> & { metadata: unknown };

export function comparable(c: StoredChunk): string {
  const { createdAt: _created, updatedAt: _updated, ...rest } = c;
  return canonical(rest);
}
export async function loadDocuments(
  tx: Prisma.TransactionClient,
  cfg: ChunkConfig,
): Promise<KnowledgeDocument[]> {
  const policies = await tx.policy.findMany({
    include: { sections: { orderBy: { sectionOrdinal: 'asc' } } },
    orderBy: { policyId: 'asc' },
  });
  // Positive field selection: answer keys, reasoning and evaluation relations are never loaded.
  const scenarios = await tx.scenario.findMany({
    where: { scenarioId: { in: cfg.scenarioIds } },
    orderBy: { scenarioId: 'asc' },
    select: {
      scenarioId: true,
      title: true,
      category: true,
      difficulty: true,
      businessContext: true,
      description: true,
      relevantFacts: true,
      events: {
        select: { sequence: true, event: true },
        orderBy: { sequence: 'asc' },
      },
    },
  });
  if (scenarios.length !== cfg.scenarioIds.length)
    throw new Error('Scenario allowlist contains unknown IDs');
  return [...policies.map(policyDocument), ...scenarios.map(scenarioDocument)];
}
export function reconcile(existing: StoredChunk[], desired: Chunk[]) {
  const old = new Map(existing.map((c) => [c.id, c]));
  const next = new Map(desired.map((c) => [c.id, c]));
  const changed = desired.filter(
    (c) => !old.has(c.id) || comparable(old.get(c.id)!) !== comparable(c),
  );
  const removed = existing.filter(
    (c) => !next.has(c.id) || changed.some((n) => n.id === c.id),
  );
  return { changed, removed, unchanged: desired.length - changed.length };
}
export function stats(docs: KnowledgeDocument[], chunks: StoredChunk[]) {
  return {
    policyDocuments: docs.filter((d) => d.documentType === 'POLICY').length,
    policySections: docs
      .filter((d) => d.documentType === 'POLICY')
      .reduce((n, d) => n + d.sections.length, 0),
    scenarioDocuments: docs.filter((d) => d.documentType === 'SCENARIO').length,
    policyChunks: chunks.filter((c) => c.documentType === 'POLICY').length,
    scenarioChunks: chunks.filter((c) => c.documentType === 'SCENARIO').length,
    totalChunks: chunks.length,
  };
}
export async function buildKnowledge(prisma: PrismaClient, cfg: ChunkConfig) {
  return prisma.$transaction(
    async (tx) => {
      // Serialize builders; lock source tables against concurrent imports for a coherent projection.
      await tx.$executeRawUnsafe(
        'LOCK TABLE policies, policy_sections, scenarios, scenario_events IN SHARE MODE',
      );
      await tx.$executeRawUnsafe(
        'LOCK TABLE knowledge_chunks IN EXCLUSIVE MODE',
      );
      const docs = await loadDocuments(tx, cfg);
      const desired = docs.flatMap((d) => documentChunks(d, cfg));
      const existing = await tx.knowledgeChunk.findMany();
      const plan = reconcile(existing, desired);
      // Preserve child embeddings on updates, including metadata-only changes.
      await tx.$executeRawUnsafe(
        'SET CONSTRAINTS knowledge_chunks_document_type_source_id_chunk_index_key DEFERRED',
      );
      const desiredIds = new Set(desired.map((c) => c.id));
      const stale = plan.removed.filter((c) => !desiredIds.has(c.id));
      if (stale.length)
        await tx.knowledgeChunk.deleteMany({
          where: { id: { in: stale.map((c) => c.id) } },
        });
      const existingIds = new Set(existing.map((c) => c.id));
      for (const chunk of plan.changed) {
        if (existingIds.has(chunk.id)) {
          await tx.knowledgeChunk.update({
            where: { id: chunk.id },
            data: chunk,
          });
        } else {
          await tx.knowledgeChunk.create({ data: chunk });
        }
      }
      return {
        ...stats(docs, desired),
        written: plan.changed.length,
        removed: plan.removed.filter((c) => !desired.some((n) => n.id === c.id))
          .length,
        unchanged: plan.unchanged,
      };
    },
    { timeout: 120000 },
  );
}
export async function validateKnowledge(
  prisma: PrismaClient,
  cfg: ChunkConfig,
) {
  return prisma.$transaction(
    async (tx) => {
      const docs = await loadDocuments(tx, cfg);
      const expected = docs.flatMap((d) => documentChunks(d, cfg));
      const actual = await tx.knowledgeChunk.findMany();
      const plan = reconcile(actual, expected);
      if (plan.changed.length || plan.removed.length)
        throw new Error(
          `Knowledge differs from sources/config: ${plan.changed.length} missing or changed, ${plan.removed.length} stale or changed`,
        );
      if (
        new Set(expected.map((c) => c.id)).size !== expected.length ||
        new Set(
          expected.map(
            (c) => `${c.documentType}:${c.sourceId}:${c.chunkIndex}`,
          ),
        ).size !== expected.length
      )
        throw new Error('Duplicate logical chunks');
      if (
        canonical(expected) !==
        canonical(docs.flatMap((d) => documentChunks(d, cfg)))
      )
        throw new Error('Nondeterministic generation');
      for (const doc of docs)
        for (const section of doc.sections) {
          const chunks = expected.filter(
            (c) =>
              c.sourceId === doc.sourceEntityId &&
              c.documentType === doc.documentType &&
              (c.metadata as Prisma.JsonObject).section_key === section.key,
          );
          const source = normalize(section.content);
          let end = 0;
          for (const c of chunks) {
            const m = c.metadata as Prisma.JsonObject;
            const start = Number(m.start_offset),
              stop = Number(m.end_offset);
            if (
              source.slice(start, stop) !== c.content ||
              source.slice(end, start).trim()
            )
              throw new Error(
                `Reconstruction gap: ${doc.documentId}/${section.key}`,
              );
            end = stop;
          }
          if (source.slice(end).trim())
            throw new Error(
              `Missing section: ${doc.documentId}/${section.key}`,
            );
        }
      return { ...stats(docs, actual), validation: 'PASS' };
    },
    { isolationLevel: 'RepeatableRead', timeout: 120000 },
  );
}
