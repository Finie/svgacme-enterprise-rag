# Architecture and design decisions

## Stack

- **PostgreSQL 17** via the `pgvector/pgvector:0.8.6-pg17-trixie` image (docker-compose.yml) —
  bundles pgvector 0.8.6 so no separate extension install step is needed.
- **Prisma 7.10.0** (`prisma`, `@prisma/client`), using the driver-adapter / query-compiler
  architecture (no Rust query-engine binary). Configuration lives in `prisma.config.ts`, not in
  the `datasource` block of `schema.prisma` — Prisma 7 removed `url` from schema files; see
  [migration.md](migration.md).
- **`@prisma/adapter-pg` + `pg`**: the Postgres driver adapter Prisma Client and Prisma Migrate
  both use to connect (`scripts/database/lib/client.ts`, `apps/src/database/prisma.service.ts`).

## IDs: natural business keys, no surrogate UUIDs

Every table's primary key is the source's own business ID (`EMP-0001`, `ROLE-CEO`, `DEPT-FIN`,
...), typed `TEXT`. Foreign keys reference these IDs directly — exactly as
[relationships.md](../data-model/relationships.md) specifies. A surrogate UUID primary key was
considered and rejected: nothing in the logical model needs one, every FK in the corpus already
points at the business ID, and the task explicitly prefers simplicity absent a compelling reason
for dual identifiers. Composite/junction tables use composite primary keys
(`(role_id, system_id)`, `(scenario_id, entity_ordinal)`, ...) matching entities.md exactly.

## The departments <-> roles / departments <-> cost_centers cycle

`departments.department_head_role_id -> roles.role_id` and `roles.department_id ->
departments.department_id` form a cycle; so do `departments.cost_center_id ->
cost_centers.cost_center_id` and `cost_centers.department_id -> departments.department_id`. Both
pairs of columns are `NOT NULL` in the logical model (relationships.md marks them non-nullable),
and business-rules.md is explicit that the fix is "staged loading or deferred FK checks, not
nullable business relationships."

