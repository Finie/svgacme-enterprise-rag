import { run } from '../embeddings/runtime.js';
import { validateEmbeddings } from '../../apps/src/embeddings/embedding-store.js';
import { batches } from '../../apps/src/embeddings/embedding-provider.js';
import { retrievalMetrics } from './retrieval-metrics.js';
await run(async (app) => {
  // Only question text and source locators are selected; no answer keys or reasoning.
  const all = await app.db.evaluationQuestion.findMany({
    orderBy: { questionId: 'asc' },
    select: {
      questionId: true,
      question: true,
      answerability: true,
      expectedBehavior: true,
      sources: {
        where: { referenceKind: 'required' },
        select: { policyId: true, policySectionOrdinal: true },
      },
    },
  });
  const selected = all.filter(
    (q) =>
      q.answerability === 'answerable' &&
      q.expectedBehavior === 'answer' &&
      q.sources.length > 0 &&
      q.sources.every((s) => s.policyId !== null),
  );
  const subset = {
    totalQuestions: all.length,
    supportedQuestions: selected.length,
    excludedQuestions: all.length - selected.length,
  };
  if (process.argv.includes('--dry-run'))
    return { ...subset, space: app.provider.space, apiCalls: 0, dryRun: true };
  if (!selected.length)
    throw new Error('No policy-only answerable questions to evaluate');
  await validateEmbeddings(app.db, app.config, true);
  const perQuestion: {
    questionId: string;
    required: { policyId: string; policySectionOrdinal: number | null }[];
    retrieved: {
      chunkId: string;
      policyId: string | null;
      policySectionOrdinal: number | null;
    }[];
    metrics: Record<number, ReturnType<typeof retrievalMetrics>>;
  }[] = [];
  for (const batch of batches(selected, app.config.batchSize)) {
    const vectors = await app.provider.embedBatch(batch.map((q) => q.question));
    for (const [i, q] of batch.entries()) {
      const retrieved = await app.search.searchVector(vectors[i], {
        topK: 10,
        documentType: 'POLICY',
      });
      const required = q.sources.map((s) => ({
        policyId: s.policyId!,
        policySectionOrdinal: s.policySectionOrdinal,
      }));
      perQuestion.push({
        questionId: q.questionId,
        required,
        retrieved: retrieved.map((r) => ({
          chunkId: r.chunkId,
          policyId: r.policyId,
          policySectionOrdinal: r.policySectionOrdinal,
        })),
        metrics: Object.fromEntries(
          [1, 3, 5, 10].map((k) => [
            k,
            retrievalMetrics(required, retrieved, k),
          ]),
        ),
      });
    }
  }
  const metrics = Object.fromEntries(
    [1, 3, 5, 10].map((k) => [
      k,
      {
        recall:
          perQuestion.reduce((sum, q) => sum + q.metrics[k].recall, 0) /
          perQuestion.length,
        precision:
          perQuestion.reduce((sum, q) => sum + q.metrics[k].precision, 0) /
          perQuestion.length,
        mrr:
          perQuestion.reduce((sum, q) => sum + q.metrics[k].reciprocalRank, 0) /
          perQuestion.length,
      },
    ]),
  );
  return {
    ...subset,
    space: app.provider.space,
    metrics,
    apiCalls: app.provider.apiCalls,
    perQuestion,
  };
});
