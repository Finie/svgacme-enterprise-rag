# Indexing

## What's automatic

Every `@id` / `@@id` and `@unique` / `@@unique` in `schema.prisma` gets a Postgres index for
free (the primary-key / unique-constraint's backing btree). That covers every business
identifier the task calls out: `employee_number`, `email`, `sku`, `supplier_code`,
`customer_code`, cost-center `code`, warehouse `code`, `registration_number`, `kra_pin`,
department `name`, system `name`, and the evaluation `question` text — no separate index needed
for any of them.

One thing that is **not** automatic: Prisma does not add an index to a plain scalar foreign-key
column just because it's used in a `@relation`. (Confirmed empirically against the generated
migration SQL before adding explicit indexes — every FK-only column below produced zero
`CREATE INDEX` output until added as `@@index`.) Postgres itself doesn't index FK columns either
— only the referenced (parent) side gets an index automatically, via its own primary key.

## What's explicit, and why

Every index below is a plain scalar or composite btree on a foreign key that the task's
indexing list calls out as a real access pattern (looking up an employee's role, a department's
cost centers, an inventory row's warehouse, etc.):

| Table | Column(s) | Access pattern |
| --- | --- | --- |
| `departments` | `department_head_role_id` | "who heads this role" |
| `roles` | `department_id` | roles in a department |
| `employees` | `role_id`, `department_id`, `manager_employee_id`, `location_id` | org lookups, direct reports |
| `systems` | `owning_department_id` | systems owned by a department |
| `cost_centers` | `department_id`, `manager_employee_id`, `location_id` | cost centers by department/manager/site |
| `warehouses` | `location_id`, `manager_employee_id` | warehouses by site/manager |
| `suppliers` | `relationship_owner_employee_id` | suppliers by relationship owner |
| `customers` | `account_manager_employee_id` | customers by account manager |
| `inventory` | `warehouse_id` | stock by warehouse (`product_id` is already the leftmost column of `UNIQUE(product_id, warehouse_id)`, so a separate index would be redundant) |
| `scenario_actors` | `employee_id` | scenarios an employee appears in |
| `scenario_entities` | `(source_type, source_id)` (composite) | "find the graph node for entity X" — also serves lookups by `source_type` alone (leftmost-prefix) |

`departments.cost_center_id` is not in this list because it's already `@unique` (its own index).

## Composite-key leftmost-prefix coverage (no extra index needed)

A composite primary key already indexes lookups on its leftmost column(s), so these are
deliberately **not** duplicated with a separate single-column index:

- `policy_sections` PK `(policy_id, section_ordinal)` covers "sections for policy X".
- `evaluation_question_sources` PK `(question_id, reference_kind, source_ordinal)` covers "source
  rows for question X" (the task's `evaluation_question_sources.question_id` requirement).
- `role_system_access` PK `(role_id, system_id)` covers "systems a role can access"; a reverse
  index on `system_id` alone (for "roles with access to system X") was considered and skipped —
  not in the task's list, and `role_system_access` has at most 22 roles x a handful of systems
  each, so a sequential scan is fine.
- `product_suppliers` PK `(product_id, supplier_id)` covers "suppliers for product X"; a reverse
  index on `supplier_id` alone ("products from supplier X") was likewise considered and skipped
  for the same reason (16 suppliers, 36 products — this table will never be large enough to
  matter, and it isn't in the task's explicit list).

## Deliberately not indexed

`quantity_reserved`, `status` columns, JSONB columns (`responsibilities`, `tags`,
`business_processes`, ...), and every other column not named above have no index. None of them
appear in the task's access-pattern list, and adding one per column would trade write cost and
storage for a lookup pattern nothing in this phase actually performs — the task is explicit:
"Do not create indexes on every column."
