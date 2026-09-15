import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';
@Module({
  imports: [EmbeddingsModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
