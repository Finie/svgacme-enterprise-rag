# Seeding

## Structure

```text
scripts/database/
├── lib/
│   ├── client.ts          createPrismaClient() — the driver-adapter Prisma client
│   └── paths.ts           readJson/readPolicyFiles/readScenarioFiles — read data/ as-is
├── seed-enterprise.ts      locations, companies, departments, roles, employees, systems, role_system_access
├── seed-master-data.ts     cost_centers, warehouses, suppliers, products, product_suppliers, customers, inventory
├── seed-policies.ts        policies, policy_sections, policy_relationships, policy_systems,
│                           approval_policy_sets, approval_tiers, role_approval_authorities
├── seed-scenarios.ts       scenarios, scenario_actors, scenario_entities, scenario_events, scenario_relationships
├── seed-evaluation.ts      evaluation_questions, evaluation_question_sources
├── seed.ts                 orchestrator — runs all of the above in one transaction; CLI entry point
└── validate-database.ts    read-only: database vs. data/ verification (npm run db:validate)
```

Every seed module reads straight from `data/` (via `scripts/database/lib/paths.ts`) and writes
rows shaped exactly like `docs/data-model/entities.md` describes — nothing is hand-transcribed
from the corpus into a script. `data/` is never written to.

`role_approval_authorities` is derived from `roles.json` (not policy markdown) but lives in
`seed-policies.ts`, grouped with the rest of the approval-authority model
(`approval_policy_sets`, `approval_tiers`) per `docs/data-model/entities.md`'s "Business rules"
grouping, rather than with `seed-enterprise.ts`.

## Import order

```text
 1. locations                       12. approval_policy_sets
 2. companies                       13. approval_tiers
 3. departments                     14. role_approval_authorities
 4. roles                           15. scenarios
 5. employees                       16. scenario_actors
 6. systems                         17. scenario_entities
 7. role_system_access              18. scenario_events
 8. cost_centers, warehouses,       19. scenario_relationships
    suppliers, products             20. evaluation_questions
 9. product_suppliers               21. evaluation_question_sources
10. customers
11. inventory
    policies, policy_sections,
    policy_relationships,
    policy_systems (before 12)
```

This differs from the task's suggested order in one place: **policies (and their sections /
relationships / systems) are seeded before `approval_policy_sets`/`approval_tiers`**, not after.
`approval_policy_sets.policy_id` is a real (non-deferred) foreign key into `policies`, so
`policies` must exist first — the suggested order had `approval_policy_sets` (step 15) before
`policies` (step 18), which cannot work as a plain FK. `role_approval_authorities` stays grouped
with the approval-authority tables even though it only depends on `roles` (available much
earlier) — no functional reason to split it out, and it belongs with that narrative.

The departments <-> roles and departments <-> cost_centers cycles are handled by deferred FK
constraints, not by reordering — see
[architecture.md](architecture.md#the-departments---roles--departments---cost_centers-cycle).
Every table above is seeded inside **one** `prisma.$transaction(...)` (`seed.ts`) so those
deferred checks resolve correctly at commit.

## Idempotency

Every write is `tx.<model>.upsert(...)`, keyed by the row's natural primary key (a business ID,
or a composite ordinal key for junction/child tables — e.g. `{ scenarioId, entityOrdinal }`).
Running `npm run db:seed` twice reproduces the same rows; it does not duplicate anything. This is
covered by an integration test (`test/database.e2e-spec.ts`, "is idempotent") that seeds twice
against a real database and asserts row counts are unchanged.

## Notable parsing logic

- **`role_system_access`**: `roles[].systemAccessProfile[]` strings ("`SYS-D365-FIN: Full access
  - ...`") are split on the first `": "` via `parseAccess()`, imported from
  `scripts/validate-data-model.ts` rather than reimplemented.
- **`departments.cost_center_id`**: read from the source's misleadingly-named `costCenterCode`
  field — see architecture.md.
- **FIN-POL-002's approval matrix** (`approval_tiers`): `seed-policies.ts` parses the actual
  prose in §5 item 2 ("up to and including KES 50,000, Department Manager; KES 50,001 to
  500,000, ...") with a regex, rather than hard-coding the five bands as literals disconnected
  from the source file — see `parseApprovalMatrix()`. The parser is deliberately specific to
  this one policy (it's the only approval matrix in the corpus; business-rules.md ties the whole
  approval model to "FIN-POL-002 §5.2" by name, not a generic rules-table format).
- **`policy_relationships`**: only §12 "RELATED POLICIES" bullet items become edges; any other
  policy-ID-shaped substring elsewhere in a document's body is not a relationship (matches
  `docs/data-model/knowledge-model.md`).
- **`scenario_entities` ordinal assignment**: for each scenario, rows are built in the documented
  order — `entities[]` (origin `entities`), then `policies[]` (origin `policies`), then
  `systems[]` (origin `systems`, names resolved to `system_id`) — then, for every
  `relationships[].from`/`.to` endpoint not already covered by one of those rows, a derived
  `relationship_endpoint` node is created (origin `relationship_endpoint`, `source_ordinal`
  null), resolving its type by checking membership across every enterprise/master/policy
  collection (mirroring `validate-data-model.ts`'s `globalRef`). `SCN-SUP-005` -> `DEPT-PROC` is
  the one case in the current corpus that exercises this path (see `business-rules.md` §5).
- **`evaluation_question_sources` type vocabulary**: `requiredSources[].type` uses `cost-center`
  (hyphenated); derived rows built from `entities[]`/`systems[]`/`policies[]`/`scenarios[]` reuse
  that exact vocabulary for consistency, rather than mixing in a second spelling convention.
  `policy_section_ordinal` is populated only when `section === 'Procedures and Requirements'`
  (an exact, case-insensitive heading match) — "Approval Authority" and "Scenario business
  context" are semantic locators preserved as text with no section FK, per
  `docs/data-model/evaluation-model.md`'s locator table.

## What is intentionally not re-ingested

- `data/test-questions/categories/*.json` — materialized duplicate subsets of `questions.json`,
  not additional questions.
- `data/test-questions/index.json`, `data/scenarios/index.json` — derived manifests, not domain
  rows.

## Running

```sh
npm run db:seed        # safe to run repeatedly
npm run db:validate    # compares the database back against data/
```
