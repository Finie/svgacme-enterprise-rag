import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { QuestionsService } from './questions.service.js';
import { textBody } from '../http/request.js';
@Controller('questions')
export class QuestionsController {
  constructor(
    @Inject(QuestionsService) private readonly questions: QuestionsService,
  ) {}
  @Post()
  @HttpCode(200)
  ask(@Body() body: unknown) {
    const { text, topK } = textBody(body, 'question');
    return this.questions.ask(text, topK);
  }
}
