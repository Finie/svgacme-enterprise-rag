import { Inject, Injectable } from '@nestjs/common';
import { SearchService } from '../search/search.service.js';
import { AnswerService } from './answer.service.js';
@Injectable()
export class QuestionsService {
  constructor(
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(AnswerService) private readonly answers: AnswerService,
  ) {}
  async ask(question: string, topK: number) {
    this.answers.assertConfigured();
    const results = await this.search.find(question, topK);
    const sources = results.map((result, index) => ({
      reference: index + 1,
      ...result,
    }));
    if (!sources.length)
      return {
        question,
        answer: 'No matching policy evidence was found.',
        sources,
      };
    return {
      question,
      answer: await this.answers.generate(question, sources),
      sources,
    };
  }
}
