import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { QuestionsService } from './questions.service.js';
@Controller('questions')
export class QuestionsController {
  constructor(
    @Inject(QuestionsService) private readonly questions: QuestionsService,
  ) {}
  @Post()
  @HttpCode(200)
  ask(@Body() body: unknown) {
    const data =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    return this.questions.ask(
      data.question,
      data.topK === undefined ? 5 : (data.topK as number),
    );
  }
}
