import type { EmbeddingConfig } from '../config.js';
import type { EmbeddingProvider } from '../embedding-provider.js';
import { OpenAIEmbeddingProvider } from './openai.provider.js';
import { GoogleEmbeddingProvider } from './google.provider.js';
export function createEmbeddingProvider(
  cfg: EmbeddingConfig,
): EmbeddingProvider {
  switch (cfg.provider) {
    case 'google':
      return new GoogleEmbeddingProvider(cfg);
    case 'openai':
      return new OpenAIEmbeddingProvider(cfg);
    default:
      throw new Error(`Unsupported EMBEDDING_PROVIDER: ${cfg.provider}`);
  }
}
