import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  SemanticSearchService,
  type SearchOptions,
} from './semantic-search.service.js';
import { validateEmbeddings } from '../embeddings/embedding-store.js';
@Injectable()
export class SearchService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(SemanticSearchService)
    private readonly search: SemanticSearchService,
  ) {}
  async find(query: string, topK: number, options: SearchOptions = {}) {
    try {
      await validateEmbeddings(this.db, this.search.provider.space, true);
      return await this.search.search(query, { ...options, topK });
    } catch {
      throw new ServiceUnavailableException(
        'Search unavailable. Check database, embedding completeness, and provider configuration.',
      );
    }
  }
}
