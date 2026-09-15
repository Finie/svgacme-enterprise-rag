# ER diagrams

Mermaid source is used as reviewable Markdown and renders in Mermaid-capable viewers. Diagrams are split by domain; the relationship catalog is authoritative for all typed-target alternatives. Crow’s foot is child multiplicity; `o` marks optional participation.

## Core enterprise

```mermaid
erDiagram
    locations ||--o{ companies : "headquarters_location_id"
    roles ||--o{ departments : "department_head_role_id"
    cost_centers ||--o| departments : "cost_center_id"
    departments ||--o{ roles : "department_id"
    roles ||--o{ employees : "role_id"
    departments ||--o{ employees : "department_id"
    employees |o--o{ employees : "manager_employee_id"
    locations ||--o{ employees : "location_id"
    departments ||--o{ systems : "owning_department_id"
    roles ||--o{ role_system_access : "role_id"
    systems ||--o{ role_system_access : "system_id"
```

## Master data

```mermaid
erDiagram
    departments ||--o{ cost_centers : "department_id"
    employees ||--o{ cost_centers : "manager_employee_id"
    locations ||--o{ cost_centers : "location_id"
    locations ||--o{ warehouses : "location_id"
    employees ||--o{ warehouses : "manager_employee_id"
    employees ||--o{ suppliers : "relationship_owner_employee_id"
    employees ||--o{ customers : "account_manager_employee_id"
    products ||--o{ product_suppliers : "product_id"
    suppliers ||--o{ product_suppliers : "supplier_id"
    products ||--o{ inventory : "product_id"
    warehouses ||--o{ inventory : "warehouse_id"
```

## Business rules

```mermaid
erDiagram
    policies ||--o{ approval_policy_sets : "policy_id"
    approval_policy_sets ||--o{ approval_tiers : "approval_policy_set_id"
    roles ||--o| role_approval_authorities : "role_id"
```

## Knowledge

```mermaid
erDiagram
    roles ||--o{ policies : "owner_role_id"
    departments ||--o{ policies : "department_id"
    policies ||--o{ policy_sections : "policy_id"
    policies ||--o{ policy_relationships : "policy_id"
    policies ||--o{ policy_relationships : "related_policy_id"
    policies ||--o{ policy_systems : "policy_id"
    systems ||--o{ policy_systems : "system_id"
```

## Scenarios and evaluation

```mermaid
erDiagram
    scenarios ||--o{ scenario_actors : "scenario_id"
    scenarios ||--o{ scenario_entities : "scenario_id"
    scenarios ||--o{ scenario_events : "scenario_id"
    scenarios ||--o{ scenario_relationships : "scenario_id"
    employees ||--o{ scenario_actors : "employee_id"
    roles ||--o{ scenario_actors : "role_id"
    departments ||--o{ scenario_actors : "department_id"
    scenario_entities ||--o{ scenario_relationships : "(scenario_id, from_entity_ordinal)"
    scenario_entities ||--o{ scenario_relationships : "(scenario_id, to_entity_ordinal)"
    evaluation_questions ||--o{ evaluation_question_sources : "question_id"
    policy_sections |o--o{ evaluation_question_sources : "(policy_id, section_ordinal)"
```

scenario_entities and evaluation_question_sources each have exactly one typed enterprise/policy target (evaluation also allows scenario). All alternatives and nullability are enumerated in relationships.md; hiding those repeated edges here keeps the diagram readable. Scenario systems/policies membership is represented through scenario_entities; question metadata references use evaluation_question_sources.reference_kind.
