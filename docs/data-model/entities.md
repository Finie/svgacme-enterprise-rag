# Logical entities

28 current logical entities, plus 2 future-only entities (`documents`, `document_chunks`). Embedding is a future dependent representation, not an implemented or counted entity. All names below are logical; no SQL or ORM is introduced.

PKs use existing text IDs. New child keys use stable parent ID + source ordinal (1-based); preserve these ordinals during later edits. All source scalar fields are required unless explicitly nullable below. FK nullability and multiplicity are defined in [relationships.md](relationships.md). Dates become dates, amounts exact decimal, counts integers, flags booleans, descriptions text. Arrays of prose/tags remain ordered JSONB; no EAV tables.

## companies

Legal organization and corporate context; no inferred company FK on every other entity. PK: `company_id`. Source: `data/enterprise/company.json` (1 records).

| Source attribute      | Logical destination / type                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `companyId`           | companies.company_id; text                                                                 |
| `legalName`           | companies.legal_name; text                                                                 |
| `tradingName`         | companies.trading_name; text                                                               |
| `industry`            | companies.industry; text                                                                   |
| `description`         | companies.description; text                                                                |
| `registrationNumber`  | companies.registration_number; text                                                        |
| `kraPin`              | companies.kra_pin; text                                                                    |
| `country`             | companies.country; text                                                                    |
| `headquarters`        | companies.headquarters_location_id (FK) + headquarters_address (text); FK and address text |
| `employeeCount`       | companies.employee_count; numeric                                                          |
| `employeeDatasetNote` | companies.employee_dataset_note; text                                                      |
| `yearEstablished`     | companies.year_established; numeric                                                        |
| `website`             | companies.website; text                                                                    |
| `contact`             | companies.contact; JSONB (object)                                                          |
| `currency`            | companies.currency; text                                                                   |
| `timezone`            | companies.timezone; text                                                                   |
| `fiscalYear`          | companies.fiscal_year; JSONB (object)                                                      |
| `status`              | companies.status; text                                                                     |

## departments

Organizational units with a designated head role and default cost center. PK: `department_id`. Source: `data/enterprise/departments.json` (13 records).

| Source attribute       | Logical destination / type                                               |
| ---------------------- | ------------------------------------------------------------------------ |
| `departmentId`         | departments.department_id; text                                          |
| `name`                 | departments.name; text                                                   |
| `description`          | departments.description; text                                            |
| `departmentHeadRoleId` | departments.department_head_role_id; text                                |
| `costCenterCode`       | departments.cost_center_id (FK, source value is an ID, not a code); text |
| `status`               | departments.status; text                                                 |

## roles

Job responsibilities and organizational home; employee department is independent. PK: `role_id`. Source: `data/enterprise/roles.json` (22 records).

| Source attribute      | Logical destination / type                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `roleId`              | roles.role_id; text                                                                                                                          |
| `title`               | roles.title; text                                                                                                                            |
| `departmentId`        | roles.department_id; text                                                                                                                    |
| `level`               | roles.level; text                                                                                                                            |
| `description`         | roles.description; text                                                                                                                      |
| `responsibilities`    | roles.responsibilities; JSONB (ordered array)                                                                                                |
| `approvalAuthority`   | role_approval_authorities: absent row for null object; otherwise role_id, description, approval_limit_kes; normalized optional authority row |
| `systemAccessProfile` | role_system_access: split first ": " into system_id and verbatim access_profile; normalized association rows                                 |

## employees

Representative personnel records and reporting hierarchy. PK: `employee_id`. Source: `data/enterprise/employees.json` (39 records).

| Source attribute    | Logical destination / type                          |
| ------------------- | --------------------------------------------------- |
| `employeeId`        | employees.employee_id; text                         |
| `employeeNumber`    | employees.employee_number; text                     |
| `firstName`         | employees.first_name; text                          |
| `lastName`          | employees.last_name; text                           |
| `email`             | employees.email; text                               |
| `phone`             | employees.phone; text                               |
| `roleId`            | employees.role_id; text                             |
| `departmentId`      | employees.department_id; text                       |
| `managerEmployeeId` | employees.manager_employee_id; text                 |
| `locationId`        | employees.location_id; text                         |
| `employmentType`    | employees.employment_type; text                     |
| `employmentStatus`  | employees.employment_status; text                   |
| `hireDate`          | employees.hire_date; date                           |
| `businessProcesses` | employees.business_processes; JSONB (ordered array) |

