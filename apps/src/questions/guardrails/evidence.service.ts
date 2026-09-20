import { calibration } from './calibration.js';
import { embeddingConfig } from '../../embeddings/config.js';
import { Injectable } from '@nestjs/common';
import type { Evidence, EvidenceResult, Retrieval } from './types.js';
import { relevance, terms } from './retrieval.service.js';
import { securityDecision } from './input.service.js';

export function evidenceThreshold(): number | undefined {
  const raw = process.env.GUARDRAIL_EVIDENCE_THRESHOLD;
  if (raw === undefined) {
    const space = embeddingConfig();
    return (['provider', 'model', 'dimensions', 'version'] as const).every(
      (key) => space[key] === calibration[key],
    )
      ? calibration.threshold
      : undefined;
  }
  if (!raw.trim()) return undefined; // Explicit blank disables semantic generation.
  const value = Number(raw);
  if (!Number.isFinite(value) || value < -1 || value > 1)
    throw new Error('Invalid GUARDRAIL_EVIDENCE_THRESHOLD');
  return value;
}
export function facts(e: Evidence): { key: string; value: string }[] {
  // Deliberately narrow extraction: same named numeric attribute with different values.
  const extracted = [
    ...e.content.matchAll(
      /\b(annual leave|approval limit)\s*(?:entitlement\s*)?(?:=|:|is|of)\s*(?:KES\s*)?([\d,]+(?:\.\d+)?)\s*(days)?/gi,
    ),
  ].map((m) => ({
    key: `${e.section ?? ''}:${m[1].toLowerCase()}`,
    value: m[2].replaceAll(',', ''),
  }));
  return [...(e.facts ?? []), ...extracted];
}
@Injectable()
export class EvidenceGateService {
  useful(question: string, evidence: Evidence[]): Evidence[] {
    const threshold = evidenceThreshold();
    return evidence.filter(
      (e) =>
        e.authoritative &&
        e.sourceId &&
        e.content.trim() &&
        !securityDecision(e.content) &&
        (e.sourceType === 'structured' ||
          (threshold !== undefined &&
            Number.isFinite(e.score) &&
            e.score >= threshold &&
            relevance(question, e) > 0)),
    );
  }
  evaluate(question: string, retrieval: Retrieval): EvidenceResult {
    const useful = this.useful(question, retrieval.evidence);
    const scores = retrieval.evidence
      .filter((e) => e.sourceType === 'policy')
      .map((e) => e.score)
      .filter(Number.isFinite);
    const base = {
      evidenceCount: useful.length,
      bestScore: scores.length ? Math.max(...scores) : undefined,
    };
    if (!retrieval.evidence.length)
      return { ...base, decision: 'NO_EVIDENCE', reason: 'no_results' };
    const values = new Map<string, string>();
    for (const e of useful)
      for (const fact of facts(e)) {
        if (values.has(fact.key) && values.get(fact.key) !== fact.value)
          return {
            ...base,
            decision: 'CONFLICTING',
            reason: 'conflicting_authoritative_values',
          };
        values.set(fact.key, fact.value);
      }
    const covered = new Set(useful.flatMap((e) => e.covers));
    if (!useful.length || retrieval.required.some((key) => !covered.has(key)))
      return {
        ...base,
        decision: 'INSUFFICIENT',
        reason: 'missing_authoritative_coverage',
      };
    // Require all substantive question concepts somewhere in the evidence. This is conservative,
    // not an entailment model; unsupported synonyms may cause safe false abstentions.
    if (retrieval.strategy !== 'STRUCTURED') {
      const sourceTerms = new Set(
        terms(useful.map((e) => `${e.section ?? ''} ${e.content}`).join(' ')),
      );
      const concepts = terms(question).filter(
        (t) =>
          ![
            'entitlement',
            'rule',
            'approve',
            'can',
            'manager',
            'kes',
            'purchase',
            'receive',
            'get',
          ].includes(t),
      );
      if (concepts.some((t) => !sourceTerms.has(t)))
        return {
          ...base,
          decision: 'INSUFFICIENT',
          reason: 'question_concepts_not_covered',
        };
    }
    return {
      ...base,
      decision: 'SUFFICIENT',
      reason: 'authoritative_coverage',
    };
  }
}
