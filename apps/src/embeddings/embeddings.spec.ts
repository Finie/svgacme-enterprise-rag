import { describe, expect, it, vi } from 'vitest';
import { embeddingConfig } from './config.js';
import {
  batches,
  validateVector,
  type EmbeddingProvider,
} from './embedding-provider.js';
import { OpenAIEmbeddingProvider } from './providers/openai.provider.js';
import { GoogleEmbeddingProvider } from './providers/google.provider.js';
import { createEmbeddingProvider } from './providers/index.js';
import { EmbeddingsService } from './embeddings.service.js';
import { candidates, validateEmbeddings } from './embedding-store.js';
import {
  filterSql,
  mapResult,
  SemanticSearchService,
} from '../search/semantic-search.service.js';
import type { PrismaClient } from '../generated/prisma/client.js';
const openaiCfg = {
  ...embeddingConfig({
    EMBEDDING_PROVIDER: 'openai',
    EMBEDDING_MODEL: 'text-embedding-3-small',
  }),
  apiKey: 'test-key',
};
const cfg = { ...embeddingConfig({}), apiKey: 'test-key' }; // active default: google
const vector: number[] = Array.from({ length: 1536 }, (_, i) =>
  i === 0 ? 1 : 0,
);
const response = (data = [{ index: 0, embedding: vector }]) =>
  new Response(JSON.stringify({ model: openaiCfg.model, data }), {
    status: 200,
  });
