# SVGA Enterprise logical data model

This blueprint models the current generated corpus for a later PostgreSQL implementation. It introduces **28 logical entities**, with **2 additional future-only projections** (documents and document_chunks). It installs no database, ORM, migrations, embeddings, chunking, retrieval, agents or chat APIs.

Start with [entities](entities.md), [ER diagrams](er-diagram.md), [relationships](relationships.md) and [source mapping](source-mapping.md). [Business rules](business-rules.md) documents approval semantics, database constraints and source interpretation issues. [Knowledge model](knowledge-model.md) defines policy structure and future semantic boundaries; [evaluation model](evaluation-model.md) preserves scenarios, graph structure and question provenance.

## Boundaries and evidence

- Enterprise core: companies, departments, roles, employees, locations, systems, role_system_access (7).
- Master data: cost_centers, warehouses, suppliers, products, product_suppliers, customers, inventory (7).
- Explicit business authority: approval_policy_sets, approval_tiers, role_approval_authorities (3).
- Production knowledge: policies, policy_sections, policy_relationships, policy_systems (4).
- Synthetic/evaluation: scenarios, scenario_actors, scenario_entities, scenario_events, scenario_relationships, evaluation_questions, evaluation_question_sources (7).

Sources inspected: all files in data/enterprise, data/master-data, data/policies, data/scenarios and data/test-questions, plus all six generator/consistency scripts. Snapshot counts: 1 company, 13 departments, 22 roles, 39 employees, 5 locations, 7 systems; 13 cost centers, 4 warehouses, 16 suppliers, 36 products, 20 customers, 141 inventory balances; 15 policies, 65 scenarios, 173 questions. Index/category files are projections, not extra domain records.

Employee.departmentId remains authoritative even when the employee's role belongs to another department. Supplier/product membership becomes one junction. Role limits and policy tiers retain distinct authority and null semantics. Structured records remain relational; policy sections prepare for precise citations without building retrieval. Evaluation answers stay isolated from production knowledge.

## Validation stage

Choose **B: a separate validation stage**. validate-consistency.ts remains intact; it checks the original enterprise/policy consistency and writes its existing report. validate-data-model.ts adds read-only model-contract checks across scenarios and evaluation data as well. It can be imported by Vitest without running its CLI and returns structured issue groups. It never regenerates or writes data.

```sh
npm run validate:data-model
npm run validate:data       # existing consistency stage, then model stage
npm run build
npm test
```

The existing generation pipeline is unchanged: it runs consistency before generating scenarios/questions. The combined validate:data command belongs after full generation; inserting model validation earlier would inspect stale or missing downstream files. No generator is imported for tests because generator modules have write side effects.

Tests load the actual corpus and invoke the same validator. Additional negative cases mutate in-memory clones of real records to demonstrate failures without editing source files. Validation checks reference existence, manager cycles, uniqueness, reciprocal product/supplier relationships, inventory arithmetic, policy metadata/references, ordered scenario events, actor snapshots, evaluation source resolution, category copies and lossless authority/access representation. It does not claim to verify every prose assertion or implement operational approval decisions. Known semantic ambiguities are documented in business-rules rather than hidden as data repairs.
