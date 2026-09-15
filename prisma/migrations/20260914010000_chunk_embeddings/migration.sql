CREATE TABLE knowledge_chunk_embeddings (
 chunk_id TEXT NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE ON UPDATE CASCADE,
 embedding_provider TEXT NOT NULL CHECK (length(btrim(embedding_provider)) > 0),
 embedding_model TEXT NOT NULL CHECK (length(btrim(embedding_model)) > 0),
 embedding_version TEXT NOT NULL CHECK (length(btrim(embedding_version)) > 0),
 embedding_dimensions INTEGER NOT NULL CHECK (embedding_dimensions = 1536),
 embedding vector(1536) NOT NULL,
 embedded_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 content_hash_at_embedding TEXT NOT NULL CHECK (content_hash_at_embedding ~ '^[0-9a-f]{64}$'),
 chunking_version_at_embedding TEXT NOT NULL CHECK (length(btrim(chunking_version_at_embedding)) > 0),
 CONSTRAINT knowledge_chunk_embeddings_pkey PRIMARY KEY (chunk_id, embedding_provider, embedding_model, embedding_version),
 CONSTRAINT knowledge_embeddings_vector_check CHECK (vector_dims(embedding) = embedding_dimensions AND vector_norm(embedding) > 0)
);
CREATE INDEX knowledge_embeddings_space_idx ON knowledge_chunk_embeddings(embedding_provider, embedding_model, embedding_version, embedding_dimensions);
DROP INDEX knowledge_chunks_document_type_source_id_chunk_index_key;
ALTER TABLE knowledge_chunks ADD CONSTRAINT knowledge_chunks_document_type_source_id_chunk_index_key UNIQUE (document_type, source_id, chunk_index) DEFERRABLE INITIALLY IMMEDIATE;
