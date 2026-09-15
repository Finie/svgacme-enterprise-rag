# Provenance and integrity

POLICY chunk → policies(policy_id) and policy_sections(policy_id, section_ordinal). The composite FK guarantees that the section belongs to that policy. SCENARIO chunk → scenarios(scenario_id); section_key identifies context, description, events or facts. Event sequence is retained in the event block text. document_id/type/source_entity_id in the logical abstraction preserve original identity explicitly.

The database CHECK requires exactly one compatible source shape and source_id equality to the typed ID. Foreign keys prohibit orphans; source deletion cascades to derived knowledge only. A chunk can always resolve its evidence without parsing its text. The source database remains traceable through the existing seed/import mapping to immutable data/ files. Offset metadata and source headings make section-level audit possible despite whitespace normalization and overlap.

Future generated answers need evidence citations; explicit identity avoids attributing synthetic scenarios to real transactions or confusing two similarly worded sections. Evaluation answer keys are not evidence: retrieving them would contaminate evaluation. See corpus.md for the additional held-out scenario boundary.
