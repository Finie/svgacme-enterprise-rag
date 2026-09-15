CREATE TABLE "knowledge_chunks" (
 "id" TEXT PRIMARY KEY,
 "document_type" TEXT NOT NULL,
 "source_id" TEXT NOT NULL,
 "policy_id" TEXT,
 "policy_section_ordinal" INTEGER,
 "scenario_id" TEXT,
 "chunk_index" INTEGER NOT NULL CHECK (chunk_index >= 0),
 "content" TEXT NOT NULL CHECK (length(btrim(content)) > 0),
 "metadata" JSONB NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
 "content_hash" TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
 "chunking_version" TEXT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "knowledge_chunks_source_check" CHECK (
 (document_type = 'POLICY' AND policy_id IS NOT NULL AND source_id = policy_id AND policy_section_ordinal IS NOT NULL AND scenario_id IS NULL) OR
 (document_type = 'SCENARIO' AND scenario_id IS NOT NULL AND source_id = scenario_id AND policy_id IS NULL AND policy_section_ordinal IS NULL)),
 CONSTRAINT "knowledge_chunks_policy_id_fkey" FOREIGN KEY (policy_id) REFERENCES policies(policy_id) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "knowledge_chunks_policy_id_policy_section_ordinal_fkey" FOREIGN KEY (policy_id, policy_section_ordinal) REFERENCES policy_sections(policy_id, section_ordinal) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "knowledge_chunks_scenario_id_fkey" FOREIGN KEY (scenario_id) REFERENCES scenarios(scenario_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "knowledge_chunks_document_type_source_id_chunk_index_key" ON knowledge_chunks(document_type, source_id, chunk_index);
CREATE INDEX "knowledge_chunks_policy_id_idx" ON knowledge_chunks(policy_id);
CREATE INDEX "knowledge_chunks_policy_id_policy_section_ordinal_idx" ON knowledge_chunks(policy_id, policy_section_ordinal);
CREATE INDEX "knowledge_chunks_scenario_id_idx" ON knowledge_chunks(scenario_id);
CREATE INDEX "knowledge_chunks_content_hash_idx" ON knowledge_chunks(content_hash);
