import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AnswerService } from './answer.service.js';
import { InputGuardrailService } from './guardrails/input.service.js';
import { RetrievalRouterService } from './guardrails/retrieval.service.js';
import { EvidenceGateService } from './guardrails/evidence.service.js';
import { ContextBuilderService } from './guardrails/context.service.js';
import { OutputGuardrailService } from './guardrails/output.service.js';
@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);
  constructor(
    @Inject(InputGuardrailService)
    private readonly input: InputGuardrailService,
    @Inject(RetrievalRouterService)
    private readonly router: RetrievalRouterService,
    @Inject(EvidenceGateService) private readonly evidence: EvidenceGateService,
    @Inject(ContextBuilderService)
    private readonly context: ContextBuilderService,
    @Inject(AnswerService) private readonly answers: AnswerService,
    @Inject(OutputGuardrailService)
    private readonly output: OutputGuardrailService,
  ) {}
  async ask(question: unknown, topK = 5) {
    const start = Date.now();
    const metadata = {
      requestId: randomUUID(),
      inputDecision: 'INVALID',
      route: null as string | null,
      retrievalStrategy: null as string | null,
      semanticResultCount: 0,
      structuredResultCount: 0,
      bestRetrievalScore: null as number | null,
      evidenceDecision: 'NOT_RUN',
      rerankingApplied: false,
      generationCalled: false,
      generationAttempts: 0,
      generationModel: null as string | null,
      citationCount: 0,
      groundingStatus: 'INSUFFICIENT_EVIDENCE',
      abstained: true,
      totalLatency: 0,
    };
    const finish = (
      status: string,
      answer: string,
      extra: Record<string, unknown> = {},
    ) => ({
      status,
      answer,
      citations: [],
      sources: [],
      grounding: { status: metadata.groundingStatus },
      ...extra,
      requestId: metadata.requestId,
      metadata,
    });
    const abstention =
      "I couldn't find sufficient information in the SVGA Enterprise knowledge base to answer that question.";
    try {
      if (!Number.isSafeInteger(topK) || topK < 1 || topK > 20)
        return finish('rejected', 'Invalid topK.', { reason: 'invalid_top_k' });
      const input = await this.input.check(question);
      metadata.inputDecision = input.decision;
      metadata.route = input.route ?? null;
      if (input.decision !== 'ALLOW')
        return finish(
          input.decision === 'OUT_OF_SCOPE' ? 'out_of_scope' : 'rejected',
          input.decision === 'OUT_OF_SCOPE'
            ? 'That request is outside the scope of the SVGA Enterprise knowledge system.'
            : 'This request cannot be processed.',
          { reason: input.reason, input },
        );
      const retrieval = await this.router.retrieve(
        (question as string).trim(),
        input.route!,
        topK,
      );
      metadata.retrievalStrategy = retrieval.strategy;
      metadata.semanticResultCount = retrieval.evidence.filter(
        (e) => e.sourceType === 'policy',
      ).length;
      metadata.structuredResultCount = retrieval.evidence.filter(
        (e) => e.sourceType === 'structured',
      ).length;
      const gate = this.evidence.evaluate(question as string, retrieval);
      metadata.evidenceDecision = gate.decision;
      metadata.bestRetrievalScore = gate.bestScore ?? null;
      if (gate.decision !== 'SUFFICIENT')
        return finish(
          'insufficient_evidence',
          gate.decision === 'CONFLICTING'
            ? 'The available authoritative sources conflict; I cannot give a reliable answer.'
            : abstention,
          { evidence: gate },
        );
      const sources = this.context.build(
        question as string,
        this.evidence.useful(question as string, retrieval.evidence),
      );
      metadata.rerankingApplied = true;
      let retryReason: string | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        this.answers.assertConfigured();
        metadata.generationCalled = true;
        metadata.generationAttempts++;
        metadata.generationModel = process.env.GEMINI_GENERATION_MODEL ?? null;
        const answer = await this.answers.generate(
          question as string,
          sources,
          retryReason,
        );
        const output = this.output.validate(answer, sources);
        metadata.groundingStatus = output.status;
        if (output.accepted) {
          metadata.abstained = false;
          metadata.citationCount = output.citations.length;
          // Return only server-validated citation metadata, never raw evidence or rejected output.
          return finish('answered', answer, {
            citations: output.citations,
            sources: output.citations,
          });
        }
        if (output.status !== 'INVALID_CITATION') break;
        retryReason =
          'Previous output had invalid citations. Cite only supplied E identifiers on every factual sentence.';
      }
      return finish('insufficient_evidence', abstention);
    } catch {
      return finish(
        'unavailable',
        'The knowledge service is temporarily unavailable.',
      );
    } finally {
      metadata.totalLatency = Date.now() - start;
      this.logger.log(metadata);
    }
  }
}
