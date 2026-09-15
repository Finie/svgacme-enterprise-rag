# Scenarios and evaluation

Scenarios are synthetic situations grounded in real corpus entities, not production transactions. Evaluation questions and their answer keys are a separate evaluation namespace. This keeps synthetic events from being mistaken for enterprise history and avoids answer leakage into retrieval.

## Scenario source structure

scenarios stores id → scenario_id; category, title, description, businessContext → business_context, expectedOutcome → expected_outcome, difficulty. questionTypes, tags, relevantFacts and requiredReasoning remain ordered JSONB arrays, mapped to snake_case columns. Preserve every narrative, including known interpretation discrepancies.

actors[] → scenario_actors: source ordinal, employeeId → employee_id, roleId → role_id, departmentId → department_id, name and role → name and role_title. All three FK targets must exist; role/department reflect the employee record, not the role's department. Snapshot names remain text.

entities[] → scenario_entities: ordinal, type → source_type, id → source_id, name. Represent reference integrity with typed nullable FK columns for company, department, role, employee, location, system, cost_center, warehouse, supplier, product, customer, inventory and policy. Exactly one target is non-null; source_type chooses it (`costCenter` aliases cost_center). This finite set is not an EAV entity registry.

Also project policies[] and systems[] into scenario_entities with origin `policies` or `systems`, source_ordinal and original source_id/name; system source strings are names and resolve to system_id. Original entities use origin `entities`. Distinct membership rows preserve overlapping arrays without making them independent domain relationships. PK remains (scenario_id, entity_ordinal); UNIQUE(scenario_id, origin, source_ordinal), except derived nodes which use a unique canonical target. Assign ordinals deterministically: original entities, policy memberships, system memberships, then otherwise-missing graph endpoints. Origin `relationship_endpoint` distinguishes derived nodes from source array entries.

Relationships preserve from/type/to and order in scenario_relationships. Both endpoints use composite FKs into scenario_entities within the same scenario. Choose the original entity row first, then a membership row; synthesize a reference-only endpoint node if necessary. SCN-SUP-005 → DEPT-PROC is the observed case. Endpoint type is resolved from canonical IDs and must be unambiguous. Do not assume every endpoint appeared in the source entities array.

events[] → scenario_events(sequence, event). Sequence is the ordering authority, positive and contiguous in current source. A scenario can have multiple edges between the same nodes with different types; do not impose uniqueness on endpoint pair alone.

This preserves graph reasoning, multi-hop evaluation, agent testing and future synthetic conversation use without implementing agents or retrieval.

## Question source structure

evaluation_questions maps id → question_id; prefix, question, category, subcategory, difficulty, answerability, expectedAnswer → expected_answer, expectedBehavior → expected_behavior. acceptableAnswerPoints, reasoningSteps and tags become ordered JSONB acceptable_answer_points, reasoning_steps and tags. Prefix is generator metadata but retained. Allowed behaviors: answer, abstain, reject, escalate; answerability is answerable or unanswerable.

requiredSources[] becomes evaluation_question_sources with reference_kind `required`, 1-based source_ordinal, type, source_id and optional section text. Use the same 13 typed FK alternatives as scenario_entities plus scenario_id (14 total). Preserve `cost-center` as the original type spelling. Exactly one typed target FK is required; unknown types fail validation.

entities[], systems[], policies[] and scenarios[] also become reference rows, with reference_kind equal to the array name and their original order/value. Systems contains both SYS IDs and names: resolve ID first, then exact canonical name; preserve the original value in source_id. These rows are metadata associations, not automatically required answer evidence. Type and target IDs are resolved without inventing missing entities.

Section locator handling:

| Source locator (policy target) | Meaning / exact FK                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Procedures and Requirements    | Exact case-insensitive heading match to numbered §5; optional composite policy-section FK can be populated. |
| Approval Authority             | Semantic label; §5 contains the matrix, §6 general authority. Preserve text, no unreviewed exact FK.        |
| Scenario business context      | Policy cited by a scenario; no literal policy heading. Preserve text, section FK null.                      |

The last two remain valid policy-level references. Section resolution must never silently choose a similarly named heading. Source ordinal keys preserve repeated citations without requiring distinct targets.

questions.json is canonical (173 questions); categories/*.json are materialized duplicate subsets, never additional questions. index.json files are derived manifests/counts, not domain entities. Scenario index similarly describes the 65 individual scenario files. Preserve manifest metadata for audit at file level, not as business rows.
