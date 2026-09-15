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
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  apiCalls = 0;
  readonly space;
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
  }
  async embed(text: string): Promise<number[]> {
    return (await this.embedBatch([text]))[0];
  }
  async embedBatch(texts: string[]): Promise<number[][]> {
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
        const response = await this.request(
          'https://api.openai.com/v1/embeddings',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.cfg.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: this.cfg.model,
              dimensions: this.cfg.dimensions,
              input: texts,
              encoding_format: 'float',
            }),
            signal: AbortSignal.timeout(this.cfg.timeoutMs),
          },
        );
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
          model?: string;
          data?: { index: number; embedding: unknown }[];
        };
        if (
          body.model !== this.cfg.model ||
          !Array.isArray(body.data) ||
          body.data.length !== texts.length
        )
          throw new ProviderError(
            'Embedding API returned an unexpected model or batch length',
          );
        const ordered: number[][] = new Array(texts.length);
        for (const item of body.data) {
          if (
            !Number.isInteger(item.index) ||
            item.index < 0 ||
            item.index >= texts.length ||
            ordered[item.index]
          )
            throw new ProviderError(
              'Embedding API returned invalid batch indexes',
            );
          validateVector(item.embedding, this.cfg.dimensions);
          ordered[item.index] = item.embedding;
        }
        return ordered;
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
