import { run } from './runtime.js';
import { validateVector } from '../../apps/src/embeddings/embedding-provider.js';
await run(async (app) => {
  const vector = await app.provider.embed(
    'Employees must declare actual or potential conflicts of interest.',
  );
  validateVector(vector, app.config.dimensions);
  return {
    smoke: 'PASS',
    space: app.provider.space,
    dimensions: vector.length,
    apiCalls: app.provider.apiCalls,
    databaseWrites: 0,
  };
});
