import type { EmbeddingSpace } from './config.js';
export interface EmbeddingProvider {
  readonly space: EmbeddingSpace;
  readonly apiCalls: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
export function validateVector(
  value: unknown,
  dimensions: number,
): asserts value is number[] {
  if (
    !Array.isArray(value) ||
    value.length !== dimensions ||
    !Array.from(value).every(
      (n) =>
        typeof n === 'number' &&
        Number.isFinite(n) &&
        Math.abs(n) <= 3.402823466e38,
    )
  )
    throw new Error(
      `Invalid embedding: expected ${dimensions} finite float32 values`,
    );
  if (!value.some((n) => Math.fround(n) !== 0))
    throw new Error(
      'Invalid embedding: cosine distance requires a nonzero vector',
    );
}
export function batches<T>(items: T[], size: number): T[][] {
  if (!Number.isSafeInteger(size) || size < 1)
    throw new Error('Invalid batch size');
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );
}
