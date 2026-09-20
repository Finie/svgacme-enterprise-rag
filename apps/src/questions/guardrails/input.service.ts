import { Inject, Injectable } from '@nestjs/common';
import { EMBEDDING_PROVIDER } from '../../embeddings/embeddings.module.js';
import type { EmbeddingProvider } from '../../embeddings/embedding-provider.js';
import { policyNeeds } from './domains.js';
import type { InputResult, Route } from './types.js';

export const domains = [
  'SVGA employee human resources recruitment onboarding leave entitlement benefits compensation stock options workplace conduct',
  'SVGA finance expenses reimbursement financial approval authority maximum amount a department head can approve procurement purchase orders suppliers business travel',
  'SVGA sales customers credit inventory products stock availability warehouses operations',
  'SVGA IT systems access permissions incidents security data protection compliance anti bribery conflicts of interest records retention',
];
const outside = [
  'Weather forecasts sports entertainment recipes general trivia politics unrelated programming assistance',
];
export function securityDecision(text: string): InputResult | undefined {
  const q = text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (
    /\b(ignore|disregard|override|forget)\b.{0,60}\b(instructions?|documents?|rules|prompts?)\b|\b(reveal|print|show|repeat)\b.{0,40}\b(system|developer)\s*(prompt|instructions?)|\bunrestricted\s+assistant\b/i.test(
      q,
    )
  )
    return { decision: 'PROMPT_INJECTION', reason: 'instruction_override' };
  if (
    /\b(?:what|which|show|give|reveal|return|tell|print|list|expose)\b.{0,80}\bpassword\b|\b(api[ _-]?keys?|database\s+(password|url)|environment\s+variables?|system\s+credentials?|secrets?|private\s+keys?)\b|\b(personal mobile|home address|bank account number)\b/i.test(
      q,
    )
  )
    return { decision: 'UNSAFE', reason: 'sensitive_information' };
}
export function routeQuestion(q: string): Route {
  if (
    /SCN-XD-\d+/i.test(q) ||
    (/incident/i.test(q) && /(?:customer|personal) data/i.test(q))
  )
    return 'CROSS_DOMAIN';
  const entities = new Set(
    q
      .toUpperCase()
      .match(/\b(?:EMP|PROD|PRD|SUP|CUST|CUS|WH|ROLE)-[A-Z0-9-]+\b/g) ?? [],
  );
  if (
    /\b(legal name|company profile|cost cent(?:er|re)|which city|status of|account manager|which supplier provides)\b/i.test(
      q,
    ) ||
    (/\bEMP-\d+/i.test(q) && /\b(department|role)\b/i.test(q))
  )
    return 'STRUCTURED';
  if (entities.size > 1 || /\bemployee\b.*\b(product|supplier)\b/i.test(q))
    return 'CROSS_DOMAIN';
  if (
    /\b(approve|approval|authori[sz]e)\b/i.test(q) &&
    /\b(manager|head|employee|kes|purchase)\b/i.test(q)
  )
    return 'HYBRID';
  if (
    /\b(head of|who is|who heads)\b|\b(how many|how much|available|on hand)\b.*\b(units|stock|PROD-|PRD-)/i.test(
      q,
    )
  )
    return 'STRUCTURED';
  if (policyNeeds(q).length > 1 && !/\b(approve|approval)\b/i.test(q))
    return 'CROSS_DOMAIN';
  if (
    /\b(policy|rules?|leave|entitlement|must|should|allowed|procedure)\b/i.test(
      q,
    )
  )
    return 'POLICY';
  return 'SEMANTIC';
}
function cosine(a: number[], b: number[]) {
  return (
    a.reduce((sum, v, i) => sum + v * b[i], 0) /
    Math.sqrt(
      a.reduce((s, v) => s + v * v, 0) * b.reduce((s, v) => s + v * v, 0),
    )
  );
}
@Injectable()
export class InputGuardrailService {
  private prototypes?: Promise<number[][]>;
  constructor(
    @Inject(EMBEDDING_PROVIDER) private readonly provider: EmbeddingProvider,
  ) {}
  async check(question: unknown): Promise<InputResult> {
    if (
      typeof question !== 'string' ||
      !question.trim() ||
      question.length > 4000
    )
      return { decision: 'INVALID', reason: 'invalid_question' };
    const security = securityDecision(question);
    if (security) return security;
    // Explicit enterprise context is in scope even when the requested policy is absent.
    const enterprise =
      /\b(svga|company|employee|policy|leave|finance|procurement|supplier|warehouse|inventory|department|recruitment|onboarding|bribery|retention|expense|customer|approval)\b|\b(?:PROD|EMP|SUP|CUST)-\d+/i.test(
        question,
      );
    if (!enterprise && process.env.GUARDRAIL_SEMANTIC_SCOPE !== 'false') {
      this.prototypes ??= this.provider
        .embedBatch([...domains, ...outside])
        .catch((error) => {
          this.prototypes = undefined;
          throw error;
        });
      const [vectors, query] = await Promise.all([
        this.prototypes,
        this.provider.embed(question),
      ]);
      const scores = vectors.map((v) => cosine(query, v));
      const margin = Number(process.env.GUARDRAIL_SCOPE_MARGIN ?? 0);
      if (!Number.isFinite(margin) || margin < 0 || margin > 1)
        throw new Error('Invalid GUARDRAIL_SCOPE_MARGIN');
      if (
        Math.max(...scores.slice(0, domains.length)) <=
        Math.max(...scores.slice(domains.length)) + margin
      )
        return {
          decision: 'OUT_OF_SCOPE',
          reason: 'outside_domain_prototypes',
        };
    } else if (!enterprise)
      return { decision: 'OUT_OF_SCOPE', reason: 'no_enterprise_context' };
    return {
      decision: 'ALLOW',
      route: routeQuestion(question),
      reason: 'enterprise_scope',
    };
  }
}