## locations

Canonical operational sites. PK: `location_id`. Source: `data/enterprise/locations.json` (5 records).

| Source attribute | Logical destination / type  |
| ---------------- | --------------------------- |
| `locationId`     | locations.location_id; text |
| `name`           | locations.name; text        |
| `type`           | locations.type; text        |
| `city`           | locations.city; text        |
| `county`         | locations.county; text      |
| `country`        | locations.country; text     |
| `address`        | locations.address; text     |
| `status`         | locations.status; text      |

## systems

Enterprise application register and accountable department. PK: `system_id`. Source: `data/enterprise/systems.json` (7 records).

| Source attribute     | Logical destination / type         |
| -------------------- | ---------------------------------- |
| `systemId`           | systems.system_id; text            |
| `name`               | systems.name; text                 |
| `vendor`             | systems.vendor; text               |
| `category`           | systems.category; text             |
| `description`        | systems.description; text          |
| `owningDepartmentId` | systems.owning_department_id; text |
| `criticality`        | systems.criticality; text          |
| `environment`        | systems.environment; text          |
| `status`             | systems.status; text               |

## cost_centers

Financial allocation units, distinct business code and ID. PK: `cost_center_id`. Source: `data/master-data/cost-centers.json` (13 records).

| Source attribute    | Logical destination / type             |
| ------------------- | -------------------------------------- |
| `costCenterId`      | cost_centers.cost_center_id; text      |
| `code`              | cost_centers.code; text                |
| `name`              | cost_centers.name; text                |
| `departmentId`      | cost_centers.department_id; text       |
| `managerEmployeeId` | cost_centers.manager_employee_id; text |
| `locationId`        | cost_centers.location_id; text         |
| `status`            | cost_centers.status; text              |

## warehouses

Stockholding facilities and management responsibility. PK: `warehouse_id`. Source: `data/master-data/warehouses.json` (4 records).

| Source attribute        | Logical destination / type                 |
| ----------------------- | ------------------------------------------ |
| `warehouseId`           | warehouses.warehouse_id; text              |
| `code`                  | warehouses.code; text                      |
| `name`                  | warehouses.name; text                      |
| `locationId`            | warehouses.location_id; text               |
| `city`                  | warehouses.city; text                      |
| `warehouseType`         | warehouses.warehouse_type; text            |
| `managerEmployeeId`     | warehouses.manager_employee_id; text       |
| `capacityUnits`         | warehouses.capacity_units; numeric         |
| `operatingHours`        | warehouses.operating_hours; text           |
| `temperatureControlled` | warehouses.temperature_controlled; boolean |
| `status`                | warehouses.status; text                    |

## suppliers

Supplier registration, risk and relationship ownership. PK: `supplier_id`. Source: `data/master-data/suppliers.json` (16 records).

| Source attribute              | Logical destination / type                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `supplierId`                  | suppliers.supplier_id; text                                                                                  |
| `supplierCode`                | suppliers.supplier_code; text                                                                                |
| `legalName`                   | suppliers.legal_name; text                                                                                   |
| `tradingName`                 | suppliers.trading_name; text                                                                                 |
| `supplierCategory`            | suppliers.supplier_category; text                                                                            |
| `contactEmail`                | suppliers.contact_email; text                                                                                |
| `contactPhone`                | suppliers.contact_phone; text                                                                                |
| `country`                     | suppliers.country; text                                                                                      |
| `city`                        | suppliers.city; text                                                                                         |
| `paymentTerms`                | suppliers.payment_terms; text                                                                                |
| `currency`                    | suppliers.currency; text                                                                                     |
| `taxRegistrationStatus`       | suppliers.tax_registration_status; text                                                                      |
| `approvalStatus`              | suppliers.approval_status; text                                                                              |
| `riskRating`                  | suppliers.risk_rating; text                                                                                  |
| `procurementCategory`         | suppliers.procurement_category; text                                                                         |
| `primaryContactName`          | suppliers.primary_contact_name; text                                                                         |
| `relationshipOwnerEmployeeId` | suppliers.relationship_owner_employee_id; text                                                               |
| `suppliedProductIds`          | product_suppliers(product_id, supplier_id); validate equality with product list; normalized association rows |
| `active`                      | suppliers.active; boolean                                                                                    |

