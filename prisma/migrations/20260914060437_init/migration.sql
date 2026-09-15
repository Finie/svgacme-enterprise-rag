-- pgvector: enabled now so the physical database can support a future
-- semantic layer (embeddings on policy/section/scenario text). No vector
-- columns are created in this phase. See docs/database/architecture.md.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "companies" (
    "company_id" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trading_name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "registration_number" TEXT NOT NULL,
    "kra_pin" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "headquarters_location_id" TEXT NOT NULL,
    "headquarters_address" TEXT NOT NULL,
    "employee_count" INTEGER NOT NULL,
    "employee_dataset_note" TEXT NOT NULL,
    "year_established" INTEGER NOT NULL,
    "website" TEXT NOT NULL,
    "contact" JSONB NOT NULL,
    "currency" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "fiscal_year" JSONB NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "locations" (
    "location_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("location_id")
);

-- CreateTable
CREATE TABLE "departments" (
    "department_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "department_head_role_id" TEXT NOT NULL,
    "cost_center_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("department_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "role_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibilities" JSONB NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "employees" (
    "employee_id" TEXT NOT NULL,
    "employee_number" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "manager_employee_id" TEXT,
    "location_id" TEXT NOT NULL,
    "employment_type" TEXT NOT NULL,
    "employment_status" TEXT NOT NULL,
    "hire_date" DATE NOT NULL,
    "business_processes" JSONB NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "systems" (
    "system_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "owning_department_id" TEXT NOT NULL,
    "criticality" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "systems_pkey" PRIMARY KEY ("system_id")
);

-- CreateTable
CREATE TABLE "role_system_access" (
    "role_id" TEXT NOT NULL,
    "system_id" TEXT NOT NULL,
    "access_profile" TEXT NOT NULL,

    CONSTRAINT "role_system_access_pkey" PRIMARY KEY ("role_id","system_id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "cost_center_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "manager_employee_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("cost_center_id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "warehouse_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "warehouse_type" TEXT NOT NULL,
    "manager_employee_id" TEXT NOT NULL,
    "capacity_units" INTEGER NOT NULL,
    "operating_hours" TEXT NOT NULL,
    "temperature_controlled" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("warehouse_id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "supplier_id" TEXT NOT NULL,
    "supplier_code" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trading_name" TEXT NOT NULL,
    "supplier_category" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "payment_terms" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "tax_registration_status" TEXT NOT NULL,
    "approval_status" TEXT NOT NULL,
    "risk_rating" TEXT NOT NULL,
    "procurement_category" TEXT NOT NULL,
    "primary_contact_name" TEXT NOT NULL,
    "relationship_owner_employee_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("supplier_id")
);

-- CreateTable
CREATE TABLE "products" (
    "product_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "unit_of_measure" TEXT NOT NULL,
    "unit_cost" DECIMAL(14,2) NOT NULL,
    "selling_price" DECIMAL(14,2) NOT NULL,
    "reorder_level" INTEGER NOT NULL,
    "reorder_quantity" INTEGER NOT NULL,
    "tax_category" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "product_suppliers" (
    "product_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,

    CONSTRAINT "product_suppliers_pkey" PRIMARY KEY ("product_id","supplier_id")
);

-- CreateTable
CREATE TABLE "customers" (
    "customer_id" TEXT NOT NULL,
    "customer_code" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trading_name" TEXT NOT NULL,
    "customer_type" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "credit_limit" DECIMAL(14,2) NOT NULL,
    "payment_terms" TEXT NOT NULL,
    "account_manager_employee_id" TEXT NOT NULL,
    "customer_status" TEXT NOT NULL,
    "risk_rating" TEXT NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "inventory_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "quantity_on_hand" INTEGER NOT NULL,
    "quantity_reserved" INTEGER NOT NULL,
    "quantity_available" INTEGER NOT NULL,
    "reorder_level" INTEGER NOT NULL,
    "reorder_quantity" INTEGER NOT NULL,
    "inventory_status" TEXT NOT NULL,
    "last_stock_count_date" DATE NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("inventory_id")
);

-- CreateTable
CREATE TABLE "approval_policy_sets" (
    "approval_policy_set_id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,

    CONSTRAINT "approval_policy_sets_pkey" PRIMARY KEY ("approval_policy_set_id")
);

-- CreateTable
CREATE TABLE "approval_tiers" (
    "approval_policy_set_id" TEXT NOT NULL,
    "tier_ordinal" INTEGER NOT NULL,
    "lower_bound_kes" DECIMAL(14,2),
    "upper_bound_kes" DECIMAL(14,2),
    "lower_inclusive" BOOLEAN NOT NULL,
    "upper_inclusive" BOOLEAN NOT NULL,
    "approver_label" TEXT NOT NULL,
    "source_rule_text" TEXT NOT NULL,

    CONSTRAINT "approval_tiers_pkey" PRIMARY KEY ("approval_policy_set_id","tier_ordinal")
);

-- CreateTable
CREATE TABLE "role_approval_authorities" (
    "role_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "approval_limit_kes" DECIMAL(14,2),

    CONSTRAINT "role_approval_authorities_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "policies" (
    "policy_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "review_date" DATE NOT NULL,
    "owner_role_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "business_unit" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("policy_id")
);

-- CreateTable
CREATE TABLE "policy_sections" (
    "policy_id" TEXT NOT NULL,
    "section_ordinal" INTEGER NOT NULL,
    "heading" TEXT NOT NULL,
    "source_heading" TEXT NOT NULL,
    "body_markdown" TEXT NOT NULL,

    CONSTRAINT "policy_sections_pkey" PRIMARY KEY ("policy_id","section_ordinal")
);

-- CreateTable
CREATE TABLE "policy_relationships" (
    "policy_id" TEXT NOT NULL,
    "related_policy_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "policy_relationships_pkey" PRIMARY KEY ("policy_id","related_policy_id")
);

-- CreateTable
CREATE TABLE "policy_systems" (
    "policy_id" TEXT NOT NULL,
    "system_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "policy_systems_pkey" PRIMARY KEY ("policy_id","system_id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "scenario_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "business_context" TEXT NOT NULL,
    "expected_outcome" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "question_types" JSONB NOT NULL,
    "tags" JSONB NOT NULL,
    "relevant_facts" JSONB NOT NULL,
    "required_reasoning" JSONB NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("scenario_id")
);

-- CreateTable
CREATE TABLE "scenario_actors" (
    "scenario_id" TEXT NOT NULL,
    "actor_ordinal" INTEGER NOT NULL,
    "employee_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role_title" TEXT NOT NULL,

    CONSTRAINT "scenario_actors_pkey" PRIMARY KEY ("scenario_id","actor_ordinal")
);

-- CreateTable
CREATE TABLE "scenario_entities" (
    "scenario_id" TEXT NOT NULL,
    "entity_ordinal" INTEGER NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "source_ordinal" INTEGER,
    "company_id" TEXT,
    "department_id" TEXT,
    "role_id" TEXT,
    "employee_id" TEXT,
    "location_id" TEXT,
    "system_id" TEXT,
    "cost_center_id" TEXT,
    "warehouse_id" TEXT,
    "supplier_id" TEXT,
    "product_id" TEXT,
    "customer_id" TEXT,
    "inventory_id" TEXT,
    "policy_id" TEXT,

    CONSTRAINT "scenario_entities_pkey" PRIMARY KEY ("scenario_id","entity_ordinal")
);

-- CreateTable
CREATE TABLE "scenario_events" (
    "scenario_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "event" TEXT NOT NULL,

    CONSTRAINT "scenario_events_pkey" PRIMARY KEY ("scenario_id","sequence")
);

-- CreateTable
CREATE TABLE "scenario_relationships" (
    "scenario_id" TEXT NOT NULL,
    "relationship_ordinal" INTEGER NOT NULL,
    "from_entity_ordinal" INTEGER NOT NULL,
    "to_entity_ordinal" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "from_source_id" TEXT NOT NULL,
    "to_source_id" TEXT NOT NULL,

    CONSTRAINT "scenario_relationships_pkey" PRIMARY KEY ("scenario_id","relationship_ordinal")
);

-- CreateTable
CREATE TABLE "evaluation_questions" (
    "question_id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "answerability" TEXT NOT NULL,
    "expected_answer" TEXT NOT NULL,
    "expected_behavior" TEXT NOT NULL,
    "acceptable_answer_points" JSONB NOT NULL,
    "reasoning_steps" JSONB NOT NULL,
    "tags" JSONB NOT NULL,

    CONSTRAINT "evaluation_questions_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "evaluation_question_sources" (
    "question_id" TEXT NOT NULL,
    "reference_kind" TEXT NOT NULL,
    "source_ordinal" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "section" TEXT,
    "policy_section_ordinal" INTEGER,
    "company_id" TEXT,
    "department_id" TEXT,
    "role_id" TEXT,
    "employee_id" TEXT,
    "location_id" TEXT,
    "system_id" TEXT,
    "cost_center_id" TEXT,
    "warehouse_id" TEXT,
    "supplier_id" TEXT,
    "product_id" TEXT,
    "customer_id" TEXT,
    "inventory_id" TEXT,
    "policy_id" TEXT,
    "scenario_id" TEXT,

    CONSTRAINT "evaluation_question_sources_pkey" PRIMARY KEY ("question_id","reference_kind","source_ordinal")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_registration_number_key" ON "companies"("registration_number");

-- CreateIndex
CREATE UNIQUE INDEX "companies_kra_pin_key" ON "companies"("kra_pin");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_cost_center_id_key" ON "departments"("cost_center_id");

-- CreateIndex
CREATE INDEX "departments_department_head_role_id_idx" ON "departments"("department_head_role_id");

-- CreateIndex
CREATE INDEX "roles_department_id_idx" ON "roles"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_number_key" ON "employees"("employee_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_role_id_idx" ON "employees"("role_id");

-- CreateIndex
CREATE INDEX "employees_department_id_idx" ON "employees"("department_id");

-- CreateIndex
CREATE INDEX "employees_manager_employee_id_idx" ON "employees"("manager_employee_id");

-- CreateIndex
CREATE INDEX "employees_location_id_idx" ON "employees"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "systems_name_key" ON "systems"("name");

-- CreateIndex
CREATE INDEX "systems_owning_department_id_idx" ON "systems"("owning_department_id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_code_key" ON "cost_centers"("code");

-- CreateIndex
CREATE INDEX "cost_centers_department_id_idx" ON "cost_centers"("department_id");

-- CreateIndex
CREATE INDEX "cost_centers_manager_employee_id_idx" ON "cost_centers"("manager_employee_id");

-- CreateIndex
CREATE INDEX "cost_centers_location_id_idx" ON "cost_centers"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "warehouses_location_id_idx" ON "warehouses"("location_id");

-- CreateIndex
CREATE INDEX "warehouses_manager_employee_id_idx" ON "warehouses"("manager_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_supplier_code_key" ON "suppliers"("supplier_code");

-- CreateIndex
CREATE INDEX "suppliers_relationship_owner_employee_id_idx" ON "suppliers"("relationship_owner_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_code_key" ON "customers"("customer_code");

-- CreateIndex
CREATE INDEX "customers_account_manager_employee_id_idx" ON "customers"("account_manager_employee_id");

-- CreateIndex
CREATE INDEX "inventory_warehouse_id_idx" ON "inventory"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_product_id_warehouse_id_key" ON "inventory"("product_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "policy_relationships_policy_id_ordinal_key" ON "policy_relationships"("policy_id", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "policy_systems_policy_id_ordinal_key" ON "policy_systems"("policy_id", "ordinal");

-- CreateIndex
CREATE INDEX "scenario_actors_employee_id_idx" ON "scenario_actors"("employee_id");

-- CreateIndex
CREATE INDEX "scenario_entities_source_type_source_id_idx" ON "scenario_entities"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_questions_question_key" ON "evaluation_questions"("question");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_headquarters_location_id_fkey" FOREIGN KEY ("headquarters_location_id") REFERENCES "locations"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- departments <-> roles is cyclic (a department names its head role; a role
-- names its department), so departments must be inserted before its head
-- role exists. DEFERRABLE INITIALLY DEFERRED lets the seed transaction
-- insert departments, then roles, then cost_centers and only checks these
-- two FKs at COMMIT. See docs/database/architecture.md and
-- docs/data-model/business-rules.md ("staged loading or deferred FK checks").
ALTER TABLE "departments" ADD CONSTRAINT "departments_department_head_role_id_fkey" FOREIGN KEY ("department_head_role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- AddForeignKey
-- departments <-> cost_centers is the same kind of cycle (a department's
-- default cost center; a cost center's owning department).
ALTER TABLE "departments" ADD CONSTRAINT "departments_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("cost_center_id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "systems" ADD CONSTRAINT "systems_owning_department_id_fkey" FOREIGN KEY ("owning_department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_system_access" ADD CONSTRAINT "role_system_access_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_system_access" ADD CONSTRAINT "role_system_access_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "systems"("system_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_relationship_owner_employee_id_fkey" FOREIGN KEY ("relationship_owner_employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_account_manager_employee_id_fkey" FOREIGN KEY ("account_manager_employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("warehouse_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_policy_sets" ADD CONSTRAINT "approval_policy_sets_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("policy_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_tiers" ADD CONSTRAINT "approval_tiers_approval_policy_set_id_fkey" FOREIGN KEY ("approval_policy_set_id") REFERENCES "approval_policy_sets"("approval_policy_set_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_approval_authorities" ADD CONSTRAINT "role_approval_authorities_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_owner_role_id_fkey" FOREIGN KEY ("owner_role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_sections" ADD CONSTRAINT "policy_sections_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("policy_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_relationships" ADD CONSTRAINT "policy_relationships_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("policy_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_relationships" ADD CONSTRAINT "policy_relationships_related_policy_id_fkey" FOREIGN KEY ("related_policy_id") REFERENCES "policies"("policy_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_systems" ADD CONSTRAINT "policy_systems_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("policy_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_systems" ADD CONSTRAINT "policy_systems_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "systems"("system_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_actors" ADD CONSTRAINT "scenario_actors_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("scenario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_actors" ADD CONSTRAINT "scenario_actors_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_actors" ADD CONSTRAINT "scenario_actors_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_actors" ADD CONSTRAINT "scenario_actors_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("scenario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "systems"("system_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("cost_center_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("warehouse_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventory"("inventory_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("policy_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_events" ADD CONSTRAINT "scenario_events_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("scenario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_relationships" ADD CONSTRAINT "scenario_relationships_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("scenario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_relationships" ADD CONSTRAINT "scenario_relationships_scenario_id_from_entity_ordinal_fkey" FOREIGN KEY ("scenario_id", "from_entity_ordinal") REFERENCES "scenario_entities"("scenario_id", "entity_ordinal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_relationships" ADD CONSTRAINT "scenario_relationships_scenario_id_to_entity_ordinal_fkey" FOREIGN KEY ("scenario_id", "to_entity_ordinal") REFERENCES "scenario_entities"("scenario_id", "entity_ordinal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "evaluation_questions"("question_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "systems"("system_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("cost_center_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("warehouse_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventory"("inventory_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("policy_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("scenario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_policy_id_policy_section_ordin_fkey" FOREIGN KEY ("policy_id", "policy_section_ordinal") REFERENCES "policy_sections"("policy_id", "section_ordinal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-authored constraints: Prisma's schema language has no declarative
-- CHECK-constraint or partial-index syntax, so these are added directly here
-- rather than in schema.prisma. See docs/database/architecture.md. Because
-- they aren't modeled in schema.prisma, a future `prisma migrate dev` diff
-- will not try to remove them.

-- CreateCheck
ALTER TABLE "products" ADD CONSTRAINT "products_unit_cost_check" CHECK ("unit_cost" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_selling_price_check" CHECK ("selling_price" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_reorder_level_check" CHECK ("reorder_level" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_reorder_quantity_check" CHECK ("reorder_quantity" >= 0);

ALTER TABLE "customers" ADD CONSTRAINT "customers_credit_limit_check" CHECK ("credit_limit" >= 0);

ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_capacity_units_check" CHECK ("capacity_units" >= 0);

ALTER TABLE "inventory" ADD CONSTRAINT "inventory_quantity_on_hand_check" CHECK ("quantity_on_hand" >= 0);
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_quantity_reserved_check" CHECK ("quantity_reserved" >= 0);
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_quantity_available_check" CHECK ("quantity_available" >= 0);
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_reorder_level_check" CHECK ("reorder_level" >= 0);
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_reorder_quantity_check" CHECK ("reorder_quantity" >= 0);
-- Strongest safe representation of the on_hand/reserved/available invariant.
-- A true `GENERATED ALWAYS AS (...) STORED` column was considered but
-- rejected: Prisma has no declarative support for computed columns, so a
-- hand-maintained one would fight every future `prisma migrate dev` diff.
-- A CHECK constraint gets the same guarantee (any write that violates the
-- invariant is rejected) without that maintenance cost.
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_quantity_available_formula_check" CHECK ("quantity_available" = "quantity_on_hand" - "quantity_reserved");

ALTER TABLE "role_approval_authorities" ADD CONSTRAINT "role_approval_authorities_limit_check" CHECK ("approval_limit_kes" IS NULL OR "approval_limit_kes" >= 0);

ALTER TABLE "approval_tiers" ADD CONSTRAINT "approval_tiers_ordinal_check" CHECK ("tier_ordinal" > 0);
ALTER TABLE "approval_tiers" ADD CONSTRAINT "approval_tiers_lower_bound_check" CHECK ("lower_bound_kes" IS NULL OR "lower_bound_kes" >= 0);
ALTER TABLE "approval_tiers" ADD CONSTRAINT "approval_tiers_upper_bound_check" CHECK ("upper_bound_kes" IS NULL OR "upper_bound_kes" >= 0);
ALTER TABLE "approval_tiers" ADD CONSTRAINT "approval_tiers_bounds_order_check" CHECK ("lower_bound_kes" IS NULL OR "upper_bound_kes" IS NULL OR "lower_bound_kes" <= "upper_bound_kes");

ALTER TABLE "policy_sections" ADD CONSTRAINT "policy_sections_ordinal_check" CHECK ("section_ordinal" > 0);
ALTER TABLE "policy_relationships" ADD CONSTRAINT "policy_relationships_ordinal_check" CHECK ("ordinal" > 0);
ALTER TABLE "policy_relationships" ADD CONSTRAINT "policy_relationships_not_self_check" CHECK ("policy_id" <> "related_policy_id");
ALTER TABLE "policy_systems" ADD CONSTRAINT "policy_systems_ordinal_check" CHECK ("ordinal" > 0);

ALTER TABLE "scenario_actors" ADD CONSTRAINT "scenario_actors_ordinal_check" CHECK ("actor_ordinal" > 0);
ALTER TABLE "scenario_events" ADD CONSTRAINT "scenario_events_sequence_check" CHECK ("sequence" > 0);
ALTER TABLE "scenario_relationships" ADD CONSTRAINT "scenario_relationships_ordinal_check" CHECK ("relationship_ordinal" > 0);

ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_ordinal_check" CHECK ("entity_ordinal" > 0);
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_source_ordinal_check" CHECK ("source_ordinal" IS NULL OR "source_ordinal" > 0);
-- Exactly one typed target per row (docs/data-model/evaluation-model.md,
-- business-rules.md "typed knowledge references ... plus an exactly-one-target CHECK").
ALTER TABLE "scenario_entities" ADD CONSTRAINT "scenario_entities_exactly_one_target_check" CHECK (
  (CASE WHEN "company_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "department_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "role_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "employee_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "location_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "system_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "cost_center_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "warehouse_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "supplier_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "product_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "customer_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "inventory_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "policy_id" IS NOT NULL THEN 1 ELSE 0 END)
  = 1
);

ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_ordinal_check" CHECK ("source_ordinal" > 0);
ALTER TABLE "evaluation_question_sources" ADD CONSTRAINT "evaluation_question_sources_exactly_one_target_check" CHECK (
  (CASE WHEN "company_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "department_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "role_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "employee_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "location_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "system_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "cost_center_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "warehouse_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "supplier_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "product_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "customer_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "inventory_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "policy_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "scenario_id" IS NOT NULL THEN 1 ELSE 0 END)
  = 1
);

-- CreateIndex (partial; not expressible as a Prisma @@index)
-- scenario_entities uniqueness differs by origin (evaluation-model.md):
-- source-array rows are unique per (scenario, origin, source_ordinal);
-- derived relationship-endpoint rows instead have no source_ordinal and are
-- unique per canonical target within the scenario.
CREATE UNIQUE INDEX "scenario_entities_origin_ordinal_key" ON "scenario_entities"("scenario_id", "origin", "source_ordinal") WHERE "origin" <> 'relationship_endpoint';
CREATE UNIQUE INDEX "scenario_entities_derived_target_key" ON "scenario_entities"("scenario_id", "source_type", "source_id") WHERE "origin" = 'relationship_endpoint';
