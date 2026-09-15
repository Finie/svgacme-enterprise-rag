import { run } from './runtime.js';
import { validateEmbeddings } from '../../apps/src/embeddings/embedding-store.js';
await run(async (app) => {
  const corpus = await validateEmbeddings(app.db, app.config, true);
  const start = performance.now();
  const vector = await app.provider.embed(
    'What are the rules around conflicts of interest?',
  );
  const queryEmbeddingMs = performance.now() - start;
  const timings = [];
  for (const topK of [1, 3, 5, 10]) {
    await app.search.searchVector(vector, { topK });
    const samples = [];
    for (let i = 0; i < 20; i++) {
      const t = performance.now();
      await app.search.searchVector(vector, { topK });
      samples.push(performance.now() - t);
    }
    samples.sort((a, b) => a - b);
    timings.push({
      topK,
      samples: samples.length,
      medianMs: (samples[9] + samples[10]) / 2,
      p95Ms: samples[18],
    });
  }
  return {
    measuredAt: new Date().toISOString(),
    corpus: corpus.current,
    space: app.provider.space,
    queryEmbeddingMs,
    timings,
  };
});
