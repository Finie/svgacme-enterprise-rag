# Retrieval and performance

SemanticSearchService.search(query, options) embeds a nonempty query with the configured provider/model/version/dimensions, executes SQL and returns ranked evidence. Options: topK (default 5, 1–100), documentType, policyId, policySectionId (`<policy_id>:<ordinal>`) and category. All filters are parameterized SQL predicates applied before ranking/limit. Category is the policy department ID inherited from knowledge metadata. Scenario requests return no rows while scenario eligibility is disabled.

Results contain chunkId, content, distance, score, documentType, sourceId, policyId, policySectionId, policySectionOrdinal, scenarioId, sectionHeading, category and chunkIndex. A policy result resolves directly through the chunk's composite FK to policy_sections and its policy. No vector is exposed. `score = 1 - cosine_distance`; higher scores rank first, with chunk ID as a deterministic tie-breaker. Scores are similarity measurements, not calibrated confidence or answer quality.

Cosine distance uses pgvector `<=>`. Cosine itself handles nonunit vectors, so storage does not renormalize or alter what the provider adapter returns. Zero/nonfinite vectors are rejected. Query and stored vectors must belong to the exact same space and match current content/hash version.

OpenAI's embeddings are natively unit-normalized. Google's `gemini-embedding-001` is only pre-normalized at its default 3072-dimension output; at the truncated 1536 dimensions used here, a live response measured L2 norm ≈ 0.69. The Google adapter normalizes to unit length before returning, so both configured providers produce unit vectors in practice — a defensive consistency choice, not a requirement of cosine ranking itself.

At 240 vectors, use an exact scan. HNSW adds memory/write cost and approximation; IVFFlat needs trained lists and tuning. Neither is justified yet. When measurements justify HNSW, use `vector_cosine_ops`, retain the direct distance ORDER BY, evaluate filtered recall, and consider a per-space partial index. pgvector explains exact and approximate search, operator classes and filter tradeoffs in its [official README](https://github.com/pgvector/pgvector). No ANN index exists now.

## Baseline procedure

`npm run search:benchmark` requires the configured corpus to be fully embedded. It embeds one fixed conflict-of-interest query, records that API latency separately, warms each topK and times 20 exact SQL searches for K=1,3,5,10. Output includes median and p95 application-to-local-database latency (SQL execution, transport, deserialization and mapping), space, corpus count and measurement timestamp. Reusing this one vector within a benchmark is not a production query cache. No Redis or query caching is installed.

## Measured baseline (real Google provider, 240/240 embedded, local PostgreSQL)

Measured 2026-09-14 against `gemini-embedding-001` at 1536 dimensions:

| topK | median (ms) | p95 (ms) |
| ---- | ----------- | -------- |
| 1    | 6.02        | 6.93     |
| 3    | 4.78        | 6.18     |
| 5    | 7.23        | 10.02    |
| 10   | 6.11        | 8.10     |

Query embedding (one live Gemini API call): ≈996 ms — network/provider-bound and roughly two orders of magnitude larger than the exact-scan database search itself. At 240 vectors the database is not the bottleneck; the round trip to the embedding provider dominates end-to-end query latency. This is expected at this corpus size and is the reason no ANN index is justified yet (see architecture.md) — an HNSW/IVFFlat index would shave single-digit milliseconds off a step that is already ~1000x faster than the network call it follows.
