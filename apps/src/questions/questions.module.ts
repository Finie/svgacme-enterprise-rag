import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { InputGuardrailService } from './guardrails/input.service.js';
import { RetrievalRouterService } from './guardrails/retrieval.service.js';
import { EvidenceGateService } from './guardrails/evidence.service.js';
import { ContextBuilderService } from './guardrails/context.service.js';
import { OutputGuardrailService } from './guardrails/output.service.js';
import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module.js';
import { QuestionsController } from './questions.controller.js';
import { QuestionsService } from './questions.service.js';
import { AnswerService } from './answer.service.js';
@Module({
  imports: [SearchModule, EmbeddingsModule],
  controllers: [QuestionsController],
  providers: [
    QuestionsService,
    AnswerService,
    InputGuardrailService,
    RetrievalRouterService,
    EvidenceGateService,
    ContextBuilderService,
    OutputGuardrailService,
  ],
})
export class QuestionsModule {}
