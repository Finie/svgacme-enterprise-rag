import { Injectable } from '@nestjs/common';
import type { Evidence, GroundingStatus } from './types.js';
import { securityDecision } from './input.service.js';
function numbers(text: string) {
  return (
    text.replace(/\[E\d+\]/g, '').match(/\b\d[\d,]*(?:\.\d+)?\b/g) ?? []
  ).map((n) => Number(n.replaceAll(',', '')));
}
@Injectable()
export class OutputGuardrailService {
  validate(
    answer: string,
    evidence: Evidence[],
  ): {
    accepted: boolean;
    status: GroundingStatus;
    citations: {
      id: string;
      sourceType: string;
      sourceId: string;
      section?: string;
    }[];
  } {
    const fail = (status: GroundingStatus) => ({
      accepted: false,
      status,
      citations: [],
    });
    if (!answer?.trim() || !evidence.length)
      return fail('INSUFFICIENT_EVIDENCE');
    const ids = [...answer.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
    if (
      !ids.length ||
      ids.some(
        (id) =>
          !/^E\d+$/.test(id) ||
          !evidence.some((e) => e.id === id && e.sourceId),
      )
    )
      return fail('INVALID_CITATION');
    const configuredSecrets = Object.entries(process.env)
      .filter(
        ([key, value]) =>
          /(?:API_KEY|PASSWORD|SECRET|TOKEN|DATABASE_URL)$/.test(key) &&
          value &&
          value.length >= 8,
      )
      .map(([, value]) => value!);
    if (configuredSecrets.some((value) => answer.includes(value)))
      return fail('UNSUPPORTED_CLAIM');
    if (
      securityDecision(answer) ||
      /(?:postgres(?:ql)?:\/\/|AIza[\w-]{20,}|sk-[\w-]{16,})/.test(answer)
    )
      return fail('UNSUPPORTED_CLAIM');
    // Check each claim against its own cited sources, not arbitrary numbers elsewhere in context.
    const sentences = answer.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim());
    for (const sentence of sentences) {
      const cited = [...sentence.matchAll(/\[(E\d+)\]/g)].map((m) =>
        evidence.find((e) => e.id === m[1])!,
      );
      if (!cited.length) return fail('UNSUPPORTED_CLAIM');
      const supported = numbers(cited.map((e) => e.content).join(' '));
      if (numbers(sentence).some((n) => !supported.includes(n)))
        return fail('UNSUPPORTED_CLAIM');
      if (
        /\b(insufficient|cannot determine|couldn't find|not enough evidence)\b/i.test(
          sentence,
        )
      )
        return fail('INSUFFICIENT_EVIDENCE');
    }
    return {
      accepted: true,
      status: 'GROUNDED',
      citations: [...new Set(ids)].map((id) => {
        const e = evidence.find((e) => e.id === id)!;
        return {
          id,
          sourceType: e.sourceType,
          sourceId: e.sourceId,
          section: e.section,
        };
      }),
    };
  }
}
