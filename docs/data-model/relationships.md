# Relationship catalog

Current FK edges: **70** = **2 optional 1:1** and **68 1:N**. Counts include every typed-target FK separately, both ends of junctions, and the optional evaluation section FK; future documents/chunks are excluded. These are schema relationships, not counts of data rows.

There are **4 dedicated N:M associations**: Role↔System, Product↔Supplier, Policy↔Policy, and Policy↔System. Inventory additionally realizes Product↔Warehouse with balance attributes (a fifth binary N:M association). Typed scenario/evaluation membership tables additionally permit many-to-many membership with each supported target type; those alternatives are counted as FK edges above, not additional dedicated junction entities. There are **3 conceptual self-referencing relationships**: employee management, related policies, and scenario graph nodes linked through scenario_relationships. These categories overlap; do not sum them.

Every FK child references exactly one parent when non-null. Parent participation is 0..N unless listed 0..1; sample membership counts do not imply mandatory children. Thus roles → authorities is 1:0..1: an authority row must have one role, a role may have none. Typed target columns are individually optional but exactly one target per reference row is mandatory. The separate section FK is supplementary, not part of the exactly-one check.

## Core enterprise

| Parent → child               | Child FK                   | Cardinality       | Child FK nullable? |
| ---------------------------- | -------------------------- | ----------------- | ------------------ |
| locations → companies        | `headquarters_location_id` | 1:N (parent 0..N) | No                 |
| roles → departments          | `department_head_role_id`  | 1:N (parent 0..N) | No                 |
| cost_centers → departments   | `cost_center_id`           | 1:1 (parent 0..1) | No                 |
| departments → roles          | `department_id`            | 1:N (parent 0..N) | No                 |
| roles → employees            | `role_id`                  | 1:N (parent 0..N) | No                 |
| departments → employees      | `department_id`            | 1:N (parent 0..N) | No                 |
| employees → employees        | `manager_employee_id`      | 1:N (parent 0..N) | Yes                |
| locations → employees        | `location_id`              | 1:N (parent 0..N) | No                 |
| departments → systems        | `owning_department_id`     | 1:N (parent 0..N) | No                 |
| roles → role_system_access   | `role_id`                  | 1:N (parent 0..N) | No                 |
| systems → role_system_access | `system_id`                | 1:N (parent 0..N) | No                 |

## Master data

| Parent → child                | Child FK                         | Cardinality       | Child FK nullable? |
| ----------------------------- | -------------------------------- | ----------------- | ------------------ |
| departments → cost_centers    | `department_id`                  | 1:N (parent 0..N) | No                 |
| employees → cost_centers      | `manager_employee_id`            | 1:N (parent 0..N) | No                 |
| locations → cost_centers      | `location_id`                    | 1:N (parent 0..N) | No                 |
| locations → warehouses        | `location_id`                    | 1:N (parent 0..N) | No                 |
| employees → warehouses        | `manager_employee_id`            | 1:N (parent 0..N) | No                 |
| employees → suppliers         | `relationship_owner_employee_id` | 1:N (parent 0..N) | No                 |
| employees → customers         | `account_manager_employee_id`    | 1:N (parent 0..N) | No                 |
| products → product_suppliers  | `product_id`                     | 1:N (parent 0..N) | No                 |
| suppliers → product_suppliers | `supplier_id`                    | 1:N (parent 0..N) | No                 |
| products → inventory          | `product_id`                     | 1:N (parent 0..N) | No                 |
| warehouses → inventory        | `warehouse_id`                   | 1:N (parent 0..N) | No                 |

## Business rules

| Parent → child                        | Child FK                 | Cardinality       | Child FK nullable? |
| ------------------------------------- | ------------------------ | ----------------- | ------------------ |
| policies → approval_policy_sets       | `policy_id`              | 1:N (parent 0..N) | No                 |
| approval_policy_sets → approval_tiers | `approval_policy_set_id` | 1:N (parent 0..N) | No                 |
| roles → role_approval_authorities     | `role_id`                | 1:1 (parent 0..1) | No                 |

## Knowledge

| Parent → child                  | Child FK            | Cardinality       | Child FK nullable? |
| ------------------------------- | ------------------- | ----------------- | ------------------ |
| roles → policies                | `owner_role_id`     | 1:N (parent 0..N) | No                 |
| departments → policies          | `department_id`     | 1:N (parent 0..N) | No                 |
| policies → policy_sections      | `policy_id`         | 1:N (parent 0..N) | No                 |
| policies → policy_relationships | `policy_id`         | 1:N (parent 0..N) | No                 |
| policies → policy_relationships | `related_policy_id` | 1:N (parent 0..N) | No                 |
| policies → policy_systems       | `policy_id`         | 1:N (parent 0..N) | No                 |
| systems → policy_systems        | `system_id`         | 1:N (parent 0..N) | No                 |

## Scenarios and evaluation