## products

Product catalog, pricing and replenishment defaults. PK: `product_id`. Source: `data/master-data/products.json` (36 records).

| Source attribute  | Logical destination / type                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `productId`       | products.product_id; text                                                                                |
| `sku`             | products.sku; text                                                                                       |
| `name`            | products.name; text                                                                                      |
| `description`     | products.description; text                                                                               |
| `category`        | products.category; text                                                                                  |
| `subcategory`     | products.subcategory; text                                                                               |
| `unitOfMeasure`   | products.unit_of_measure; text                                                                           |
| `unitCost`        | products.unit_cost; numeric                                                                              |
| `sellingPrice`    | products.selling_price; numeric                                                                          |
| `reorderLevel`    | products.reorder_level; numeric                                                                          |
| `reorderQuantity` | products.reorder_quantity; numeric                                                                       |
| `supplierIds`     | product_suppliers(product_id, supplier_id); reconcile supplier inverse list; normalized association rows |
| `taxCategory`     | products.tax_category; text                                                                              |
| `status`          | products.status; text                                                                                    |

## customers

Customer accounts, credit and account ownership. PK: `customer_id`. Source: `data/master-data/customers.json` (20 records).

| Source attribute           | Logical destination / type                  |
| -------------------------- | ------------------------------------------- |
| `customerId`               | customers.customer_id; text                 |
| `customerCode`             | customers.customer_code; text               |
| `legalName`                | customers.legal_name; text                  |
| `tradingName`              | customers.trading_name; text                |
| `customerType`             | customers.customer_type; text               |
| `industry`                 | customers.industry; text                    |
| `city`                     | customers.city; text                        |
| `county`                   | customers.county; text                      |
| `country`                  | customers.country; text                     |
| `creditLimit`              | customers.credit_limit; numeric             |
| `paymentTerms`             | customers.payment_terms; text               |
| `accountManagerEmployeeId` | customers.account_manager_employee_id; text |
| `customerStatus`           | customers.customer_status; text             |
| `riskRating`               | customers.risk_rating; text                 |

## inventory

One stock balance per product/warehouse pair; absent pairs are not zero balances. PK: `inventory_id`. Source: `data/master-data/inventory.json` (141 records).

| Source attribute     | Logical destination / type            |
| -------------------- | ------------------------------------- |
| `inventoryId`        | inventory.inventory_id; text          |
| `productId`          | inventory.product_id; text            |
| `warehouseId`        | inventory.warehouse_id; text          |
| `quantityOnHand`     | inventory.quantity_on_hand; numeric   |
| `quantityReserved`   | inventory.quantity_reserved; numeric  |
| `quantityAvailable`  | inventory.quantity_available; numeric |
| `reorderLevel`       | inventory.reorder_level; numeric      |
| `reorderQuantity`    | inventory.reorder_quantity; numeric   |
| `inventoryStatus`    | inventory.inventory_status; text      |
| `lastStockCountDate` | inventory.last_stock_count_date; date |

## Normalization and uniqueness

`departments.costCenterCode` contains IDs such as `CC-FIN`; rename it to `cost_center_id`. `cost_centers.code` separately contains `CC-110`. Preserve both values without renaming or rewriting source JSON. Each default center must belong to its department; departments.cost_center_id is UNIQUE, while cost_centers.department_id is not. Do not force one center per department in the future just because the sample has 13 of each.

Unique business keys: employee_number, employee email, product SKU, supplier_code, customer_code, cost-center code, warehouse code. Department and system names must uniquely resolve current name-based references; use exact matches and reject ambiguous mappings. Other names, phone numbers, titles, manager IDs and location IDs are not unique. Company registration_number and kra_pin are candidate alternate keys within the Kenyan scope; do not assert globally unique names. Preserve business-process, responsibility and contact/fiscal-year metadata without new tables.

