import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module.js';
import { QuestionsController } from './questions.controller.js';
import { QuestionsService } from './questions.service.js';
import { AnswerService } from './answer.service.js';
@Module({
  imports: [SearchModule],
  controllers: [QuestionsController],
  providers: [QuestionsService, AnswerService],
})
export class QuestionsModule {}
