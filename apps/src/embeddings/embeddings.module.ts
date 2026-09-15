import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { embeddingConfig } from './config.js';
import { createEmbeddingProvider } from './providers/index.js';
import type { EmbeddingProvider } from './embedding-provider.js';
import { EmbeddingsService } from './embeddings.service.js';
import { SemanticSearchService } from '../search/semantic-search.service.js';
export const EMBEDDING_PROVIDER = Symbol('EmbeddingProvider');
@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: () => createEmbeddingProvider(embeddingConfig()),
    },
    {
      provide: EmbeddingsService,
      inject: [PrismaService, EMBEDDING_PROVIDER],
      useFactory: (db: PrismaService, provider: EmbeddingProvider) =>
        new EmbeddingsService(db, provider, embeddingConfig()),
    },
    {
      provide: SemanticSearchService,
      inject: [PrismaService, EMBEDDING_PROVIDER],
      useFactory: (db: PrismaService, provider: EmbeddingProvider) =>
        new SemanticSearchService(db, provider),
    },
  ],
  exports: [EMBEDDING_PROVIDER, EmbeddingsService, SemanticSearchService],
})
export class EmbeddingsModule {}
