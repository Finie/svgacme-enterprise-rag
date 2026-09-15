export const DATABASE_DIMENSIONS = 1536;
export interface EmbeddingSpace {
  provider: string;
  model: string;
  dimensions: number;
  version: string;
}
export interface EmbeddingConfig extends EmbeddingSpace {
  apiKey?: string;
  batchSize: number;
  timeoutMs: number;
  maxRetries: number;
}
export function embeddingConfig(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingConfig {
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const n = Number(env[key] ?? fallback);
    if (!Number.isSafeInteger(n) || n < min || n > max)
      throw new Error(`${key} must be an integer between ${min} and ${max}`);
    return n;
  };
  const provider = env.EMBEDDING_PROVIDER?.trim() || 'google';
  const model = env.EMBEDDING_MODEL?.trim() || 'gemini-embedding-001';
  // Each model's dimension contract must be verified against the provider
  // before being registered here; see docs/embeddings/provider.md.
  const modelsByProvider: Record<string, readonly string[]> = {
    google: ['gemini-embedding-001'],
    openai: ['text-embedding-3-small', 'text-embedding-3-large'],
  };
  const models = modelsByProvider[provider];
  if (!models)
    throw new Error(`Unsupported EMBEDDING_PROVIDER: ${provider}`);
  if (!models.includes(model))
    throw new Error(
      'Unsupported EMBEDDING_MODEL; register and verify its dimension contract first',
    );
  const dimensions = integer(
    'EMBEDDING_DIMENSIONS',
    DATABASE_DIMENSIONS,
    1,
    3072,
  );
  if (dimensions !== DATABASE_DIMENSIONS)
    throw new Error(
      'EMBEDDING_DIMENSIONS differs from vector(1536); migrate the schema before changing dimensions',
    );
  return {
    provider,
    model,
    dimensions,
    version: env.EMBEDDING_VERSION?.trim() || 'content-v1',
    apiKey: env.EMBEDDING_API_KEY?.trim(),
    batchSize: integer('EMBEDDING_BATCH_SIZE', 32, 1, 2048),
    timeoutMs: integer('EMBEDDING_TIMEOUT_MS', 30000, 1, 120000),
    maxRetries: integer('EMBEDDING_MAX_RETRIES', 3, 0, 5),
  };
}
