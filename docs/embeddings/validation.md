# Implementation validation

Validated locally with repository Node 24.15.0 and PostgreSQL/pgvector, using the real Google embedding provider (no data/ files were changed by this phase).

| Check                                       | Result                                             |
| -------------------------------------------- | --------------------------------------------------- |
| npm run build                                | PASS                                                |
| npm test (unit)                              | PASS: 72 unit tests                                 |
| npm run test:e2e (full suite)                | PASS: 21 tests, 4 files                             |
| Embedding PostgreSQL integration             | PASS: 5 tests, fake vectors, rollback-only          |
| npm run db:validate                          | PASS: 0 errors                                      |
| npm run knowledge:validate                   | PASS: 15 policies, 195 sections, 240 chunks         |
| npm run embeddings:smoke (real API)          | PASS: 1536 dimensions confirmed live                |
| npm run embeddings:build (real, to complete) | PASS: 240/240 embedded (see idempotency below)      |
| npm run embeddings:validate --require-complete | PASS: 240 total, 0 invalid, 0 stale, 0 missing    |
| npm run search:semantic (real query)         | PASS: correct policy ranked first                   |
| npm run evaluate:retrieval (real, 20 questions) | PASS: see metrics below                          |
| npm run search:benchmark (real)              | PASS: see latency below                             |

Provider: Google. Model: gemini-embedding-001. Dimensions: 1536 (truncated from native 3072 via `outputDimensionality`, verified live). Metric: cosine (`vector_cosine_ops` semantics via pgvector `<=>`). Version: content-v1.

## Build and idempotency

Dry-run: eligible=240, alreadyEmbedded=0, toEmbed=240, apiCalls=0.

The real build against the live API needed three invocations to complete 240/240, because the Gemini API enforces a per-minute rate/quota limit that the corpus's 8 batches (32 chunks each) exceeded partway through; the bounded retry policy (3 additional attempts, exponential backoff, capped 30s) correctly did not retry indefinitely and instead failed the batch, leaving the rest of the corpus unprocessed for a subsequent run — the designed fail-fast/resume behavior, not a defect:

1. First build: embedded=96, failed=32 (HTTP 429, retries exhausted), unprocessed=112, apiCalls=7.
2. Second build (resumed): alreadyEmbedded=96 correctly skipped; embedded=96 more (192 total), failed=32, unprocessed=16, apiCalls=8.
3. Third build (resumed, after the quota window cleared): alreadyEmbedded=192 correctly skipped; embedded=48, failed=0, apiCalls=2. **240/240 complete.**
4. Fourth build (idempotency check): `{ eligible: 240, alreadyEmbedded: 240, toEmbed: 0, embedded: 0, skipped: 240, failed: 0, apiCalls: 0 }` — a fully unchanged corpus makes zero provider calls, confirming content-hash/model/version freshness checking works as designed.

`embeddings:validate --require-complete` on the completed corpus: `{ total: 240, invalid: 0, stale: 0, eligible: 240, current: 240, missing: 0, validation: "PASS" }`.

## Retrieval evaluation (real embeddings, 20/20 supported questions)

`npm run evaluate:retrieval` selected the same 20-question policy-only subset out of 173 as the dry run, embedded each question once (real API), searched top-10 with no ground-truth filters, and compared against `requiredSources`:

| K  | Recall@K | Precision@K | MRR@K |
| -- | -------- | ------------ | ----- |
| 1  | 0.725    | 0.850        | 0.850 |
| 3  | 0.900    | 0.567        | 0.900 |
| 5  | 0.950    | 0.390        | 0.900 |
| 10 | 0.950    | 0.230        | 0.900 |

The manual smoke query ("What are the rules around conflicts of interest?") ranked a COMP-POL-002 chunk first with score 0.657, ahead of unrelated policies — consistent with the quantitative result.

## Performance baseline (real embeddings, local PostgreSQL, 240 vectors)

| topK | median (ms) | p95 (ms) |
| ---- | ----------- | -------- |
| 1    | 6.02        | 6.93     |
| 3    | 4.78        | 6.18     |
| 5    | 7.23        | 10.02    |
| 10   | 6.11        | 8.10     |

Query embedding (one live API call): ≈996 ms, roughly two orders of magnitude larger than the local exact-scan search. The database is not the retrieval bottleneck at this corpus size; see docs/embeddings/retrieval.md for why no ANN index is justified yet.

## Boundary

Embeddings, pgvector storage and semantic search are implemented and verified against the real Google provider end-to-end. RAG generation, generative LLM calls, reranking, agents and chat API are not implemented.
