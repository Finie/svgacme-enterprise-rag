# Source-to-model mapping

The JSON and Markdown files remain unchanged. This is an ingestion blueprint, not an ingestion implementation. Scalar camelCase names map to snake_case unless overridden below. Nested nonrelational objects retain their exact keys and values as JSONB. No timestamps or generic entity tables are inferred.

## data/enterprise/company.json → companies

| Source field          | Destination                                                           |
| --------------------- | --------------------------------------------------------------------- |
| `companyId`           | companies.company_id                                                  |
| `legalName`           | companies.legal_name                                                  |
| `tradingName`         | companies.trading_name                                                |
| `industry`            | companies.industry                                                    |
| `description`         | companies.description                                                 |
| `registrationNumber`  | companies.registration_number                                         |
| `kraPin`              | companies.kra_pin                                                     |
| `country`             | companies.country                                                     |
| `headquarters`        | companies.headquarters_location_id (FK) + headquarters_address (text) |
| `employeeCount`       | companies.employee_count                                              |
| `employeeDatasetNote` | companies.employee_dataset_note                                       |
| `yearEstablished`     | companies.year_established                                            |
| `website`             | companies.website                                                     |
| `contact`             | companies.contact                                                     |
| `currency`            | companies.currency                                                    |
| `timezone`            | companies.timezone                                                    |
| `fiscalYear`          | companies.fiscal_year                                                 |
| `status`              | companies.status                                                      |

## data/enterprise/departments.json → departments

| Source field           | Destination                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `departmentId`         | departments.department_id                                          |
| `name`                 | departments.name                                                   |
| `description`          | departments.description                                            |
| `departmentHeadRoleId` | departments.department_head_role_id                                |
| `costCenterCode`       | departments.cost_center_id (FK, source value is an ID, not a code) |
| `status`               | departments.status                                                 |

## data/enterprise/roles.json → roles

| Source field          | Destination                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `roleId`              | roles.role_id                                                                                             |
| `title`               | roles.title                                                                                               |
| `departmentId`        | roles.department_id                                                                                       |
| `level`               | roles.level                                                                                               |
| `description`         | roles.description                                                                                         |
| `responsibilities`    | roles.responsibilities                                                                                    |
| `approvalAuthority`   | role_approval_authorities: absent row for null object; otherwise role_id, description, approval_limit_kes |
| `systemAccessProfile` | role_system_access: split first ": " into system_id and verbatim access_profile                           |

## data/enterprise/employees.json → employees

| Source field        | Destination                   |
| ------------------- | ----------------------------- |
| `employeeId`        | employees.employee_id         |
| `employeeNumber`    | employees.employee_number     |
| `firstName`         | employees.first_name          |
| `lastName`          | employees.last_name           |
| `email`             | employees.email               |
| `phone`             | employees.phone               |
| `roleId`            | employees.role_id             |
| `departmentId`      | employees.department_id       |
| `managerEmployeeId` | employees.manager_employee_id |
| `locationId`        | employees.location_id         |
| `employmentType`    | employees.employment_type     |
| `employmentStatus`  | employees.employment_status   |
| `hireDate`          | employees.hire_date           |
| `businessProcesses` | employees.business_processes  |

## data/enterprise/locations.json → locations

| Source field | Destination           |
| ------------ | --------------------- |
| `locationId` | locations.location_id |
| `name`       | locations.name        |
| `type`       | locations.type        |
| `city`       | locations.city        |
| `county`     | locations.county      |
| `country`    | locations.country     |
| `address`    | locations.address     |
| `status`     | locations.status      |

## data/enterprise/systems.json → systems

| Source field         | Destination                  |
| -------------------- | ---------------------------- |
| `systemId`           | systems.system_id            |
| `name`               | systems.name                 |
| `vendor`             | systems.vendor               |
| `category`           | systems.category             |
| `description`        | systems.description          |
| `owningDepartmentId` | systems.owning_department_id |
| `criticality`        | systems.criticality          |
| `environment`        | systems.environment          |
| `status`             | systems.status               |

## data/master-data/cost-centers.json → cost_centers

| Source field        | Destination                      |
| ------------------- | -------------------------------- |
| `costCenterId`      | cost_centers.cost_center_id      |
| `code`              | cost_centers.code                |
| `name`              | cost_centers.name                |
| `departmentId`      | cost_centers.department_id       |
| `managerEmployeeId` | cost_centers.manager_employee_id |
| `locationId`        | cost_centers.location_id         |
| `status`            | cost_centers.status              |