describe('openai embedding provider', () => {
  it('implements single and batch input and restores provider index order', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(
        response([
          { index: 1, embedding: vector.map((n) => (n === 0 ? 0 : -n)) },
          { index: 0, embedding: vector },
        ]),
      );
    const provider: EmbeddingProvider = new OpenAIEmbeddingProvider(
      openaiCfg,
      request,
    );
    expect(await provider.embed('one')).toEqual(vector);
    expect(await provider.embedBatch(['one', 'two'])).toEqual([
      vector,
      vector.map((n) => (n === 0 ? 0 : -n)),
    ]);
    expect(provider.apiCalls).toBe(2);
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({
      model: openaiCfg.model,
      dimensions: 1536,
      input: ['one'],
      encoding_format: 'float',
    });
  });
  it.each([429, 500, 502, 503, 504])(
    'retries transient HTTP %i with backoff',
    async (status) => {
      const request = vi
        .fn()
        .mockResolvedValueOnce(
          new Response('', { status, headers: { 'retry-after': '1' } }),
        )
        .mockResolvedValueOnce(response());
      const pause = vi.fn().mockResolvedValue(undefined);
      await new OpenAIEmbeddingProvider(openaiCfg, request, pause).embed(
        'text',
      );
      expect(request).toHaveBeenCalledTimes(2);
      expect(pause).toHaveBeenCalledWith(1000);
    },
  );
  it.each([401, 403, 400])('does not retry HTTP %i', async (status) => {
    const request = vi.fn().mockResolvedValue(new Response('', { status }));
    await expect(
      new OpenAIEmbeddingProvider(openaiCfg, request).embed('text'),
    ).rejects.toThrow(`HTTP ${status}`);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('bounds network retries and sanitizes errors', async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new TypeError('test-key and private text'));
    const pause = vi.fn().mockResolvedValue(undefined);
    await expect(
      new OpenAIEmbeddingProvider(
        { ...openaiCfg, maxRetries: 2 },
        request,
        pause,
      ).embed('text'),
    ).rejects.toThrow('retries exhausted');
    expect(request).toHaveBeenCalledTimes(3);
  });
  it('retries timeouts', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
      .mockResolvedValueOnce(response());
    await new OpenAIEmbeddingProvider(openaiCfg, request, async () => {}).embed(
      'text',
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('rejects wrong dimensions, nonfinite and zero vectors', () => {
    for (const v of [
      [],
      [1],
      Array(1536).fill(0),
      Array(1536).fill(NaN),
      Array(1536).fill(Infinity),
      Array(1536).fill(1e40),
    ])
      expect(() => validateVector(v, 1536)).toThrow();
    expect(() => validateVector(vector, 1536)).not.toThrow();
  });
  it('rejects mismatched model or duplicate indexes', async () => {
    const wrongModel = new Response(
      JSON.stringify({
        model: 'wrong',
        data: [{ index: 0, embedding: vector }],
      }),
    );
    await expect(
      new OpenAIEmbeddingProvider(
        openaiCfg,
        vi.fn().mockResolvedValue(wrongModel),
      ).embed('text'),
    ).rejects.toThrow();
    await expect(
      new OpenAIEmbeddingProvider(
        openaiCfg,
        vi.fn().mockResolvedValue(
          response([
            { index: 0, embedding: vector },
            { index: 0, embedding: vector },
          ]),
        ),
      ).embedBatch(['a', 'b']),
    ).rejects.toThrow();
  });
  it('constructs batches and validates settings', () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(batches([], 2)).toEqual([]);
    expect(() => batches([1], 0)).toThrow();
    expect(() => embeddingConfig({ EMBEDDING_DIMENSIONS: '3072' })).toThrow(
      'migrate',
    );
    expect(() => embeddingConfig({ EMBEDDING_MODEL: 'unknown' })).toThrow();
    expect(() =>
      embeddingConfig({ EMBEDDING_PROVIDER: 'anthropic' }),
    ).toThrow('Unsupported EMBEDDING_PROVIDER');
    expect(() => embeddingConfig({ EMBEDDING_MAX_RETRIES: '99' })).toThrow();
  });
});
describe('google embedding provider', () => {
  it('is the configured default and is factory-selected accordingly', () => {
    expect(cfg.provider).toBe('google');
    expect(cfg.model).toBe('gemini-embedding-001');
    expect(createEmbeddingProvider(cfg)).toBeInstanceOf(
      GoogleEmbeddingProvider,
    );
    expect(createEmbeddingProvider(openaiCfg)).toBeInstanceOf(
      OpenAIEmbeddingProvider,
    );
  });
  const googleVector = (first: number, second: number) => {
    const norm = Math.sqrt(first * first + second * second);
    return [first / norm, second / norm, ...Array(1534).fill(0)];
  };
  const rawResponse = (values: number[][]) =>
    new Response(JSON.stringify({ embeddings: values.map((v) => ({ v })) }), {
      status: 200,
    });
  const googleResponse = (values: number[][]) =>
    new Response(
      JSON.stringify({ embeddings: values.map((v) => ({ values: v })) }),
      { status: 200 },
    );
  it('normalizes raw vectors and uses asymmetric task types for query vs. document', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(googleResponse([[3, 4, ...Array(1534).fill(0)]]))
      .mockResolvedValueOnce(
        googleResponse([
          [3, 4, ...Array(1534).fill(0)],
          [0, 5, ...Array(1534).fill(0)],
        ]),
      );
    const provider: EmbeddingProvider = new GoogleEmbeddingProvider(
      cfg,
      request,
    );
    expect(await provider.embed('a query')).toEqual(googleVector(3, 4));
    expect(await provider.embedBatch(['doc one', 'doc two'])).toEqual([
      googleVector(3, 4),
      googleVector(0, 5),
    ]);
    expect(provider.apiCalls).toBe(2);
    const queryBody = JSON.parse(request.mock.calls[0][1].body);
    expect(queryBody.requests).toHaveLength(1);
    expect(queryBody.requests[0]).toMatchObject({
      model: `models/${cfg.model}`,
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: 1536,
      content: { parts: [{ text: 'a query' }] },
    });
    const docBody = JSON.parse(request.mock.calls[1][1].body);
    expect(docBody.requests.map((r: { taskType: string }) => r.taskType)).toEqual([
      'RETRIEVAL_DOCUMENT',
      'RETRIEVAL_DOCUMENT',
    ]);
    expect(request.mock.calls[0][1].headers['x-goog-api-key']).toBe(
      'test-key',
    );
    expect(request.mock.calls[0][0]).not.toContain('test-key');
  });
  it.each([429, 500, 502, 503, 504])(
    'retries transient HTTP %i with backoff',
    async (status) => {
      const request = vi
        .fn()
        .mockResolvedValueOnce(
          new Response('', { status, headers: { 'retry-after': '1' } }),
        )
        .mockResolvedValueOnce(googleResponse([[1, 0, ...Array(1534).fill(0)]]));
      const pause = vi.fn().mockResolvedValue(undefined);
      await new GoogleEmbeddingProvider(cfg, request, pause).embed('text');
      expect(request).toHaveBeenCalledTimes(2);
      expect(pause).toHaveBeenCalledWith(1000);
    },
  );
  it.each([401, 403, 400])('does not retry HTTP %i', async (status) => {
    const request = vi.fn().mockResolvedValue(new Response('', { status }));
    await expect(
      new GoogleEmbeddingProvider(cfg, request).embed('text'),
    ).rejects.toThrow(`HTTP ${status}`);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('bounds network retries and sanitizes errors', async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new TypeError('test-key and private text'));
    const pause = vi.fn().mockResolvedValue(undefined);
    await expect(
      new GoogleEmbeddingProvider(
        { ...cfg, maxRetries: 2 },
        request,
        pause,
      ).embed('text'),
    ).rejects.toThrow('retries exhausted');
    expect(request).toHaveBeenCalledTimes(3);
  });
  it('rejects a batch response of the wrong length (no per-item index to reconcile)', async () => {
    await expect(
      new GoogleEmbeddingProvider(
        cfg,
        vi.fn().mockResolvedValue(googleResponse([[1, 0, ...Array(1534).fill(0)]])),
      ).embedBatch(['a', 'b']),
    ).rejects.toThrow();
  });
  it('rejects a wrong-dimension or missing values field', async () => {
    await expect(
      new GoogleEmbeddingProvider(
        cfg,
        vi.fn().mockResolvedValue(rawResponse([[1, 2, 3]])),
      ).embed('text'),
    ).rejects.toThrow();
  });
});
describe('embeddings service and validation (provider-agnostic)', () => {
  it('dry run does not call provider or write', async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'c' }]),
      knowledgeChunk: { count: vi.fn().mockResolvedValue(2) },
      $transaction: vi.fn(),
    };
    const provider = new GoogleEmbeddingProvider(cfg, vi.fn());
    const result = await new EmbeddingsService(
      db as unknown as PrismaClient,
      provider,
      cfg,
    ).build(true);
    expect(result).toMatchObject({
      eligible: 2,
      toEmbed: 1,
      skipped: 1,
      apiCalls: 0,
      dryRun: true,
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(provider.apiCalls).toBe(0);
  });
  it('never includes credentials in validation output or readiness errors', async () => {
    const db = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ total: 0, invalid: 0, stale: 0 }])
        .mockResolvedValueOnce([{ id: 'c' }]),
      knowledgeChunk: { count: vi.fn().mockResolvedValue(1) },
    };
    const result = await validateEmbeddings(db as unknown as PrismaClient, cfg);
    expect(JSON.stringify(result)).not.toContain('test-key');
    expect(result.space).not.toHaveProperty('apiKey');
    db.$queryRaw
      .mockResolvedValueOnce([{ total: 0, invalid: 0, stale: 0 }])
      .mockResolvedValueOnce([{ id: 'c' }]);
    await expect(
      validateEmbeddings(db as unknown as PrismaClient, cfg, true),
    ).rejects.not.toThrow('test-key');
  });
  it('freshness query includes content, version, model, dimension and provider', async () => {
    const query = vi.fn().mockResolvedValue([]);
    await candidates({ $queryRaw: query } as unknown as PrismaClient, cfg);
    const sql = query.mock.calls[0][0];
    expect(sql.sql).toContain('e.content_hash_at_embedding = c.content_hash');
    expect(sql.sql).toContain(
      'e.chunking_version_at_embedding = c.chunking_version',
    );
    expect(sql.values).toEqual(
      expect.arrayContaining([
        cfg.provider,
        cfg.model,
        cfg.version,
        cfg.dimensions,
      ]),
    );
    expect(sql.sql).toContain("c.document_type = 'POLICY'");
  });
});
describe('semantic search', () => {
  it('parameterizes filters instead of interpolating user text', () => {
    const hostile = "x' OR true --";
    const sql = filterSql({
      documentType: 'POLICY',
      policyId: hostile,
      category: hostile,
      policySectionId: 'P:5',
    });
    expect(sql.sql).not.toContain(hostile);
    expect(sql.values).toContain(hostile);
    expect(sql.values).toContain(5);
    expect(() => filterSql({ policySectionId: 'bad' })).toThrow();
  });
  it('maps cosine scores and preserves provenance', () => {
    const row = {
      chunkId: 'C',
      content: 'Evidence',
      distance: 0.25,
      documentType: 'POLICY',
      sourceId: 'P',
      policyId: 'P',
      policySectionOrdinal: 5,
      scenarioId: null,
      sectionHeading: 'Requirements',
      category: 'D',
      chunkIndex: 0,
    };
    expect(mapResult(row)).toEqual({
      ...row,
      policySectionId: 'P:5',
      score: 0.75,
    });
  });
  it('rejects bad search options before spending credits', async () => {
    const provider = {
      space: cfg,
      apiCalls: 0,
      embed: vi.fn(),
      embedBatch: vi.fn(),
    };
    const service = new SemanticSearchService({} as PrismaClient, provider);
    await expect(service.search('query', { topK: 0 })).rejects.toThrow();
    await expect(
      service.search('query', { policySectionId: 'invalid' }),
    ).rejects.toThrow();
    await expect(service.search(' ')).rejects.toThrow();
    expect(provider.embed).not.toHaveBeenCalled();
  });
});
