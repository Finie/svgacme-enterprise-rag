# Chunk metadata

Typed columns are the filtering authority: document_type, source_id, policy_id, policy_section_ordinal, scenario_id, chunk_index, content_hash and chunking_version. Indexes cover document_type/source/order (unique), policy, composite section, scenario and hash. No embedding column or vector index exists.

JSONB mirrors document_type, source_id, policy_id, scenario_id and chunk_index, and contains document_id, title, category, section_heading, section_number, section_key, local_chunk_index, normalized start_offset/end_offset and chunk_size/chunk_overlap. policy_section_id is the display locator `<policy_id>:<ordinal>`, backed by the composite FK columns rather than an invented source entity. Inapplicable values are JSON null/SQL NULL.

Policies use the source department_id as category (there is no policy category column), with explicit department_id, classification, status and policy_version. Scenarios preserve category, difficulty and synthetic=true. Metadata contains no full source bodies or answer keys. JSON mirrors are verified against regenerated source projections by knowledge:validate; database constraints enforce typed source integrity, not all JSON mirrors.
