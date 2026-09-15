# Enterprise knowledge ingestion

The pipeline is `data/ → database seed → PostgreSQL → knowledge builder → knowledge_chunks`. The builder never reads or modifies data/. Pure TypeScript document/chunk functions live in scripts/knowledge; no Nest module or retrieval endpoint is needed yet.

Run `npm run db:migrate` and `npm run db:generate`, then `npm run knowledge:build` and `npm run knowledge:validate`. Both commands load .env and use the same CHUNK_SIZE, CHUNK_OVERLAP and KNOWLEDGE_SCENARIO_IDS configuration. Defaults are 1600 characters, 200 characters maximum overlap and no selected scenarios. To opt in a reviewed synthetic narrative, set `KNOWLEDGE_SCENARIO_IDS=SCN-COMP-001` for both commands. Unknown IDs fail the build; removing an ID removes its derived chunks on the next build.

Validation is read-only: regenerate expected chunks from a consistent database snapshot, compare every content/hash/metadata/source/ordering/version field, reject missing/stale/duplicate chunks, verify deterministic generation and reconstruct section coverage using normalized offsets. Run the builder twice: the second run must report written=0, removed=0; unchanged rows retain both timestamps. Existing `npm run db:validate` independently checks operational data against the immutable corpus.

See [corpus](corpus.md), [chunking](chunking.md), [metadata](metadata.md), [provenance](provenance.md), and the [logical model](../data-model/knowledge-model.md).

The downstream [embedding and semantic retrieval layer](../embeddings/README.md) now consumes policy chunks. RAG generation, LLM answer generation, reranking, agents and chat endpoints remain unimplemented.
