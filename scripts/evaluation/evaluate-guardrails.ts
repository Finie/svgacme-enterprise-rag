import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { runtime } from '../embeddings/runtime.js';
import { InputGuardrailService } from '../../apps/src/questions/guardrails/input.service.js';
import { EvidenceGateService } from '../../apps/src/questions/guardrails/evidence.service.js';
import { RetrievalRouterService } from '../../apps/src/questions/guardrails/retrieval.service.js';
import { SearchService } from '../../apps/src/search/search.service.js';
import type { PrismaService } from '../../apps/src/database/prisma.service.js';
import type { Retrieval } from '../../apps/src/questions/guardrails/types.js';
const app = runtime();
await mkdir('tmp/guardrail-evaluation', { recursive: true });
const originalEmbed = app.provider.embed.bind(app.provider);
const originalBatch = app.provider.embedBatch.bind(app.provider);
app.provider.embedBatch = async (texts: string[]) => {
  const { createHash } = await import('node:crypto');
  const path = `tmp/guardrail-evaluation/documents-${createHash('sha256')
    .update(JSON.stringify(app.provider.space) + JSON.stringify(texts))
    .digest('hex')}.json`;
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {}
  const vectors = await originalBatch(texts);
  await writeFile(path, JSON.stringify(vectors));
  return vectors;
};
const memo = new Map<string, Promise<number[]>>();
app.provider.embed = (text: string) => {
  if (!memo.has(text))
    memo.set(
      text,
      (async () => {
        const { createHash } = await import('node:crypto');
        const path = `tmp/guardrail-evaluation/vector-${createHash('sha256')
          .update(JSON.stringify(app.provider.space) + text)
          .digest('hex')}.json`;
        try {
          return JSON.parse(await readFile(path, 'utf8')) as number[];
        } catch {}
        const vector = await originalEmbed(text);
        await writeFile(path, JSON.stringify(vector));
        return vector;
      })().catch((error) => {
        memo.delete(text);
        throw error;
      }),
    );
  return memo.get(text)!;
};
try {
  const questions = JSON.parse(
    await readFile('data/test-questions/questions.json', 'utf8'),
  ) as {
    id: string;
    question: string;
    answerability: string;
    expectedBehavior: string;
  }[];
  const input = new InputGuardrailService(app.provider);
  const router = new RetrievalRouterService(
    app.db as PrismaService,
    new SearchService(app.db as PrismaService, app.search),
  );
  const gate = new EvidenceGateService();
  const rows: {
    id: string;
    answerable: boolean;
    inputDecision: string;
    retrieval: Retrieval;
    bestScore: number | null;
  }[] = [];
  for (const q of questions) {
    const cachePath = `tmp/guardrail-evaluation/${q.id}.json`;
    const result = await input.check(q.question);
    // Score all questions offline to measure distributions, including Gate 1 rejections.
    const raw = await app.search.search(q.question, {
      topK: 10,
      documentType: 'POLICY',
    });
    const retrieval =
      result.decision === 'ALLOW'
        ? await router.retrieve(q.question, result.route!, 10)
        : { evidence: [], required: [], strategy: 'SEMANTIC' as const };
    rows.push({
      id: q.id,
      answerable: q.answerability === 'answerable',
      inputDecision: result.decision,
      retrieval,
      bestScore: raw[0]?.score ?? null,
    });
    await writeFile(
      cachePath,
      JSON.stringify({
        version: 2,
        space: app.provider.space,
        row: rows.at(-1),
      }),
    );
    process.stderr.write(`Evaluated ${rows.length}/${questions.length}\n`);
  }
  const distribution = (answerable: boolean) => {
    const s = rows
      .filter((r) => r.answerable === answerable && r.bestScore !== null)
      .map((r) => r.bestScore!)
      .sort((a, b) => a - b);
    return {
      count: s.length,
      min: s[0],
      p25: s[Math.floor(s.length * 0.25)],
      median: s[Math.floor(s.length * 0.5)],
      p75: s[Math.floor(s.length * 0.75)],
      max: s.at(-1),
    };
  };
  const candidates = [
    ...new Set(
      rows.map((r) => r.bestScore).filter((v): v is number => v !== null),
    ),
  ].sort((a, b) => a - b);
  const trials = candidates.map((threshold) => {
    process.env.GUARDRAIL_EVIDENCE_THRESHOLD = String(threshold);
    const allowed = rows.map(
      (r, i) =>
        r.inputDecision === 'ALLOW' &&
        gate.evaluate(questions[i].question, r.retrieval).decision ===
          'SUFFICIENT',
    );
    return {
      threshold,
      falsePositives: rows.filter((r, i) => !r.answerable && allowed[i]).length,
      falseNegatives: rows.filter((r, i) => r.answerable && !allowed[i]).length,
      scoreOnlyFalsePositives: rows.filter(
        (r) => !r.answerable && (r.bestScore ?? -1) >= threshold,
      ).length,
      scoreOnlyFalseNegatives: rows.filter(
        (r) => r.answerable && (r.bestScore ?? -1) < threshold,
      ).length,
    };
  });
  // Tune the complete evidence gate, not a score-only classifier; other checks remain mandatory.
  trials.sort(
    (a, b) =>
      a.falsePositives - b.falsePositives ||
      a.falseNegatives - b.falseNegatives ||
      b.threshold - a.threshold,
  );
  const selected = trials[0];
  process.env.GUARDRAIL_EVIDENCE_THRESHOLD = String(selected.threshold);
  const results = rows.map((r, i) => ({
    id: r.id,
    answerable: r.answerable,
    inputDecision: r.inputDecision,
    route: r.retrieval.strategy,
    bestScore: r.bestScore,
    evidenceDecision:
      r.inputDecision === 'ALLOW'
        ? gate.evaluate(questions[i].question, r.retrieval).decision
        : 'NOT_RUN',
  }));
  const report = {
    population: rows.length,
    embeddingSpace: app.provider.space,
    metric: 'cosine similarity (1 - pgvector cosine distance)',
    scope:
      'domain versus out-of-domain embedding prototypes; zero relative margin',
    distributions: {
      answerable: distribution(true),
      unanswerable: distribution(false),
    },
    selected,
    selectionRule:
      'Minimize complete-gate false positives first, then false negatives, then prefer the highest threshold; calibration population is not a held-out test set',
    gate1: {
      allowed: rows.filter((r) => r.inputDecision === 'ALLOW').length,
      falseRejections: rows.filter(
        (r) => r.answerable && r.inputDecision !== 'ALLOW',
      ).length,
    },
    gate2: {
      falsePasses: results.filter(
        (r) => !r.answerable && r.evidenceDecision === 'SUFFICIENT',
      ).length,
      falseAbstentions: results.filter(
        (r) => r.answerable && r.evidenceDecision !== 'SUFFICIENT',
      ).length,
    },
    generationCalls: 0,
    results,
  };
  await writeFile(
    'docs/guardrail-evaluation.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  await writeFile(
    'apps/src/questions/guardrails/calibration.ts',
    '// Generated by evaluate:guardrails; see docs/guardrail-evaluation.json.\nexport const calibration = ' +
      JSON.stringify(
        { ...app.provider.space, threshold: selected.threshold },
        null,
        2,
      ) +
      ' as const;\n',
  );
  console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
} catch (error) {
  console.error(
    error instanceof Error &&
      /^(Embedding API|Search unavailable)/.test(error.message)
      ? error.message
      : 'Evaluation stage failed',
  );
  console.error(
    'Guardrail evaluation could not complete. Check database and embedding provider availability. No new calibration report was produced; any previous report remains unchanged.',
  );
  process.exitCode = 1;
} finally {
  await app.db.$disconnect();
}
