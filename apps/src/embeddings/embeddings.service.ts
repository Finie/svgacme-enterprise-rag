import type { PrismaClient } from '../generated/prisma/client.js';
import type { EmbeddingConfig } from './config.js';
import {
  batches,
  validateVector,
  type EmbeddingProvider,
} from './embedding-provider.js';
import { candidates, persistEmbedding } from './embedding-store.js';
export class EmbeddingsService {
  constructor(
    private readonly db: PrismaClient,
    readonly provider: EmbeddingProvider,
    private readonly cfg: EmbeddingConfig,
  ) {
    if (
      ['provider', 'model', 'dimensions', 'version'].some(
        (k) =>
          provider.space[k as keyof typeof provider.space] !==
          cfg[k as keyof EmbeddingConfig],
      )
    )
      throw new Error('Provider/config embedding space mismatch');
  }
  async build(dryRun = false) {
    const pending = await candidates(this.db, this.provider.space);
    const eligible = await this.db.knowledgeChunk.count({
      where: {
        documentType: 'POLICY',
        policyId: { not: null },
        policySectionOrdinal: { not: null },
        scenarioId: null,
      },
    });
    const result = {
      space: this.provider.space,
      eligible,
      alreadyEmbedded: eligible - pending.length,
      toEmbed: pending.length,
      batchSize: this.cfg.batchSize,
      embedded: 0,
      skipped: eligible - pending.length,
      failed: 0,
      apiCalls: 0,
      dryRun,
    };
    if (dryRun) return result;
    const callsBefore = this.provider.apiCalls;
    for (const batch of batches(pending, this.cfg.batchSize)) {
      try {
        const written = await this.db.$transaction(
          async (tx) => {
            // Per-space transaction lock avoids duplicate paid requests from concurrent builders.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(this.provider.space)}, 0))`;
            const current = await candidates(
              tx,
              this.provider.space,
              batch.map((c) => c.id),
              true,
            );
            if (!current.length) return 0;
            const vectors = await this.provider.embedBatch(
              current.map((c) => c.content),
            );
            if (vectors.length !== current.length)
              throw new Error('Embedding batch response length mismatch');
            vectors.forEach((v) => validateVector(v, this.cfg.dimensions));
            let count = 0;
            for (let i = 0; i < current.length; i++)
              count += await persistEmbedding(
                tx,
                current[i],
                this.provider.space,
                vectors[i],
              );
            return count;
          },
          {
            maxWait: 10000,
            timeout:
              (this.cfg.maxRetries + 1) * (this.cfg.timeoutMs + 30000) + 30000,
          },
        );
        result.embedded += written;
        result.skipped += batch.length - written;
      } catch (error) {
        result.failed = batch.length;
        result.apiCalls = this.provider.apiCalls - callsBefore;
        throw new Error(
          `Embedding build stopped: ${JSON.stringify({ ...result, unprocessed: result.toEmbed - result.embedded - result.failed - (result.skipped - result.alreadyEmbedded) })}; ${error instanceof Error ? error.message : 'unknown failure'}`,
        );
      }
    }
    result.apiCalls = this.provider.apiCalls - callsBefore;
    return result;
  }
}