Employee manager is nullable (CEO root). All other enterprise/master FKs are non-null. The 428 company employee_count is total headcount; 39 personnel records are a curated subset, not a referential-integrity error. Employees EMP-0027, EMP-0028, EMP-0029, EMP-0038 and EMP-0039 may belong to a department different from their role's home: never add equality between these two department paths.

## Normalized and knowledge entities

| Entity                      | PK                                            | Required attributes / constraints and meaning                                                                                                                                                                                                |
| --------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| role_system_access          | (role_id, system_id)                          | Both FKs; access_profile text after the first `: `, preserved verbatim. No invented permission enum.                                                                                                                                         |
| product_suppliers           | (product_id, supplier_id)                     | Both FKs; canonical many-to-many association. The two source lists must describe exactly the same set; reject differences, never silently union them.                                                                                        |
| approval_policy_sets        | approval_policy_set_id                        | Derived stable ID `FIN-POL-002:1.0:financial`; policy_id FK, scope text from §5.1. No invented effective dates: inherit policy version/dates.                                                                                                |
| approval_tiers              | (approval_policy_set_id, tier_ordinal)        | FK to set; lower_bound_kes, upper_bound_kes (nullable = unbounded), lower_inclusive, upper_inclusive, approver_label, source_rule_text; preserve all five policy bands. See business-rules.                                                  |
| role_approval_authorities   | role_id                                       | PK/FK to role; description, approval_limit_kes nullable = unlimited. Null approvalAuthority object means no row; do not conflate absent authority with an unlimited existing authority.                                                      |
| policies                    | policy_id                                     | Source Document ID; title, version, effective_date, review_date, owner_role_id FK, department_id FK, status, classification, country, business_unit, document_type. Version retained; current corpus has one version per ID.                 |
| policy_sections             | (policy_id, section_ordinal)                  | FK; heading, body_markdown, source_heading. Preserve all 13 numbered sections including tables, lists and whitespace; document title/metadata are policy attributes.                                                                         |
| policy_relationships        | (policy_id, related_policy_id)                | Two policy FKs; directed explicit Related Policies membership; preserve source order via ordinal unique within policy. No inferred reverse edge.                                                                                             |
| policy_systems              | (policy_id, system_id)                        | Both FKs, ordinal; split System metadata on semicolon and resolve exact canonical name.                                                                                                                                                      |
| scenarios                   | scenario_id                                   | All narrative and metadata fields in evaluation-model; no production transaction state.                                                                                                                                                      |
| scenario_actors             | (scenario_id, actor_ordinal)                  | Scenario, employee, role and department FKs; name and role title are source snapshot text.                                                                                                                                                   |
| scenario_entities           | (scenario_id, entity_ordinal)                 | Scenario FK, source_type, source_id, name; typed target FKs with exactly one populated; origin and source_ordinal preserve array membership (see evaluation-model).                                                                          |
| scenario_events             | (scenario_id, sequence)                       | Scenario FK, event text; positive, unique sequence, contiguous source order validated in application.                                                                                                                                        |
| scenario_relationships      | (scenario_id, relationship_ordinal)           | Scenario FK, from_entity_ordinal and to_entity_ordinal composite FKs into same scenario_entities; type text; source from/to retained as source IDs.                                                                                          |
| evaluation_questions        | question_id                                   | Source id; fields in evaluation-model, unique question text in current corpus; evaluation namespace only.                                                                                                                                    |
| evaluation_question_sources | (question_id, reference_kind, source_ordinal) | Question FK; type, source_id, section nullable, exactly one typed target FK; optional policy_section composite FK only when exact resolution is justified. reference_kind distinguishes requiredSources/entities/systems/policies/scenarios. |

For policy revisions, a later implementation must decide revision identity before importing multiple versions; do not overwrite an existing version silently. Derived ordinal keys are stable within this immutable corpus, not a promise that an arbitrary regeneration preserves identity.
