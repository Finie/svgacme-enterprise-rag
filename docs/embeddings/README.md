# Embeddings and semantic retrieval

`knowledge_chunks → EmbeddingProvider → knowledge_chunk_embeddings → pgvector exact cosine search`.

Only policy chunks are eligible. Scenario chunks, operational records and evaluation answer keys are excluded. No answer-generation model, RAG generator, reranker, agent, chat API or query cache is implemented.

Use Node 24.15.0 (`nvm use`). Configure the values in .env.example in your local .env; never commit credentials. The configured provider is Google gemini-embedding-001, truncated to 1536 dimensions (matching the migrated column) via `outputDimensionality`, content-v1; OpenAI text-embedding-3-small/large remain available via `EMBEDDING_PROVIDER=openai`. The schema migration is required before these commands:

```sh
npm run db:migrate
npm run db:generate
npm run knowledge:validate
npm run embeddings:build -- --dry-run
npm run embeddings:smoke  # explicit, paid real-provider call; never part of tests
npm run embeddings:build
npm run embeddings:build # should report embedded=0, skipped=240, apiCalls=0
npm run embeddings:validate -- --require-complete
npm run search:semantic -- "What are the rules around conflicts of interest?"
npm run evaluate:retrieval -- --dry-run
npm run evaluate:retrieval
npm run search:benchmark
```

The last four real operations require valid embeddings/API credentials. Dry runs and validation never call a provider. An empty embedding table is valid during rollout; `--require-complete` additionally requires nonempty, fully embedded eligible knowledge. Search CLI/evaluation/benchmark use this readiness check before spending query credits.

`npm test` runs mocked unit tests. `npm run test:embeddings:integration` runs rollback-only PostgreSQL fixtures with deterministic fake vectors, no provider calls. Nest's EmbeddingsModule exports the embedding provider, EmbeddingsService and SemanticSearchService, but is not imported into the Hello World AppModule: no new endpoint or database dependency on ordinary app startup.

See [architecture](architecture.md), [provider/configuration](provider.md), [lifecycle](lifecycle.md), [retrieval](retrieval.md) and [evaluation](evaluation.md).

The current [validation report](validation.md) records a full live run against the real Google provider: build, idempotency, retrieval evaluation and benchmark.
