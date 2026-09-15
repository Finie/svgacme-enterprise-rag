import { run } from './runtime.js';
await run((app) => app.embeddings.build(process.argv.includes('--dry-run')));
