import { Injectable } from '@nestjs/common';
import type { Evidence } from './types.js';
import { relevance } from './retrieval.service.js';
@Injectable()
export class ContextBuilderService {
  build(question: string, evidence: Evidence[]) {
    // Retain every sufficient evidence item: truncating after Gate 2 can remove a required hop.
    return [...evidence]
      .sort(
        (a, b) =>
          relevance(question, b) - relevance(question, a) ||
          b.score - a.score ||
          a.sourceId.localeCompare(b.sourceId),
      )
      .map((e, i) => ({ ...e, id: `E${i + 1}` }));
  }
}