## data/master-data/warehouses.json → warehouses

| Source field            | Destination                       |
| ----------------------- | --------------------------------- |
| `warehouseId`           | warehouses.warehouse_id           |
| `code`                  | warehouses.code                   |
| `name`                  | warehouses.name                   |
| `locationId`            | warehouses.location_id            |
| `city`                  | warehouses.city                   |
| `warehouseType`         | warehouses.warehouse_type         |
| `managerEmployeeId`     | warehouses.manager_employee_id    |
| `capacityUnits`         | warehouses.capacity_units         |
| `operatingHours`        | warehouses.operating_hours        |
| `temperatureControlled` | warehouses.temperature_controlled |
| `status`                | warehouses.status                 |

## data/master-data/suppliers.json → suppliers

| Source field                  | Destination                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `supplierId`                  | suppliers.supplier_id                                                           |
| `supplierCode`                | suppliers.supplier_code                                                         |
| `legalName`                   | suppliers.legal_name                                                            |
| `tradingName`                 | suppliers.trading_name                                                          |
| `supplierCategory`            | suppliers.supplier_category                                                     |
| `contactEmail`                | suppliers.contact_email                                                         |
| `contactPhone`                | suppliers.contact_phone                                                         |
| `country`                     | suppliers.country                                                               |
| `city`                        | suppliers.city                                                                  |
| `paymentTerms`                | suppliers.payment_terms                                                         |
| `currency`                    | suppliers.currency                                                              |
| `taxRegistrationStatus`       | suppliers.tax_registration_status                                               |
| `approvalStatus`              | suppliers.approval_status                                                       |
| `riskRating`                  | suppliers.risk_rating                                                           |
| `procurementCategory`         | suppliers.procurement_category                                                  |
| `primaryContactName`          | suppliers.primary_contact_name                                                  |
| `relationshipOwnerEmployeeId` | suppliers.relationship_owner_employee_id                                        |
| `suppliedProductIds`          | product_suppliers(product_id, supplier_id); validate equality with product list |
| `active`                      | suppliers.active                                                                |

## data/master-data/products.json → products

| Source field      | Destination                                                                 |
| ----------------- | --------------------------------------------------------------------------- |
| `productId`       | products.product_id                                                         |
| `sku`             | products.sku                                                                |
| `name`            | products.name                                                               |
| `description`     | products.description                                                        |
| `category`        | products.category                                                           |
| `subcategory`     | products.subcategory                                                        |
| `unitOfMeasure`   | products.unit_of_measure                                                    |
| `unitCost`        | products.unit_cost                                                          |
| `sellingPrice`    | products.selling_price                                                      |
| `reorderLevel`    | products.reorder_level                                                      |
| `reorderQuantity` | products.reorder_quantity                                                   |
| `supplierIds`     | product_suppliers(product_id, supplier_id); reconcile supplier inverse list |
| `taxCategory`     | products.tax_category                                                       |
| `status`          | products.status                                                             |

## data/master-data/customers.json → customers

| Source field               | Destination                           |
| -------------------------- | ------------------------------------- |
| `customerId`               | customers.customer_id                 |
| `customerCode`             | customers.customer_code               |
| `legalName`                | customers.legal_name                  |
| `tradingName`              | customers.trading_name                |
| `customerType`             | customers.customer_type               |
| `industry`                 | customers.industry                    |
| `city`                     | customers.city                        |
| `county`                   | customers.county                      |
| `country`                  | customers.country                     |
| `creditLimit`              | customers.credit_limit                |
| `paymentTerms`             | customers.payment_terms               |
| `accountManagerEmployeeId` | customers.account_manager_employee_id |
| `customerStatus`           | customers.customer_status             |
| `riskRating`               | customers.risk_rating                 |

## data/master-data/inventory.json → inventory

| Source field         | Destination                     |
| -------------------- | ------------------------------- |
| `inventoryId`        | inventory.inventory_id          |
| `productId`          | inventory.product_id            |
| `warehouseId`        | inventory.warehouse_id          |
| `quantityOnHand`     | inventory.quantity_on_hand      |
| `quantityReserved`   | inventory.quantity_reserved     |
| `quantityAvailable`  | inventory.quantity_available    |
| `reorderLevel`       | inventory.reorder_level         |
| `reorderQuantity`    | inventory.reorder_quantity      |
| `inventoryStatus`    | inventory.inventory_status      |
| `lastStockCountDate` | inventory.last_stock_count_date |

## Policy Markdown → policies and children

