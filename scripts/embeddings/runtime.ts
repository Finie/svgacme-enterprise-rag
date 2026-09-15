import { createPrismaClient } from '../database/lib/client.js';
import { embeddingConfig } from '../../apps/src/embeddings/config.js';
import { createEmbeddingProvider } from '../../apps/src/embeddings/providers/index.js';
import { EmbeddingsService } from '../../apps/src/embeddings/embeddings.service.js';
import { SemanticSearchService } from '../../apps/src/search/semantic-search.service.js';
export function runtime() {
  const config = embeddingConfig();
  const db = createPrismaClient();
  const provider = createEmbeddingProvider(config);
  return {
    config,
    db,
    provider,
    embeddings: new EmbeddingsService(db, provider, config),
    search: new SemanticSearchService(db, provider),
  };
}
export async function run(
  task: (app: ReturnType<typeof runtime>) => Promise<unknown>,
) {
  const app = runtime();
  try {
    console.log(JSON.stringify(await task(app), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Command failed');
    process.exitCode = 1;
  } finally {
    await app.db.$disconnect();
  }
}
