import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import type { EmbeddingSpace } from './config.js';
import { validateVector } from './embedding-provider.js';
export type Database = Prisma.TransactionClient | PrismaClient;
export interface Candidate {
  id: string;
  content: string;
  contentHash: string;
  chunkingVersion: string;
}
export const eligibleSql = Prisma.sql`c.document_type = 'POLICY' AND c.policy_id IS NOT NULL AND c.policy_section_ordinal IS NOT NULL AND c.scenario_id IS NULL`;
export function spaceSql(s: EmbeddingSpace) {
  return Prisma.sql`e.embedding_provider = ${s.provider} AND e.embedding_model = ${s.model} AND e.embedding_version = ${s.version} AND e.embedding_dimensions = ${s.dimensions}`;
}
export function freshSql() {
  return Prisma.sql`e.content_hash_at_embedding = c.content_hash AND e.chunking_version_at_embedding = c.chunking_version`;
}
export async function candidates(
  db: Database,
  space: EmbeddingSpace,
  ids?: string[],
  lock = false,
): Promise<Candidate[]> {
  if (ids && !ids.length) return [];
  return db.$queryRaw<Candidate[]>(Prisma.sql`
    SELECT c.id, c.content, c.content_hash AS "contentHash", c.chunking_version AS "chunkingVersion"
    FROM knowledge_chunks c WHERE ${eligibleSql}
    ${ids ? Prisma.sql`AND c.id IN (${Prisma.join(ids)})` : Prisma.empty}
    AND NOT EXISTS (SELECT 1 FROM knowledge_chunk_embeddings e WHERE e.chunk_id = c.id AND ${spaceSql(space)} AND ${freshSql()})
    ORDER BY c.id ${lock ? Prisma.sql`FOR SHARE OF c` : Prisma.empty}`);
}
export async function persistEmbedding(
  db: Database,
  chunk: Candidate,
  space: EmbeddingSpace,
  vector: number[],
): Promise<number> {
  validateVector(vector, space.dimensions);
  // The conditional INSERT is a second guard against persisting a stale response.
  return db.$executeRaw(Prisma.sql`
    INSERT INTO knowledge_chunk_embeddings (chunk_id, embedding_provider, embedding_model, embedding_version, embedding_dimensions, embedding, content_hash_at_embedding, chunking_version_at_embedding)
    SELECT c.id, ${space.provider}, ${space.model}, ${space.version}, ${space.dimensions}, ${JSON.stringify(vector)}::vector, ${chunk.contentHash}, ${chunk.chunkingVersion}
    FROM knowledge_chunks c WHERE c.id = ${chunk.id} AND c.content_hash = ${chunk.contentHash} AND c.chunking_version = ${chunk.chunkingVersion} AND ${eligibleSql}
    ON CONFLICT (chunk_id, embedding_provider, embedding_model, embedding_version) DO UPDATE SET
      embedding = EXCLUDED.embedding, embedding_dimensions = EXCLUDED.embedding_dimensions,
      content_hash_at_embedding = EXCLUDED.content_hash_at_embedding, chunking_version_at_embedding = EXCLUDED.chunking_version_at_embedding, embedded_at = clock_timestamp()`);
}
export async function validateEmbeddings(
  db: Database,
  space: EmbeddingSpace,
  requireComplete = false,
) {
  const [counts] = await db.$queryRaw<
    { total: number; invalid: number; stale: number }[]
  >(Prisma.sql`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE c.id IS NULL OR e.embedding_dimensions <> vector_dims(e.embedding) OR e.embedding_dimensions <> 1536 OR vector_norm(e.embedding) <= 0
        OR e.content_hash_at_embedding !~ '^[0-9a-f]{64}$' OR btrim(e.embedding_provider) = '' OR btrim(e.embedding_model) = '' OR btrim(e.embedding_version) = '' OR NOT (${eligibleSql}))::int AS invalid,
      count(*) FILTER (WHERE e.content_hash_at_embedding <> c.content_hash OR e.chunking_version_at_embedding <> c.chunking_version)::int AS stale
    FROM knowledge_chunk_embeddings e LEFT JOIN knowledge_chunks c ON c.id = e.chunk_id`);
  const missing = (await candidates(db, space)).length;
  const eligible = await db.knowledgeChunk.count({
    where: {
      documentType: 'POLICY',
      policyId: { not: null },
      policySectionOrdinal: { not: null },
      scenarioId: null,
    },
  });
  const result = {
    ...counts,
    eligible,
    current: eligible - missing,
    missing,
    space: {
      provider: space.provider,
      model: space.model,
      dimensions: space.dimensions,
      version: space.version,
    },
  };
  if (counts.invalid || (requireComplete && (missing || !eligible)))
    throw new Error(`Embedding validation failed: ${JSON.stringify(result)}`);
  return { ...result, validation: 'PASS' };
}