| Parent → child                                     | Child FK                             | Cardinality       | Child FK nullable? |
| -------------------------------------------------- | ------------------------------------ | ----------------- | ------------------ |
| scenarios → scenario_actors                        | `scenario_id`                        | 1:N (parent 0..N) | No                 |
| scenarios → scenario_entities                      | `scenario_id`                        | 1:N (parent 0..N) | No                 |
| scenarios → scenario_events                        | `scenario_id`                        | 1:N (parent 0..N) | No                 |
| scenarios → scenario_relationships                 | `scenario_id`                        | 1:N (parent 0..N) | No                 |
| employees → scenario_actors                        | `employee_id`                        | 1:N (parent 0..N) | No                 |
| roles → scenario_actors                            | `role_id`                            | 1:N (parent 0..N) | No                 |
| departments → scenario_actors                      | `department_id`                      | 1:N (parent 0..N) | No                 |
| scenario_entities → scenario_relationships         | `(scenario_id, from_entity_ordinal)` | 1:N (parent 0..N) | No                 |
| scenario_entities → scenario_relationships         | `(scenario_id, to_entity_ordinal)`   | 1:N (parent 0..N) | No                 |
| evaluation_questions → evaluation_question_sources | `question_id`                        | 1:N (parent 0..N) | No                 |
| policy_sections → evaluation_question_sources      | `(policy_id, section_ordinal)`       | 1:N (parent 0..N) | Yes                |

## Typed reference alternatives

| Parent → child                             | Child FK         | Cardinality       | Child FK nullable? |
| ------------------------------------------ | ---------------- | ----------------- | ------------------ |
| companies → scenario_entities              | `company_id`     | 1:N (parent 0..N) | Yes                |
| departments → scenario_entities            | `department_id`  | 1:N (parent 0..N) | Yes                |
| roles → scenario_entities                  | `role_id`        | 1:N (parent 0..N) | Yes                |
| employees → scenario_entities              | `employee_id`    | 1:N (parent 0..N) | Yes                |
| locations → scenario_entities              | `location_id`    | 1:N (parent 0..N) | Yes                |
| systems → scenario_entities                | `system_id`      | 1:N (parent 0..N) | Yes                |
| cost_centers → scenario_entities           | `cost_center_id` | 1:N (parent 0..N) | Yes                |
| warehouses → scenario_entities             | `warehouse_id`   | 1:N (parent 0..N) | Yes                |
| suppliers → scenario_entities              | `supplier_id`    | 1:N (parent 0..N) | Yes                |
| products → scenario_entities               | `product_id`     | 1:N (parent 0..N) | Yes                |
| customers → scenario_entities              | `customer_id`    | 1:N (parent 0..N) | Yes                |
| inventory → scenario_entities              | `inventory_id`   | 1:N (parent 0..N) | Yes                |
| policies → scenario_entities               | `policy_id`      | 1:N (parent 0..N) | Yes                |
| companies → evaluation_question_sources    | `company_id`     | 1:N (parent 0..N) | Yes                |
| departments → evaluation_question_sources  | `department_id`  | 1:N (parent 0..N) | Yes                |
| roles → evaluation_question_sources        | `role_id`        | 1:N (parent 0..N) | Yes                |
| employees → evaluation_question_sources    | `employee_id`    | 1:N (parent 0..N) | Yes                |
| locations → evaluation_question_sources    | `location_id`    | 1:N (parent 0..N) | Yes                |
| systems → evaluation_question_sources      | `system_id`      | 1:N (parent 0..N) | Yes                |
| cost_centers → evaluation_question_sources | `cost_center_id` | 1:N (parent 0..N) | Yes                |
| warehouses → evaluation_question_sources   | `warehouse_id`   | 1:N (parent 0..N) | Yes                |
| suppliers → evaluation_question_sources    | `supplier_id`    | 1:N (parent 0..N) | Yes                |
| products → evaluation_question_sources     | `product_id`     | 1:N (parent 0..N) | Yes                |
| customers → evaluation_question_sources    | `customer_id`    | 1:N (parent 0..N) | Yes                |
| inventory → evaluation_question_sources    | `inventory_id`   | 1:N (parent 0..N) | Yes                |
| policies → evaluation_question_sources     | `policy_id`      | 1:N (parent 0..N) | Yes                |
| scenarios → evaluation_question_sources    | `scenario_id`    | 1:N (parent 0..N) | Yes                |

Product + Warehouse → Inventory is a composite-key dependency: each existing pair has at most one balance (0..1), enforced by UNIQUE(product_id, warehouse_id). It is not a separate entity/FK edge or an additional 1:1 association.

For a future documents row, one policy or scenario source is mandatory (individual FKs nullable); each source can have 0..N documents. Each future chunk has one document; documents have 0..N chunks. A chunk optionally references one section; sections have 0..N chunks. Embedding cardinality/model versions remain deferred.

The default cost-center link is unique: each department selects one center, and a center can be the default only for its owning department. This differs from cost_centers.department_id, which permits multiple owned centers per department.
