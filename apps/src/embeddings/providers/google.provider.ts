import type { EmbeddingConfig } from '../config.js';
import {
  validateVector,
  type EmbeddingProvider,
} from '../embedding-provider.js';
class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
    readonly retryAfterMs = 0,
  ) {
    super(message);
  }
}
type TaskType = 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT';
function normalize(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, n) => sum + n * n, 0));
  if (!(norm > 0))
    throw new ProviderError('Embedding API returned a zero vector');
  return values.map((n) => n / norm);
}
export class GoogleEmbeddingProvider implements EmbeddingProvider {
  apiCalls = 0;
  readonly space;
  private readonly endpoint: string;
  constructor(
    private readonly cfg: EmbeddingConfig,
    private readonly request: typeof fetch = fetch,
    private readonly pause: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {
    this.space = {
      provider: cfg.provider,
      model: cfg.model,
      dimensions: cfg.dimensions,
      version: cfg.version,
    };
    this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:batchEmbedContents`;
  }
  // Query and document text use asymmetric Gemini task types, which the
  // provider improves retrieval quality with; OpenAI has no such distinction.
  async embed(text: string): Promise<number[]> {
    return (await this.call([text], 'RETRIEVAL_QUERY'))[0];
  }
  async embedBatch(texts: string[]): Promise<number[][]> {
    return this.call(texts, 'RETRIEVAL_DOCUMENT');
  }
  private async call(
    texts: string[],
    taskType: TaskType,
  ): Promise<number[][]> {
    if (!texts.length) return [];
    if (texts.some((t) => !t.trim()))
      throw new Error('Embedding input must be nonempty');
    if (!this.cfg.apiKey)
      throw new Error(
        'EMBEDDING_API_KEY is not set; configure it in local .env',
      );
    for (let attempt = 0; ; attempt++) {
      try {
        this.apiCalls++;
        const response = await this.request(this.endpoint, {
          method: 'POST',
          headers: {
            'x-goog-api-key': this.cfg.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: texts.map((text) => ({
              model: `models/${this.cfg.model}`,
              content: { parts: [{ text }] },
              taskType,
              outputDimensionality: this.cfg.dimensions,
            })),
          }),
          signal: AbortSignal.timeout(this.cfg.timeoutMs),
        });
        if (!response.ok) {
          const retryAfter = response.headers.get('retry-after');
          const delay =
            retryAfter === null
              ? 0
              : Number.isFinite(Number(retryAfter))
                ? Number(retryAfter) * 1000
                : Date.parse(retryAfter) - Date.now();
          // Do not print provider bodies, inputs or credentials in errors.
          await response.body?.cancel();
          throw new ProviderError(
            `Embedding API HTTP ${response.status}`,
            [429, 500, 502, 503, 504].includes(response.status),
            Math.max(0, Math.min(30000, delay || 0)),
          );
        }
        const body = (await response.json()) as {
          embeddings?: { values?: unknown }[];
        };
        if (
          !Array.isArray(body.embeddings) ||
          body.embeddings.length !== texts.length
        )
          throw new ProviderError(
            'Embedding API returned an unexpected batch length',
          );
        // batchEmbedContents does not echo a per-item index (unlike OpenAI);
        // Google documents response order as matching request order.
        return body.embeddings.map((item) => {
          validateVector(item.values, this.cfg.dimensions);
          return normalize(item.values as number[]);
        });
      } catch (error) {
        const transient =
          error instanceof ProviderError
            ? error.retryable
            : error instanceof TypeError ||
              (error instanceof Error &&
                ['TimeoutError', 'AbortError'].includes(error.name));
        if (!transient || attempt >= this.cfg.maxRetries) {
          if (error instanceof ProviderError) throw error;
          throw new Error(
            transient
              ? 'Embedding API connection/timeout failure; retries exhausted'
              : 'Embedding API returned an invalid response',
          );
        }
        await this.pause(
          Math.max(
            error instanceof ProviderError ? error.retryAfterMs : 0,
            Math.min(
              30000,
              500 * 2 ** attempt + Math.floor(Math.random() * 250),
            ),
          ),
        );
      }
    }
  }
}
