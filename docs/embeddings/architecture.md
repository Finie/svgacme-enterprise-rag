# Architecture

KnowledgeChunk has a 1:N relation to KnowledgeChunkEmbedding. The natural key is (chunk_id, embedding_provider, embedding_model, embedding_version). Distinct model/version spaces can coexist at 1536 dimensions. Each row records dimension, vector, embedded timestamp, content hash and chunking version at embedding. It keeps one current content snapshot per key, not an unlimited audit log of past content.

The vector column is `vector(1536)`, not a guessed runtime width. SQL CHECKs enforce metadata dimension, actual dimension and nonzero vector norm. pgvector rejects nonfinite components. Application validation checks length, float32 representability, finite numeric values and nonzero norm before writing. Foreign keys prevent orphans and cascade only when the source chunk is removed. The primary key prevents duplicate active rows.

Prisma models vector using `Unsupported("vector(1536)")`; vector reads/writes use parameterized Prisma SQL in embedding-store.ts and semantic-search.service.ts. Vector literals are serialized only after validation and passed as bound values, never interpolated SQL. Ordinary Prisma models handle metadata and source relationships.

Eligibility is explicitly `document_type = 'POLICY' AND policy_id IS NOT NULL AND policy_section_ordinal IS NOT NULL AND scenario_id IS NULL`. The same rule applies to generation, writes, validation and search. Enabling scenarios in the knowledge builder does not enable scenario embeddings. Adding another source type is a reviewed code change, not an automatic fallback. Structured enterprise tables remain relational.

No HNSW/IVFFlat index is created for 240 vectors. A B-tree indexes provider/model/version/dimension; existing chunk indexes handle policy/section filters. Exact cosine search is the correctness baseline. See retrieval.md before introducing approximate indexing.
