# Explicit business rules

## Approval representation

The authoritative matrix is FIN-POL-002 §5.2, not the role register and not a generic rules table. One policy set describes expenditure, purchase commitments, expense claims and operational travel (§5.1).

| Ordinal | Source band in KES   | Approver label             | Upper ceiling    |
| ------- | -------------------- | -------------------------- | ---------------- |
| 1       | ≤50,000              | Department Manager         | 50,000           |
| 2       | 50,001–500,000       | Department Head            | 500,000          |
| 3       | 500,001–2,000,000    | Finance Manager            | 2,000,000        |
| 4       | 2,000,001–10,000,000 | CFO                        | 10,000,000       |
| 5       | >10,000,000          | CEO or Executive Committee | NULL (unbounded) |

Store lower_bound_kes NULL for the first band, 50,001 / 500,001 / 2,000,001 inclusive for bands 2–4, and 10,000,000 exclusive for band 5. Upper bounds are inclusive where finite. Keep verbatim source_rule_text. Nonnegative transaction amounts are an application precondition. The source uses whole-KES bands: fractional amounts between 50,000 and 50,001 are not specified. Preserve the wording; agree a rounding or continuous-boundary interpretation before a payment engine is built.

Store role approval descriptions and limits independently in role_approval_authorities. A null authority object creates no row; an existing authority with null limit is unlimited (CEO). The model preserves this distinction even though the scenario generator's fallback treats both as null. All current approval-ladder participants have authority objects, so this does not break the current corpus.

For an eligible approver with authority:

`effective_limit = min(policy_matrix_ceiling, role_specific_approval_limit)`

Treat null limits as positive infinity for this calculation, returning null only if both are unbounded. Missing authority means ineligible, not unlimited. Finance Manager has a 1,000,000 role limit versus 2,000,000 policy ceiling; CFO has 5,000,000 versus 10,000,000. Escalation, scope, conflicts and self-approval checks belong in application validation; numeric sufficiency alone does not authorize a transaction.

The scenario generator (`generate-scenarios.ts`, resolveApproval) collapses Department Manager and Department Head to the department's head employee, using a 500,000 ceiling. Preserve **five policy tiers** and document this separate four-step routing behavior. Department roles resolve through the requesting department's head role; Finance Manager/CFO/CEO resolve to ROLE-FIN-MGR/ROLE-CFO/ROLE-CEO. “Executive Committee” has no enterprise entity: preserve the label, do not fabricate a role or FK. Scenario routing is not evidence that the policy only has four tiers.

## Constraints and enforcement boundary

- Every entity has its documented PK; all mandatory FKs are NOT NULL. Restrict deletion of referenced business records; later lifecycle policy must explicitly authorize cascading deletion of dependent snapshot rows.
- Inventory UNIQUE(product_id, warehouse_id). A pair has zero or one inventory record, not a guaranteed record. quantity_on_hand, quantity_reserved and quantity_available ≥0; quantity_available = quantity_on_hand − quantity_reserved. Reorder quantities/levels ≥0. Exact arithmetic; no floating point money.
- Role approval limits are null or ≥0. Approval bounds are null or nonnegative; finite lower ≤ upper. Validate nonoverlap and source band semantics across tiers in application code.
- Supplier/product arrays must agree bidirectionally before one junction is produced. PK prevents duplicate pairs. Role access PK prevents duplicate system membership per role; profile text remains intact.
- Employee manager cannot equal employee; cycle detection is cross-row application validation. No constraint requires employee.department_id = role.department_id.
- Default cost center belongs to its department and departments.cost_center_id is unique; head role membership must resolve. Department/head-role and department/default-center references are cyclic dependencies: future ingestion needs staged loading or deferred FK checks, not nullable business relationships.
- Typed knowledge references use actual nullable FK columns plus an exactly-one-target CHECK. Validate discriminator/source-ID agreement in application logic. Policy-section references must use the same policy as their source target.
- Policy dates must parse as dates and review_date ≥ effective_date. Version, status, country, classification and document type preserve source values; no generic global status enum inferred.
- Positive unique child ordinals and within-parent source order are required. Composite graph endpoint FKs include scenario_id, preventing cross-scenario endpoints.

Source-derived nonnegative checks also apply to customer credit_limit, product unit_cost/selling_price/reorder values and warehouse capacity_units. No rule says selling_price must exceed unit_cost or that all managers work at the facility they manage.

## Known interpretation issues and smallest safe corrections

No dangling structured references, manager cycles, nonreciprocal supplier pairs or conflicting inventory keys were found by the model validator. Relational modeling is possible without editing the dataset.

1. The misleading costCenterCode name is corrected only in the logical destination.
2. The five-tier policy versus four-step scenario routing is an intentional generator simplification. Preserve both; before operational approval implementation, explicitly specify routing by department and policy tier. Do not rewrite limits to force agreement.
3. Some scenario relevantFacts describe the first tier as “Department Manager/Department Head” (e.g. SCN-PROC-001). Retain this source text; the smallest later correction is to align that narrative phrase with the policy while leaving the five-tier matrix intact.
4. Evaluation locators “Approval Authority” and “Scenario business context” are not literal policy headings. Preserve locator text and leave policy_section FK null unless a reviewed mapping exists. Do not claim an exact citation that the source lacks.
5. SCN-SUP-005 has an edge to DEPT-PROC outside its entities list. Add a derived reference-only graph node during future ingestion, retaining origin metadata; do not alter the scenario JSON.
6. Null authority objects and unlimited null limits require distinct representation. Fix only the future resolver's missing-authority handling; generated data needs no change.
