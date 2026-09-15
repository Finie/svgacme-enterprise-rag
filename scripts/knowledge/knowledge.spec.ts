import { describe, expect, it } from 'vitest';
import { config, normalize, splitText } from './chunking.js';
import {
  documentChunks,
  policyDocument,
  scenarioDocument,
  type PolicySource,
} from './documents.js';
import { reconcile } from './pipeline.js';
const cfg = { size: 100, overlap: 20, scenarioIds: [] };
const policy = {
  policyId: 'P-1',
  title: 'Policy',
  departmentId: 'D-1',
  classification: 'Internal',
  status: 'Active',
  version: '1',
  sections: [
    {
      policyId: 'P-1',
      sectionOrdinal: 1,
      heading: 'Scope',
      sourceHeading: '1. Scope',
      bodyMarkdown: 'A short policy section.',
    },
  ],
} as PolicySource;
const chunks = (p = policy) => documentChunks(policyDocument(p), cfg);
describe('knowledge generation', () => {
  it('keeps a small section whole', () =>
    expect(splitText('A short section.', cfg).map((c) => c.content)).toEqual([
      'A short section.',
    ]));
  it('splits large sections without losing non-whitespace content', () => {
    const source = 'This is a complete sentence. '.repeat(30).trim();
    const spans = splitText(source, cfg);
    expect(spans.length).toBeGreaterThan(1);
    let end = 0;
    for (const span of spans) {
      expect(source.slice(end, span.start).trim()).toBe('');
      expect(source.slice(span.start, span.end)).toBe(span.content);
      end = span.end;
    }
    expect(end).toBe(source.length);
  });
  it('prefers paragraphs and sentences', () => {
    const para = 'This paragraph ends at a coherent boundary with enough text.';
    const spans = splitText(
      `${para}\n\n${'A further sentence follows. '.repeat(8)}`,
      cfg,
    );
    expect(spans[0].content).toBe(para);
    expect(spans.slice(1).every((c) => c.content.endsWith('.'))).toBe(true);
  });
  it('overlaps on boundaries within the configured budget', () => {
    const source = 'One sentence ends. Another sentence ends. '.repeat(10);
    const spans = splitText(source, cfg);
    expect(spans.some((s, i) => i > 0 && s.start < spans[i - 1].end)).toBe(
      true,
    );
    for (let i = 1; i < spans.length; i++)
      expect(spans[i - 1].end - spans[i].start).toBeLessThanOrEqual(
        cfg.overlap,
      );
    const noOverlap = splitText(source, { ...cfg, overlap: 0 });
    expect(
      noOverlap.every((s, i) => !i || s.start >= noOverlap[i - 1].end),
    ).toBe(true);
  });
  it('generates deterministic IDs and hashes', () => {
    expect(chunks()).toEqual(chunks());
    expect(chunks()[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it('preserves policy provenance', () =>
    expect(chunks()[0]).toMatchObject({
      documentType: 'POLICY',
      sourceId: 'P-1',
      policyId: 'P-1',
      policySectionOrdinal: 1,
      scenarioId: null,
      metadata: { policy_section_id: 'P-1:1', section_number: 1 },
    }));
  it('preserves scenario provenance and excludes evaluation fields', () => {
    const scenario = {
      scenarioId: 'S-1',
      title: 'Example',
      category: 'compliance',
      difficulty: 'hard',
      businessContext: 'Business context.',
      description: 'Observed description.',
      events: [{ sequence: 1, event: 'Observed event.' }],
      relevantFacts: ['Observed fact.'],
      expectedOutcome: 'SECRET_OUTCOME',
      requiredReasoning: ['SECRET_REASONING'],
      expectedAnswer: 'SECRET_ANSWER',
    };
    const rows = documentChunks(scenarioDocument(scenario), cfg);
    expect(rows.length).toBe(4);
    expect(rows[0]).toMatchObject({
      policyId: null,
      policySectionOrdinal: null,
      scenarioId: 'S-1',
      metadata: { category: 'compliance', difficulty: 'hard', synthetic: true },
    });
    expect(JSON.stringify(rows)).not.toContain('SECRET');
  });
  it('repeated reconciliation is idempotent', () =>
    expect(reconcile(chunks(), chunks())).toEqual({
      changed: [],
      removed: [],
      unchanged: 1,
    }));
  it('changes content hash but retains logical ID on source edits', () => {
    const modified = chunks({
      ...policy,
      sections: [{ ...policy.sections[0], bodyMarkdown: 'Changed text.' }],
    });
    expect(modified[0].contentHash).not.toBe(chunks()[0].contentHash);
    expect(modified[0].id).toBe(chunks()[0].id);
    expect(reconcile(chunks(), modified).changed).toHaveLength(1);
  });
  it('retains hashes for unchanged source and normalized whitespace', () => {
    expect(
      chunks({
        ...policy,
        sections: [
          {
            ...policy.sections[0],
            bodyMarkdown: ' A  short policy section.\r\n',
          },
        ],
      })[0].contentHash,
    ).toBe(chunks()[0].contentHash);
  });
  it('removes stale chunks after shrink or deselection', () =>
    expect(reconcile(chunks(), []).removed).toHaveLength(1));
  it('never crosses section boundaries', () => {
    const rows = chunks({
      ...policy,
      sections: [
        ...policy.sections,
        {
          ...policy.sections[0],
          sectionOrdinal: 2,
          bodyMarkdown: 'Second section.',
        },
      ],
    });
    expect(rows.map((c) => c.policySectionOrdinal)).toEqual([1, 2]);
    expect(rows.map((c) => c.chunkIndex)).toEqual([0, 1]);
  });
  it('normalizes whitespace while preserving Markdown boundaries', () =>
    expect(normalize(' a  b\r\n\r\n\r\n- c\t d ')).toBe('a b\n\n- c d'));
  it('handles empty and unbroken input with progress', () => {
    expect(splitText('  ', cfg)).toEqual([]);
    expect(
      splitText('x'.repeat(500), cfg)
        .map((c) => c.content)
        .join(''),
    ).toBe('x'.repeat(500));
  });
  it('rejects invalid configuration and defaults to no scenarios', () => {
    expect(() => config({ CHUNK_SIZE: 'NaN' })).toThrow();
    expect(() => config({ CHUNK_SIZE: '100', CHUNK_OVERLAP: '50' })).toThrow();
    expect(config({}).scenarioIds).toEqual([]);
  });
});