| Source                                                            | Destination                                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Document ID                                                       | policies.policy_id (the policy document ID, distinct from future semantic document_id) |
| Title / Version                                                   | policies.title / version                                                               |
| Effective Date / Review Date                                      | policies.effective_date / review_date                                                  |
| Owner                                                             | policies.owner_role_id (ROLE ID)                                                       |
| Department                                                        | policies.department_id via exact departments.name                                      |
| Status / Classification / Country / Business Unit / Document Type | policies.status / classification / country / business_unit / document_type             |
| System                                                            | policy_systems(policy_id, system_id, ordinal), names resolved exactly                  |
| Numbered heading, body until next numbered heading                | policy_sections(policy_id, section_ordinal, heading, source_heading, body_markdown)    |
| §12 explicit related policy IDs                                   | policy_relationships(policy_id, related_policy_id, ordinal)                            |
| FIN-POL-002 §5.1 scope                                            | approval_policy_sets.scope and policy_id                                               |
| FIN-POL-002 §5.2 five bands and labels                            | approval_tiers bounds, inclusivity, ordinal, approver_label, source_rule_text          |
| Original file/preamble                                            | retained source Markdown; title/metadata mapped above                                  |

## Scenario JSON → scenarios and children

| Source                                                    | Destination                                                                                                |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| id                                                        | scenarios.scenario_id                                                                                      |
| category, title, description, difficulty                  | same-named scenario fields                                                                                 |
| businessContext, expectedOutcome                          | business_context, expected_outcome                                                                         |
| questionTypes, tags, relevantFacts, requiredReasoning     | question_types, tags, relevant_facts, required_reasoning (ordered JSONB)                                   |
| actors[].employeeId / roleId / departmentId / name / role | scenario_actors.employee_id / role_id / department_id / name / role_title; ordinal from array              |
| entities[].type / id / name                               | scenario_entities.source_type / source_id / name + typed FK target; origin entities                        |
| systems[]                                                 | scenario_entities system membership, original name preserved, system_id resolved; origin systems           |
| policies[]                                                | scenario_entities policy membership with policy_id; origin policies                                        |
| events[].sequence / event                                 | scenario_events.sequence / event                                                                           |
| relationships[].from / type / to                          | scenario_relationships source from / type / source to and within-scenario endpoint FKs; ordinal from array |
| scenario index.json                                       | derived manifest; not another scenario                                                                     |

## Evaluation JSON → evaluation_questions and references

| Source                                                                                                  | Destination                                                                                                       |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| id / prefix / question / category / subcategory / difficulty / answerability                            | question_id / prefix / question / category / subcategory / difficulty / answerability                             |
| expectedAnswer / expectedBehavior                                                                       | expected_answer / expected_behavior                                                                               |
| acceptableAnswerPoints / reasoningSteps / tags                                                          | acceptable_answer_points / reasoning_steps / tags (ordered JSONB)                                                 |
| requiredSources[].type / id / section                                                                   | evaluation_question_sources.type / source_id / section; typed FK, reference_kind required, source_ordinal         |
| entities[] / systems[] / policies[] / scenarios[]                                                       | evaluation_question_sources with matching reference_kind; original strings and order retained, typed FKs resolved |
| categories/*.json                                                                                       | duplicate projections checked against questions.json, no duplicate ingestion                                      |
| index.json totalQuestions/categories/difficulty/answerability/generatedAt/generatorVersion/sourceCounts | file-level manifest provenance; no enterprise entity                                                              |

No current field maps to an embedding. Future documents/chunks are derived projections with source lineage, not replacements for the canonical entities. See evaluation-model for typed target constraints and semantic section locators.

## Nested enterprise attributes

| Source path                                                | Destination                                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| company.headquarters.locationId                            | companies.headquarters_location_id FK                                               |
| company.headquarters.address                               | companies.headquarters_address text                                                 |
| company.contact.email / phone / postalAddress              | companies.contact JSONB, same nested keys                                           |
| company.fiscalYear.startMonth / endMonth / label           | companies.fiscal_year JSONB, same nested keys                                       |
| roles[].approvalAuthority.description                      | role_approval_authorities.description                                               |
| roles[].approvalAuthority.approvalLimitKes                 | role_approval_authorities.approval_limit_kes, nullable only for unlimited authority |
| roles[].systemAccessProfile[] SYS ID prefix                | role_system_access.system_id                                                        |
| roles[].systemAccessProfile[] text after first colon-space | role_system_access.access_profile, verbatim                                         |
