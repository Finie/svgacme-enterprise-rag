import { Prisma } from '../generated/prisma/client.js';
import type { EmbeddingProvider } from '../embeddings/embedding-provider.js';
import { validateVector } from '../embeddings/embedding-provider.js';
import {
  eligibleSql,
  spaceSql,
  freshSql,
  type Database,
} from '../embeddings/embedding-store.js';
export interface SearchOptions {
  topK?: number;
  documentType?: 'POLICY' | 'SCENARIO';
  policyId?: string;
  policySectionId?: string;
  category?: string;
}
export interface SearchResult {
  chunkId: string;
  content: string;
  distance: number;
  score: number;
  documentType: string;
  sourceId: string;
  policyId: string | null;
  policySectionId: string | null;
  policySectionOrdinal: number | null;
  scenarioId: string | null;
  sectionHeading: string | null;
  category: string | null;
  chunkIndex: number;
}
export function filterSql(options: SearchOptions) {
  const clauses: Prisma.Sql[] = [];
  if (options.documentType !== undefined) {
    if (!['POLICY', 'SCENARIO'].includes(options.documentType))
      throw new Error('Invalid documentType');
    clauses.push(Prisma.sql`c.document_type = ${options.documentType}`);
  }
  if (options.policyId !== undefined)
    clauses.push(Prisma.sql`c.policy_id = ${options.policyId}`);
  if (options.policySectionId !== undefined) {
    const match = /^([^:]+):(\d+)$/.exec(options.policySectionId);
    if (
      !match ||
      !Number.isSafeInteger(Number(match[2])) ||
      Number(match[2]) > 2147483647
    )
      throw new Error('policySectionId must be <policy_id>:<section_ordinal>');
    clauses.push(
      Prisma.sql`c.policy_id = ${match[1]} AND c.policy_section_ordinal = ${Number(match[2])}`,
    );
  }
  if (options.category !== undefined)
    clauses.push(Prisma.sql`c.metadata->>'category' = ${options.category}`);
  return clauses.length
    ? Prisma.sql`AND ${Prisma.join(clauses, ' AND ')}`
    : Prisma.empty;
}
export function mapResult(
  row: Omit<SearchResult, 'score' | 'policySectionId'>,
): SearchResult {
  return {
    ...row,
    score: 1 - row.distance,
    policySectionId:
      row.policyId === null || row.policySectionOrdinal === null
        ? null
        : `${row.policyId}:${row.policySectionOrdinal}`,
  };
}
export class SemanticSearchService {
  constructor(
    private readonly db: Database,
    readonly provider: EmbeddingProvider,
  ) {}
  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    if (!query.trim()) throw new Error('Search query must be nonempty');
    this.validateOptions(options);
    const vector = await this.provider.embed(query.trim());
    return this.searchVector(vector, options);
  }
  private validateOptions(options: SearchOptions) {
    const k = options.topK ?? 5;
    if (!Number.isSafeInteger(k) || k < 1 || k > 100)
      throw new Error('topK must be an integer from 1 to 100');
    return { k, filters: filterSql(options) };
  }
  async searchVector(
    vector: number[],
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    validateVector(vector, this.provider.space.dimensions);
    const { k, filters } = this.validateOptions(options);
    const rows = await this.db.$queryRaw<
      Omit<SearchResult, 'score' | 'policySectionId'>[]
    >(Prisma.sql`
      SELECT c.id AS "chunkId", c.content, (e.embedding <=> ${JSON.stringify(vector)}::vector) AS distance,
        c.document_type AS "documentType", c.source_id AS "sourceId", c.policy_id AS "policyId",
        c.policy_section_ordinal AS "policySectionOrdinal", c.scenario_id AS "scenarioId", c.chunk_index AS "chunkIndex",
        c.metadata->>'section_heading' AS "sectionHeading", c.metadata->>'category' AS category
      FROM knowledge_chunk_embeddings e JOIN knowledge_chunks c ON c.id = e.chunk_id
      WHERE ${eligibleSql} AND ${spaceSql(this.provider.space)} AND ${freshSql()} ${filters}
      ORDER BY e.embedding <=> ${JSON.stringify(vector)}::vector ASC, c.id ASC LIMIT ${k}`);
    return rows.map(mapResult);
  }
}