We chose **deferred FK checks**: `departments_department_head_role_id_fkey` and
`departments_cost_center_id_fkey` are `DEFERRABLE INITIALLY DEFERRED` (hand-added to the initial
migration — Prisma's schema language has no `DEFERRABLE` attribute). `scripts/database/seed.ts`
loads every table inside **one** `prisma.$transaction(...)`, in FK-safe order (departments
before roles and cost_centers, which is what departments' own FKs point at) — see
[seeding.md](seeding.md#import-order). Postgres only checks a deferred constraint at `COMMIT`,
by which point roles and cost_centers exist, so the transaction commits cleanly. Running the
sub-seed steps as separate top-level transactions would **not** work: the deferred check would
still fire at the end of whichever transaction inserted the department row.

## Employee hierarchy: FK only, no cycle detection

`employees.manager_employee_id` is a nullable self-FK (`ON DELETE RESTRICT`). It guarantees a
manager reference always points at a real employee, and the root employee (`EMP-0001`, the CEO)
has a null manager. It deliberately does **not** try to prevent a multi-row cycle (A manages B
manages A) — that requires a recursive check a plain FK/CHECK constraint cannot express, and the
task explicitly scopes that out of the database layer. `scripts/validate-data-model.ts` already
walks the manager chain and reports cycles; it remains the source of truth for hierarchy
integrity. This is a deliberate boundary, not an oversight.

## role_system_access: the junction is canonical, not `roles.systemAccessProfile[]`

`role_system_access(role_id, system_id, access_profile)` is populated by parsing
`roles[].systemAccessProfile[]` (`"SYS-D365-FIN: Full access - ..."` -> `system_id` +
`access_profile`, via `parseAccess()` in `scripts/validate-data-model.ts`, reused rather than
reimplemented). The junction table — not the JSONB-shaped source array — is what the rest of the
schema and any future application code should query. `roles.responsibilities` stays JSONB
because it's ordered prose with no referential integrity to enforce; `systemAccessProfile` does
have referential integrity (role -> system) and business-rules.md is explicit that it must not
remain the canonical representation.

## Inventory: `quantity_available` is a CHECK constraint, not a generated column

The invariant `quantity_available = quantity_on_hand - quantity_reserved` needs the strongest
safe database-level representation (task requirement). Three options were on the table:

1. **`GENERATED ALWAYS AS (...) STORED` column.** Postgres supports this natively, but Prisma's
   schema language has no declarative syntax for computed columns. It would have to be
   hand-added to the migration SQL (like the deferrable FKs) — except a future `prisma migrate
   dev` diff *would* try to "fix" it back to a plain column, because `schema.prisma` has no way
   to describe "this column is generated," so Prisma's diff engine sees a genuine mismatch. That
   makes every future migration touching `inventory` an active hazard.
2. **Application-derived value only.** Weakest option: nothing stops a future write (a bug, a
   manual `UPDATE`, a different codebase) from writing a mismatched value.
3. **`CHECK (quantity_available = quantity_on_hand - quantity_reserved)`.** Chosen. Same
   guarantee as the generated column — Postgres rejects any row that violates the invariant,
   full stop — without fighting Prisma's migration diffing, because `CHECK` constraints aren't
   modeled in `schema.prisma` either and so are never touched by a future diff (same reasoning
   as the deferrable FKs).

`quantity_available` is seeded from the source value (already invariant-consistent — see
`docs/data-model/business-rules.md`), and `test/database.e2e-spec.ts` proves the constraint
rejects a bad write against a real Postgres instance.

## Exactly-one-target CHECKs (`scenario_entities`, `evaluation_question_sources`)

Both tables have a batch of nullable typed FK columns (`company_id`, `department_id`, ...,
`policy_id`, and `scenario_id` for the evaluation table) where exactly one must be non-null per
row (business-rules.md: "Typed knowledge references use actual nullable FK columns plus an
exactly-one-target CHECK"). This is hand-added SQL (`CASE WHEN x IS NOT NULL THEN 1 ELSE 0 END`
summed across all 13/14 columns, `= 1`) for the same reason as the other hand-authored
constraints: no declarative equivalent in `schema.prisma`.

`scenario_entities` also has two **partial unique indexes** (also hand-authored — Prisma has no
`WHERE` clause on `@@index`) because uniqueness differs by `origin`
(evaluation-model.md): source-array rows (`entities`/`policies`/`systems`) are unique per
`(scenario_id, origin, source_ordinal)`; derived `relationship_endpoint` rows have no
`source_ordinal` and are instead unique per canonical target,
`(scenario_id, source_type, source_id)`.

## Monetary values: `NUMERIC(14,2)`

All KES amounts (`unit_cost`, `selling_price`, `credit_limit`, `approval_limit_kes`,
`lower_bound_kes`, `upper_bound_kes`) are `NUMERIC(14,2)` — exact decimal arithmetic, no
floating-point drift. `NUMERIC(14,2)` supports amounts up to ~10^12, comfortably above anything
in the corpus (the largest is a 10,000,000 approval tier boundary) while keeping 2 decimal
places for cents. Quantities (`reorder_level`, `quantity_on_hand`, `capacity_units`, ...) are
plain `INTEGER` — the source data is always whole units.

## `cost_center_id` vs `cost_center_code`

`data/enterprise/departments.json`'s `costCenterCode` field is misleadingly named: its values
(`CC-EXEC`, `CC-FIN`, ...) are actually `cost_centers.costCenterId` business keys, not
`cost_centers.code` (`CC-100`, `CC-110`, ...) — two different columns on the cost-center entity,
confirmed in `data/master-data/cost-centers.json`. The physical schema follows
docs/data-model/entities.md's correction: `departments.cost_center_id` is the FK column (`FK ->
cost_centers.cost_center_id`), and there is no `cost_center_code` column anywhere.
`cost_centers.code` remains its own, separate business identifier.

## Deletion policy: `RESTRICT` everywhere

Every foreign key is `ON DELETE RESTRICT` (business-rules.md: "Restrict deletion of referenced
business records; later lifecycle policy must explicitly authorize cascading deletion of
dependent snapshot rows"). Nothing cascades. A future lifecycle policy can revisit this per
table when there's an actual deletion workflow to design around.

## pgvector

The initial migration enables pgvector. The embedding migration adds knowledge_chunk_embeddings with vector(1536), provider/model/version metadata and content freshness tracking. It uses exact cosine search; no ANN index exists at the current corpus size. See [embedding architecture](../embeddings/architecture.md) for the current design. Operational tables do not acquire vectors.

Derived knowledge chunks and embeddings use cascading source deletion; operational foreign keys retain the original RESTRICT policy. Knowledge logical-position uniqueness is deferred during rebuilds to preserve embedding children across reordering.

## NestJS boundary

`apps/src/database/` has exactly two files: `prisma.service.ts` (a thin `OnModuleInit` /
`OnModuleDestroy` wrapper connecting/disconnecting the driver-adapter Prisma client) and
`database.module.ts` (a `@Global()` Nest module exporting it). Neither contains query logic
beyond what Prisma generates, retrieval, RAG, or agent code — this is strictly a connection
boundary for a future feature module to build on.

`DatabaseModule` is **not** imported into `AppModule` yet. Importing it would make `PrismaService`
connect to Postgres on every app boot, which would break `npm run build` / `npm test` /
`test/app.e2e-spec.ts` for anyone without Postgres running — and the "Hello World" app has
nothing to query yet. A future feature module imports `DatabaseModule` when it actually needs
the database.
