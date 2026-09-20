import { createPrismaClient } from '../scripts/database/lib/client.js';
import { RetrievalRouterService } from '@/questions/guardrails/retrieval.service.js';
import { EvidenceGateService } from '@/questions/guardrails/evidence.service.js';
import type { PrismaService } from '@/database/prisma.service.js';
import type { SearchService } from '@/search/search.service.js';
import { routeQuestion } from '@/questions/guardrails/input.service.js';
import { readFileSync } from 'node:fs';

describe('guardrail retrieval against PostgreSQL', () => {
  const db = createPrismaClient();
  const search = { find: vi.fn() };
  const router = new RetrievalRouterService(
    db as PrismaService,
    search as unknown as SearchService,
  );
  beforeEach(() => {
    vi.stubEnv('GUARDRAIL_EVIDENCE_THRESHOLD', '.7');
    search.find.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => db.$disconnect());
  it('retrieves stock with a fixed SQL template, without semantic search', async () => {
    const row = await db.inventory.findFirstOrThrow();
    const r = await router.retrieve(
      `How many units of ${row.productId} are available?`,
      'STRUCTURED',
      5,
    );
    expect(r.evidence.length).toBeGreaterThan(0);
    expect(r.evidence.every((e) => e.sourceType === 'structured')).toBe(true);
    expect(new EvidenceGateService().evaluate('stock', r).decision).toBe(
      'SUFFICIENT',
    );
    expect(search.find).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toMatch(/password|email|phone/);
  });
  it('retrieves Finance Manager authority plus policy for hybrid questions', async () => {
    search.find.mockResolvedValue(
      ['FIN-POL-002', 'PROC-POL-001'].map((policyId) => ({
        chunkId: policyId,
        policyId,
        sourceId: policyId,
        documentType: 'POLICY',
        score: 0.9,
        content: 'Finance Manager can approve a KES 1.5M purchase.',
        sectionHeading: 'Approval authority',
      })),
    );
    const r = await router.retrieve(
      'Can the Finance Manager approve a KES 1.5M purchase?',
      'HYBRID',
      5,
    );
    expect(r.evidence.some((e) => e.sourceType === 'structured')).toBe(true);
    expect(r.evidence.some((e) => e.sourceType === 'policy')).toBe(true);
    expect(
      new EvidenceGateService().evaluate(
        'Can the Finance Manager approve a KES 1.5M purchase?',
        r,
      ).decision,
    ).toBe('SUFFICIENT');
  });
  it('requires both policy sources for an existing cross-domain question', async () => {
    const questions = JSON.parse(
      readFileSync('data/test-questions/categories/cross-domain.json', 'utf8'),
    ) as { question: string }[];
    const q = questions.find((q) =>
      q.question.startsWith('A P1 incident'),
    )!.question;
    expect(routeQuestion(q)).toBe('CROSS_DOMAIN');
    search.find.mockResolvedValue([
      {
        chunkId: 'incident',
        policyId: 'IT-POL-002',
        sourceId: 'IT-POL-002',
        documentType: 'POLICY',
        score: 0.9,
        content: q + ' Log the incident in the service desk.',
        sectionHeading: 'Incident response',
      },
      {
        chunkId: 'privacy',
        policyId: 'COMP-POL-001',
        sourceId: 'COMP-POL-001',
        documentType: 'POLICY',
        score: 0.9,
        content: 'Escalate exposure of customer data to Compliance.',
        sectionHeading: 'Privacy response',
      },
    ]);
    const r = await router.retrieve(q, 'CROSS_DOMAIN', 5);
    expect(r.required).toContain('IT-POL-002');
    expect(r.required).toContain('COMP-POL-001');
    expect(new EvidenceGateService().evaluate(q, r).decision).toBe(
      'SUFFICIENT',
    );
    r.evidence = r.evidence.filter((e) => e.sourceId !== 'COMP-POL-001');
    expect(new EvidenceGateService().evaluate(q, r).decision).toBe(
      'INSUFFICIENT',
    );
  });
  it.each([
    'Which department and role are recorded for Samuel Kariuki (EMP-0001)?',
    "What is SVGA Enterprise's legal name?",
    'How many employees does the canonical company profile report?',
    'What is the status of Microsoft Dynamics 365 Finance?',
    'Which city is Nairobi Distribution Centre in?',
    'Which cost center belongs to Finance?',
    'Who is the account manager for Nairobi Retail Holdings?',
    'Which supplier provides Tumaini Gold Cooking Oil 5L?',
    'How much available stock of Tumaini Gold Cooking Oil 5L is recorded at Nairobi Distribution Centre?',
  ])('uses a bounded structured template for %s', async (question) => {
    expect(routeQuestion(question)).toBe('STRUCTURED');
    const r = await router.retrieve(question, 'STRUCTURED', 5);
    expect(new EvidenceGateService().evaluate(question, r).decision).toBe(
      'SUFFICIENT',
    );
    expect(search.find).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toMatch(
      /contactPhone|contactEmail|password|database_url/,
    );
  });
  it('does not substitute another warehouse for an unresolved requested warehouse', async () => {
    const question =
      'How much available stock of Tumaini Gold Cooking Oil 5L is recorded at Unknown Warehouse?';
    const r = await router.retrieve(question, 'STRUCTURED', 5);
    expect(new EvidenceGateService().evaluate(question, r).decision).toBe(
      'INSUFFICIENT',
    );
  });
  it('does not treat absent operational rows as sufficient', async () => {
    const r = await router.retrieve(
      'How many units of PROD-DOES-NOT-EXIST are available?',
      'STRUCTURED',
      5,
    );
    expect(new EvidenceGateService().evaluate('stock', r).decision).toBe(
      'NO_EVIDENCE',
    );
  });
});
