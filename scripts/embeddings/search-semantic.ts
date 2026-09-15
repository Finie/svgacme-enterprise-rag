import { run } from './runtime.js';
import { validateEmbeddings } from '../../apps/src/embeddings/embedding-store.js';
await run(async (app) => {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) throw new Error('Usage: npm run search:semantic -- "your query"');
  await validateEmbeddings(app.db, app.config, true);
  const start = performance.now();
  const results = await app.search.search(query);
  return { query, elapsedMs: performance.now() - start, results };
});
