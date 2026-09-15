import { run } from './runtime.js';
import { validateEmbeddings } from '../../apps/src/embeddings/embedding-store.js';
await run((app) =>
  validateEmbeddings(
    app.db,
    app.config,
    process.argv.includes('--require-complete'),
  ),
);
