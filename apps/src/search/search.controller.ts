import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { SearchService } from './search.service.js';
import { textBody } from '../http/request.js';
@Controller('search')
export class SearchController {
  constructor(@Inject(SearchService) private readonly search: SearchService) {}
  @Post()
  @HttpCode(200)
  async find(@Body() body: unknown) {
    const { text: query, topK } = textBody(body, 'query');
    return { query, results: await this.search.find(query, topK) };
  }
}
