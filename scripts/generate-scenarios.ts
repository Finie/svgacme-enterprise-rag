/**
 * generate-scenarios.ts
 *
 * Script 5 of the SVGA Enterprise pipeline. Generates realistic, grounded
 * business scenarios by traversing the enterprise graph already produced by
 * Scripts 1-4:
 *
 *   data/enterprise/   (company, departments, roles, employees, locations, systems)
 *   data/master-data/  (cost centers, warehouses, suppliers, products, customers, inventory)
 *   data/policies/      (15 markdown policy documents)
 *
 * This script does NOT invent employees, suppliers, customers, products,
 * warehouses, systems, departments, roles or policies. Every actor and
 * entity referenced by a scenario is resolved from the files above and
 * validated before anything is written. Scenario-specific values (a
 * requested quantity, an expense amount, an incident description) may be
 * introduced, but must never contradict canonical state.
 *
 * No LLM or external API is used. All narrative text is produced by
 * deterministic template functions over real data, so the output is
 * reproducible: running this script twice against an unchanged corpus
 * produces byte-identical scenario files.
 *
 * Usage:
 *   npx tsx scripts/generate-scenarios.ts
 *   npm run generate:scenarios
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const ENTERPRISE_DIR = resolve(PROJECT_ROOT, 'data', 'enterprise');
const MASTER_DATA_DIR = resolve(PROJECT_ROOT, 'data', 'master-data');
const POLICIES_DIR = resolve(PROJECT_ROOT, 'data', 'policies');
const SCENARIOS_DIR = resolve(PROJECT_ROOT, 'data', 'scenarios');

// ---------------------------------------------------------------------------
// Enterprise / master-data / policy types (read-only inputs)
// ---------------------------------------------------------------------------

interface Company {
  companyId: string;
  legalName: string;
  tradingName: string;
}

interface Department {
  departmentId: string;
  name: string;
  description: string;
  departmentHeadRoleId: string;
  costCenterCode: string;
  status: string;
}

interface RoleApprovalAuthority {
  description: string;
  approvalLimitKes: number | null;
}

interface Role {
  roleId: string;
  title: string;
  departmentId: string;
  level: string;
  description: string;
  approvalAuthority: RoleApprovalAuthority | null;
}

interface Employee {
  employeeId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  roleId: string;
  departmentId: string;
  managerEmployeeId: string | null;
  locationId: string;
  employmentType: string;
  employmentStatus: string;
  hireDate: string;
  businessProcesses: string[];
}

interface Location {
  locationId: string;
  name: string;
  type: string;
  city: string;
  county: string;
  country: string;
  status: string;
}

interface EnterpriseSystem {
  systemId: string;
  name: string;
  vendor: string;
  category: string;
  owningDepartmentId: string;
  criticality: string;
  status: string;
}

interface CostCenter {
  costCenterId: string;
  code: string;
  name: string;
  departmentId: string;
  managerEmployeeId: string;
  locationId: string;
  status: string;
}

interface Warehouse {
  warehouseId: string;
  code: string;
  name: string;
  locationId: string;
  city: string;
  warehouseType: string;
  managerEmployeeId: string;
  capacityUnits: number;
  status: string;
}

interface Supplier {
  supplierId: string;
  supplierCode: string;
  legalName: string;
  tradingName: string;
  supplierCategory: string;
  city: string;
  country: string;
  paymentTerms: string;
  currency: string;
  approvalStatus: string;
  riskRating: string;
  procurementCategory: string;
  relationshipOwnerEmployeeId: string;
  suppliedProductIds: string[];
  active: boolean;
}

interface Product {
  productId: string;
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  unitCost: number;
  sellingPrice: number;
  reorderLevel: number;
  reorderQuantity: number;
  supplierIds: string[];
  status: string;
}

interface Customer {
  customerId: string;
  customerCode: string;
  legalName: string;
  tradingName: string;
  customerType: string;
  city: string;
  county: string;
  creditLimit: number;
  paymentTerms: string;
  accountManagerEmployeeId: string;
  customerStatus: string;
  riskRating: string;
}

interface InventoryRecord {
  inventoryId: string;
  productId: string;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderLevel: number;
  reorderQuantity: number;
  inventoryStatus: string;
  lastStockCountDate: string;
}

interface Policy {
  policyId: string;
  title: string;
  ownerRoleId: string;
  department: string;
  systems: string[];
  fileName: string;
}

interface EnterpriseData {
  company: Company;
  departments: Department[];
  roles: Role[];
  employees: Employee[];
  locations: Location[];
  systems: EnterpriseSystem[];
}

interface MasterData {
  costCenters: CostCenter[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  products: Product[];
  customers: Customer[];
  inventory: InventoryRecord[];
}

// ---------------------------------------------------------------------------
// Scenario schema (this script's output)
// ---------------------------------------------------------------------------

type Difficulty = 'easy' | 'medium' | 'hard';

type ScenarioEntityType =
  | 'employee'
  | 'department'
  | 'role'
  | 'supplier'
  | 'customer'
  | 'product'
  | 'warehouse'
  | 'inventory'
  | 'costCenter'
  | 'system'
  | 'policy';

interface ScenarioActor {
  employeeId: string;
  name: string;
  roleId: string;
  departmentId: string;
  role: string;
}

interface ScenarioEntity {
  type: ScenarioEntityType;
  id: string;
  name: string;
}

interface ScenarioEvent {
  sequence: number;
  event: string;
}

interface ScenarioRelationship {
  from: string;
  type: string;
  to: string;
}

interface Scenario {
  id: string;
  category: string;
  title: string;
  description: string;
  businessContext: string;
  actors: ScenarioActor[];
  entities: ScenarioEntity[];
  systems: string[];
  policies: string[];
  events: ScenarioEvent[];
  expectedOutcome: string;
  relevantFacts: string[];
  requiredReasoning: string[];
  relationships: ScenarioRelationship[];
  difficulty: Difficulty;
  questionTypes: string[];
  tags: string[];
}

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

interface Indexes {
  company: Company;
  departments: Department[];
  roles: Role[];
  employees: Employee[];
  locations: Location[];
  systems: EnterpriseSystem[];
  policies: Policy[];
  costCenters: CostCenter[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  products: Product[];
  customers: Customer[];
  inventory: InventoryRecord[];

  departmentById: Map<string, Department>;
  roleById: Map<string, Role>;
  employeeById: Map<string, Employee>;
  locationById: Map<string, Location>;
  systemById: Map<string, EnterpriseSystem>;
  policyById: Map<string, Policy>;
  costCenterById: Map<string, CostCenter>;
  warehouseById: Map<string, Warehouse>;
  supplierById: Map<string, Supplier>;
  productById: Map<string, Product>;
  customerById: Map<string, Customer>;
  inventoryById: Map<string, InventoryRecord>;

  systemNameSet: Set<string>;
  globalIdSet: Set<string>;
}

function mustGet<T>(map: Map<string, T>, key: string, label: string): T {
  const value = map.get(key);
  if (!value) {
    throw new Error(`Reference resolution failed: no ${label} found for id "${key}"`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

async function loadEnterpriseData(): Promise<EnterpriseData> {
  const [company, departments, roles, employees, locations, systems] = await Promise.all([
    readJsonFile<Company>(resolve(ENTERPRISE_DIR, 'company.json')),
    readJsonFile<Department[]>(resolve(ENTERPRISE_DIR, 'departments.json')),
    readJsonFile<Role[]>(resolve(ENTERPRISE_DIR, 'roles.json')),
    readJsonFile<Employee[]>(resolve(ENTERPRISE_DIR, 'employees.json')),
    readJsonFile<Location[]>(resolve(ENTERPRISE_DIR, 'locations.json')),
    readJsonFile<EnterpriseSystem[]>(resolve(ENTERPRISE_DIR, 'systems.json')),
  ]);
  return { company, departments, roles, employees, locations, systems };
}

async function loadMasterData(): Promise<MasterData> {
  const [costCenters, warehouses, suppliers, products, customers, inventory] = await Promise.all([
    readJsonFile<CostCenter[]>(resolve(MASTER_DATA_DIR, 'cost-centers.json')),
    readJsonFile<Warehouse[]>(resolve(MASTER_DATA_DIR, 'warehouses.json')),
    readJsonFile<Supplier[]>(resolve(MASTER_DATA_DIR, 'suppliers.json')),
    readJsonFile<Product[]>(resolve(MASTER_DATA_DIR, 'products.json')),
    readJsonFile<Customer[]>(resolve(MASTER_DATA_DIR, 'customers.json')),
    readJsonFile<InventoryRecord[]>(resolve(MASTER_DATA_DIR, 'inventory.json')),
  ]);
  return { costCenters, warehouses, suppliers, products, customers, inventory };
}

/** Parses the metadata table at the top of each policy markdown file. */
async function loadPolicies(): Promise<Policy[]> {
  const files = (await readdir(POLICIES_DIR)).filter((f) => f.endsWith('.md')).sort();
  const policies: Policy[] = [];

  for (const fileName of files) {
    const raw = await readFile(resolve(POLICIES_DIR, fileName), 'utf-8');
    const field = (label: string): string => {
      const re = new RegExp(`\\|\\s*${label}\\s*\\|\\s*(.+?)\\s*\\|`);
      const match = raw.match(re);
      return match ? match[1].trim() : '';
    };

    const policyId = field('Document ID');
    if (!policyId) {
      throw new Error(`loadPolicies: could not find "Document ID" in ${fileName}`);
    }

    policies.push({
      policyId,
      title: field('Title'),
      ownerRoleId: field('Owner'),
      department: field('Department'),
      systems: field('System')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean),
      fileName,
    });
  }

  return policies;
}

function buildIndexes(enterprise: EnterpriseData, masterData: MasterData, policies: Policy[]): Indexes {
  const departmentById = new Map(enterprise.departments.map((d) => [d.departmentId, d]));
  const roleById = new Map(enterprise.roles.map((r) => [r.roleId, r]));
  const employeeById = new Map(enterprise.employees.map((e) => [e.employeeId, e]));
  const locationById = new Map(enterprise.locations.map((l) => [l.locationId, l]));
  const systemById = new Map(enterprise.systems.map((s) => [s.systemId, s]));
  const policyById = new Map(policies.map((p) => [p.policyId, p]));
  const costCenterById = new Map(masterData.costCenters.map((c) => [c.costCenterId, c]));
  const warehouseById = new Map(masterData.warehouses.map((w) => [w.warehouseId, w]));
  const supplierById = new Map(masterData.suppliers.map((s) => [s.supplierId, s]));
  const productById = new Map(masterData.products.map((p) => [p.productId, p]));
  const customerById = new Map(masterData.customers.map((c) => [c.customerId, c]));
  const inventoryById = new Map(masterData.inventory.map((i) => [i.inventoryId, i]));

  const systemNameSet = new Set(enterprise.systems.map((s) => s.name));

  const globalIdSet = new Set<string>([
    ...departmentById.keys(),
    ...roleById.keys(),
    ...employeeById.keys(),
    ...locationById.keys(),
    ...systemById.keys(),
    ...policyById.keys(),
    ...costCenterById.keys(),
    ...warehouseById.keys(),
    ...supplierById.keys(),
    ...productById.keys(),
    ...customerById.keys(),
    ...inventoryById.keys(),
  ]);

  return {
    company: enterprise.company,
    departments: enterprise.departments,
    roles: enterprise.roles,
    employees: enterprise.employees,
    locations: enterprise.locations,
    systems: enterprise.systems,
    policies,
    costCenters: masterData.costCenters,
    warehouses: masterData.warehouses,
    suppliers: masterData.suppliers,
    products: masterData.products,
    customers: masterData.customers,
    inventory: masterData.inventory,
    departmentById,
    roleById,
    employeeById,
    locationById,
    systemById,
    policyById,
    costCenterById,
    warehouseById,
    supplierById,
    productById,
    customerById,
    inventoryById,
    systemNameSet,
    globalIdSet,
  };
}

// ---------------------------------------------------------------------------
// Canonical shorthand constants (validated against loaded data in main())
// ---------------------------------------------------------------------------

const SYS = {
  FIN: 'SYS-D365-FIN',
  SALES: 'SYS-D365-SALES',
  SCM: 'SYS-D365-SCM',
  HR: 'SYS-HR',
  IAM: 'SYS-IAM',
  SD: 'SYS-SD',
  DMS: 'SYS-DMS',
} as const;

const DEPT = {
  EXEC: 'DEPT-EXEC',
  FIN: 'DEPT-FIN',
  HR: 'DEPT-HR',
  PROC: 'DEPT-PROC',
  SALES: 'DEPT-SALES',
  INV: 'DEPT-INV',
  WH: 'DEPT-WH',
  IT: 'DEPT-IT',
  COMP: 'DEPT-COMP',
  OPS: 'DEPT-OPS',
  LEGAL: 'DEPT-LEGAL',
  CS: 'DEPT-CS',
  ADMIN: 'DEPT-ADMIN',
} as const;

// ---------------------------------------------------------------------------
// Generic lookup / formatting helpers
// ---------------------------------------------------------------------------

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-US')}`;
}

function employeeName(e: Employee): string {
  return `${e.firstName} ${e.lastName}`;
}

function getDepartmentHeadEmployee(departmentId: string, indexes: Indexes): Employee {
  const department = mustGet(indexes.departmentById, departmentId, 'department');
  const employee = indexes.employees.find((e) => e.roleId === department.departmentHeadRoleId);
  if (!employee) {
    throw new Error(`No employee holds head role ${department.departmentHeadRoleId} for department ${departmentId}`);
  }
  return employee;
}

function getEmployeeByRoleId(roleId: string, indexes: Indexes): Employee {
  const employee = indexes.employees.find((e) => e.roleId === roleId);
  if (!employee) {
    throw new Error(`No employee found holding role ${roleId}`);
  }
  return employee;
}

function findInventory(indexes: Indexes, predicate: (r: InventoryRecord) => boolean): InventoryRecord[] {
  return indexes.inventory.filter(predicate);
}

/** Deterministically selects the nth match (stable file order); falls back to index 0 with a console note if too few matches exist rather than fabricating data. */
function nthMatch<T>(arr: T[], n: number, label: string): T {
  if (arr.length === 0) {
    throw new Error(`No records found for "${label}" - cannot build this scenario without real matching data.`);
  }
  if (n >= arr.length) {
    console.warn(`  note: only ${arr.length} record(s) matched "${label}"; reusing index 0 instead of requested index ${n}.`);
    return arr[0];
  }
  return arr[n];
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dupes.add(v);
    seen.add(v);
  }
  return Array.from(dupes);
}

// ---------------------------------------------------------------------------
// Approval matrix resolver (FIN-POL-002 matrix + role-specific limits)
// ---------------------------------------------------------------------------
//
// FIN-POL-002 sec.5.2: "up to and including KES 50,000, Department Manager;
// KES 50,001 to 500,000, Department Head; KES 500,001 to 2,000,000, Finance
// Manager; KES 2,000,001 to 10,000,000, CFO; above KES 10,000,000, CEO or
// Executive Committee. A role-specific authority may be lower and the lower
// limit applies."
//
// Our organisation has one management layer per department, so "Department
// Manager" and "Department Head" collapse to the same person: the
// department's own head-role employee. Each named tier's *effective* limit
// is the lower of the matrix ceiling and that tier's actual canonical
// approvalLimitKes (roles.json) - which is sometimes lower than the matrix
// ceiling (e.g. Finance Manager's own limit is KES 1,000,000, below the
// matrix's KES 2,000,000 ceiling for that tier), forcing escalation past
// what the matrix band alone would suggest.

type ApprovalTier = 'DEPARTMENT_HEAD' | 'FINANCE_MANAGER' | 'CFO' | 'CEO';

const MATRIX_CEILING_KES: Record<ApprovalTier, number | null> = {
  DEPARTMENT_HEAD: 500_000,
  FINANCE_MANAGER: 2_000_000,
  CFO: 10_000_000,
  CEO: null,
};

interface ApprovalStep {
  tier: ApprovalTier;
  employee: Employee;
  role: Role;
  personalLimitKes: number | null;
  effectiveLimitKes: number | null;
  sufficient: boolean;
}

interface ApprovalResolution {
  amountKes: number;
  requestingDepartmentId: string;
  steps: ApprovalStep[];
  approver: ApprovalStep;
}

function effectiveLimit(tier: ApprovalTier, personalLimitKes: number | null): number | null {
  const ceiling = MATRIX_CEILING_KES[tier];
  if (ceiling === null) return personalLimitKes;
  if (personalLimitKes === null) return ceiling;
  return Math.min(ceiling, personalLimitKes);
}

function resolveApproval(amountKes: number, requestingDepartmentId: string, indexes: Indexes): ApprovalResolution {
  const deptHead = getDepartmentHeadEmployee(requestingDepartmentId, indexes);
  const financeManager = getEmployeeByRoleId('ROLE-FIN-MGR', indexes);
  const cfo = getEmployeeByRoleId('ROLE-CFO', indexes);
  const ceo = getEmployeeByRoleId('ROLE-CEO', indexes);

  const ladder: Array<{ tier: ApprovalTier; employee: Employee }> = [
    { tier: 'DEPARTMENT_HEAD', employee: deptHead },
    { tier: 'FINANCE_MANAGER', employee: financeManager },
    { tier: 'CFO', employee: cfo },
    { tier: 'CEO', employee: ceo },
  ];

  const steps: ApprovalStep[] = ladder.map(({ tier, employee }) => {
    const role = mustGet(indexes.roleById, employee.roleId, 'role');
    const personalLimitKes = role.approvalAuthority ? role.approvalAuthority.approvalLimitKes : null;
    const limit = effectiveLimit(tier, personalLimitKes);
    return {
      tier,
      employee,
      role,
      personalLimitKes,
      effectiveLimitKes: limit,
      sufficient: limit === null || limit >= amountKes,
    };
  });

  const approver = steps.find((s) => s.sufficient) ?? steps[steps.length - 1];

  return { amountKes, requestingDepartmentId, steps, approver };
}

function approvalLadderFacts(res: ApprovalResolution): string[] {
  return res.steps.map((s) => {
    const limitText = s.personalLimitKes === null ? 'unlimited' : formatKes(s.personalLimitKes);
    return `${s.role.title} (${employeeName(s.employee)}) has an approval limit of ${limitText} per roles.json.`;
  });
}

// ---------------------------------------------------------------------------
// Scenario assembly
// ---------------------------------------------------------------------------

interface ScenarioParams {
  category: string;
  idPrefix: string;
  idNumber: number;
  title: string;
  description: string;
  businessContext: string;
  employeeIds: string[];
  entityRefs: Array<{ type: ScenarioEntityType; id: string }>;
  systemIds: string[];
  policyIds: string[];
  events: string[];
  expectedOutcome: string;
  relevantFacts: string[];
  requiredReasoning: string[];
  relationships: ScenarioRelationship[];
  difficulty: Difficulty;
  questionTypes: string[];
  tags: string[];
}

function makeActor(employeeId: string, indexes: Indexes): ScenarioActor {
  const employee = mustGet(indexes.employeeById, employeeId, 'employee');
  const role = mustGet(indexes.roleById, employee.roleId, 'role');
  return {
    employeeId: employee.employeeId,
    name: employeeName(employee),
    roleId: employee.roleId,
    departmentId: employee.departmentId,
    role: role.title,
  };
}

function makeEntity(type: ScenarioEntityType, id: string, indexes: Indexes): ScenarioEntity {
  switch (type) {
    case 'employee':
      return { type, id, name: employeeName(mustGet(indexes.employeeById, id, 'employee')) };
    case 'department':
      return { type, id, name: mustGet(indexes.departmentById, id, 'department').name };
    case 'role':
      return { type, id, name: mustGet(indexes.roleById, id, 'role').title };
    case 'supplier':
      return { type, id, name: mustGet(indexes.supplierById, id, 'supplier').tradingName };
    case 'customer':
      return { type, id, name: mustGet(indexes.customerById, id, 'customer').tradingName };
    case 'product':
      return { type, id, name: mustGet(indexes.productById, id, 'product').name };
    case 'warehouse':
      return { type, id, name: mustGet(indexes.warehouseById, id, 'warehouse').name };
    case 'inventory': {
      const rec = mustGet(indexes.inventoryById, id, 'inventory');
      return { type, id, name: `${rec.productId} @ ${rec.warehouseId}` };
    }
    case 'costCenter':
      return { type, id, name: mustGet(indexes.costCenterById, id, 'costCenter').name };
    case 'system':
      return { type, id, name: mustGet(indexes.systemById, id, 'system').name };
    case 'policy':
      return { type, id, name: mustGet(indexes.policyById, id, 'policy').title };
  }
}

function assembleScenario(p: ScenarioParams, indexes: Indexes): Scenario {
  const id = `SCN-${p.idPrefix}-${String(p.idNumber).padStart(3, '0')}`;

  const actors = p.employeeIds.map((eid) => makeActor(eid, indexes));

  const entities: ScenarioEntity[] = [];
  const seen = new Set<string>();
  const addEntity = (type: ScenarioEntityType, entityId: string) => {
    const key = `${type}:${entityId}`;
    if (seen.has(key)) return;
    seen.add(key);
    entities.push(makeEntity(type, entityId, indexes));
  };

  p.employeeIds.forEach((eid) => addEntity('employee', eid));
  p.entityRefs.forEach((ref) => addEntity(ref.type, ref.id));
  p.systemIds.forEach((sid) => addEntity('system', sid));
  p.policyIds.forEach((pid) => addEntity('policy', pid));

  const systemNames = p.systemIds.map((sid) => mustGet(indexes.systemById, sid, `system ${sid}`).name);
  const uniqueSystemNames = Array.from(new Set(systemNames));

  p.policyIds.forEach((pid) => mustGet(indexes.policyById, pid, `policy ${pid}`));

  const events: ScenarioEvent[] = p.events.map((event, i) => ({ sequence: i + 1, event }));

  return {
    id,
    category: p.category,
    title: p.title,
    description: p.description,
    businessContext: p.businessContext,
    actors,
    entities,
    systems: uniqueSystemNames,
    policies: p.policyIds,
    events,
    expectedOutcome: p.expectedOutcome,
    relevantFacts: p.relevantFacts,
    requiredReasoning: p.requiredReasoning,
    relationships: p.relationships,
    difficulty: p.difficulty,
    questionTypes: p.questionTypes,
    tags: p.tags,
  };
}

// ---------------------------------------------------------------------------
// Category 1: Onboarding
// ---------------------------------------------------------------------------

function generateOnboardingScenarios(indexes: Indexes): Scenario[] {
  const scenarios: Scenario[] = [];

  // A. New Finance employee onboarding (normal path)
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0034', 'employee');
    const manager = mustGet(indexes.employeeById, 'EMP-0012', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'onboarding',
          idPrefix: 'ONB',
          idNumber: 1,
          title: 'New Finance Analyst onboarding requires three system accounts',
          description: `${employeeName(employee)} has joined the Finance department as a Finance Analyst on a contract basis. HR has completed the onboarding record in the Employee Management System, and the role requires access to the department's core systems before the employee can begin transactional work.`,
          businessContext:
            'Finance Analysts process accounts payable and receivable transactions and require read/write access to the financial system of record, plus the systems used for HR self-service and policy documentation.',
          employeeIds: [employee.employeeId, manager.employeeId],
          entityRefs: [
            { type: 'department', id: DEPT.FIN },
            { type: 'role', id: employee.roleId },
          ],
          systemIds: [SYS.FIN, SYS.HR, SYS.DMS],
          policyIds: ['HR-POL-002', 'IT-POL-001'],
          events: [
            'HR completes the new-hire requisition and confirms the approved role, department and manager.',
            'HR creates the employee record in the Employee Management System using the canonical role and department data.',
            'HR supplies IT with the start date, approved role, manager and required access profile.',
            'IT provisions accounts through the Identity and Access Management System according to the Finance Analyst role profile.',
            'The employee completes induction, policy acknowledgement and equipment handover.',
          ],
          expectedOutcome:
            'The employee should receive a Finance Analyst access profile covering Microsoft Dynamics 365 Finance (read/write transactional and reconciliation access), the Employee Management System, and the Enterprise Document Management System - provisioned by IT from the HR onboarding record, not granted informally.',
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) holds role ${employee.roleId} (Finance Analyst) in department ${DEPT.FIN}.`,
            `${employeeName(manager)} (${manager.employeeId}) is the Finance Manager and ${employeeName(employee)}'s manager.`,
            'HR-POL-002 requires HR to supply IT with the start date, approved role, manager and required access profile; IT provisions accounts through the Identity and Access Management System.',
            'IT-POL-001 states that a Finance Analyst receives the Microsoft Dynamics 365 Finance read/write transactional and reconciliation profile, subject to segregation of duties, and does not receive Finance Manager approval rights by default.',
          ],
          requiredReasoning: [
            "Resolve the employee's canonical role and department.",
            'Identify the systems that role profile is entitled to under IT-POL-001.',
            'Confirm the HR-to-IT handoff sequence required by HR-POL-002 before access is granted.',
            'Distinguish the access this role is entitled to from Finance Manager-level rights, which are not included by default.',
          ],
          relationships: [
            { from: employee.employeeId, type: 'reports_to', to: manager.employeeId },
            { from: employee.employeeId, type: 'belongs_to', to: DEPT.FIN },
            { from: employee.employeeId, type: 'holds_role', to: employee.roleId },
          ],
          difficulty: 'easy',
          questionTypes: ['fact_lookup', 'policy_lookup', 'workflow'],
          tags: ['onboarding', 'finance', 'it-access', 'hr'],
        },
        indexes,
      ),
    );
  }

  // B. Sales employee onboarded but cannot access D365 Sales
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0020', 'employee');
    const manager = mustGet(indexes.employeeById, 'EMP-0005', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'onboarding',
          idPrefix: 'ONB',
          idNumber: 2,
          title: 'Sales Representative completed onboarding but cannot log in to Dynamics 365 Sales',
          description: `${employeeName(employee)} is a Sales Representative based at the Nakuru Regional Office. HR onboarding was completed and induction is finished, but the employee reports being unable to access Microsoft Dynamics 365 Sales and cannot create quotations for customers.`,
          businessContext:
            'Sales Representatives use Microsoft Dynamics 365 Sales daily to manage leads, opportunities and sales orders. A missing account blocks day-one productivity for a customer-facing role.',
          employeeIds: [employee.employeeId, manager.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.SALES }],
          systemIds: [SYS.SALES, SYS.SD, SYS.IAM],
          policyIds: ['HR-POL-002', 'IT-POL-001', 'IT-POL-002'],
          events: [
            "HR confirms the employee's onboarding record is complete in the Employee Management System.",
            'The employee attempts to log in to Microsoft Dynamics 365 Sales and is denied access.',
            'The employee raises a ticket in the IT Service Desk describing the affected system and impact.',
            'The service desk verifies the HR onboarding record before routing an access correction.',
            'IT-POL-001 determines the access correction is handled as a role-based provisioning gap, not a new request.',
          ],
          expectedOutcome:
            'This is a provisioning gap, not a new access request: per HR-POL-002, the service desk verifies the HR onboarding record and routes an access correction under IT-POL-001 so the existing Sales Representative profile is applied without requiring fresh manager approval.',
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) holds role ${employee.roleId} in department ${DEPT.SALES}, reporting to ${employeeName(manager)}.`,
            'HR-POL-002 states that a new employee who cannot access an assigned system must raise a ticket in the IT Service Desk, which verifies the HR onboarding record and routes an access correction under IT-POL-001.',
            'IT-POL-001 states that Sales access follows the role profile and business need already present in the enterprise data - it is not granted informally.',
          ],
          requiredReasoning: [
            'Confirm the HR onboarding record for this employee is complete.',
            'Determine whether this is a new access request or a provisioning gap for an already-approved role.',
            'Identify which policy governs the service desk ticket and which policy governs the underlying access correction.',
          ],
          relationships: [
            { from: employee.employeeId, type: 'reports_to', to: manager.employeeId },
            { from: employee.employeeId, type: 'belongs_to', to: DEPT.SALES },
          ],
          difficulty: 'medium',
          questionTypes: ['workflow', 'policy_lookup', 'exception'],
          tags: ['onboarding', 'sales', 'it-access', 'negative'],
        },
        indexes,
      ),
    );
  }

  // C. Employee separation: access not revoked in time
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0030', 'employee');
    const manager = mustGet(indexes.employeeById, 'EMP-0011', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'onboarding',
          idPrefix: 'ONB',
          idNumber: 3,
          title: 'A separated employee is found to still have active system access',
          description: `${employeeName(manager)}, the Administration department head, notified HR that ${employeeName(employee)}'s employment ended two weeks ago. During a routine access review, IT found the employee's Identity and Access Management System account and Enterprise Document Management System access are still enabled.`,
          businessContext:
            'HR-POL-002 requires HR to notify IT before an employee\'s effective end date so access can be disabled promptly; IT-POL-001 requires IT to disable access when HR records a termination.',
          employeeIds: [employee.employeeId, manager.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.ADMIN }],
          systemIds: [SYS.IAM, SYS.DMS, SYS.SD],
          policyIds: ['HR-POL-002', 'IT-POL-001', 'IT-POL-002', 'COMP-POL-001'],
          events: [
            "The manager confirms to HR that the employee's last working day has passed.",
            'A scheduled IT-POL-001 access review is run across active accounts.',
            "The review finds the employee's Identity and Access Management System account is still enabled.",
            "The review finds the employee's Enterprise Document Management System access has not been revoked.",
            'The reviewer must decide whether this is a routine correction or a reportable control failure.',
          ],
          expectedOutcome:
            "This is a control failure, not a routine ticket: HR-POL-002 required IT to be notified before the effective end date and IT-POL-001 required prompt disablement. The account must be disabled immediately, the gap window investigated as a possible unauthorised-access exposure under COMP-POL-001, and the failure logged for root-cause review rather than silently closed.",
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) belongs to department ${DEPT.ADMIN}; the canonical enterprise record in data/enterprise/employees.json currently shows this employee as ACTIVE, and the scenario tests the actions required once HR confirms separation.`,
            "HR-POL-002 states: 'When employment ends... HR notifies IT before the effective time where practicable. IT disables or changes access through the Identity and Access Management System, recovers equipment and preserves records.'",
            "IT-POL-001 states: 'When HR records termination or transfer, IT disables, changes or recertifies access promptly.'",
            'IT-POL-002 requires a suspected unauthorised-access exposure to be escalated and investigated, with COMP-POL-001 governing any personal-data exposure risk during the gap window.',
          ],
          requiredReasoning: [
            'Identify which policy obligates HR to notify IT of a separation, and by when.',
            'Identify which policy obligates IT to act on that notification.',
            'Determine whether continued access after notification represents normal processing time or a control failure.',
            'Identify the escalation path for a suspected unauthorised-access exposure.',
          ],
          relationships: [
            { from: employee.employeeId, type: 'reports_to', to: manager.employeeId },
            { from: employee.employeeId, type: 'belongs_to', to: DEPT.ADMIN },
          ],
          difficulty: 'hard',
          questionTypes: ['exception', 'compliance', 'multi_hop'],
          tags: ['onboarding', 'offboarding', 'it-access', 'negative', 'compliance'],
        },
        indexes,
      ),
    );
  }

  // D. New employee requires equipment and system access
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0037', 'employee');
    const manager = mustGet(indexes.employeeById, 'EMP-0022', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'onboarding',
          idPrefix: 'ONB',
          idNumber: 4,
          title: 'Kisumu Distribution Centre onboarding requires a handheld scanner and WMS access',
          description: `${employeeName(employee)} is a Warehouse Officer assigned to the Kisumu Distribution Centre. Onboarding requires a handheld scanning device costing approximately ${formatKes(
            250_000,
          )} for the site plus Microsoft Dynamics 365 Supply Chain Management access before the employee can process goods receipts.`,
          businessContext:
            'Warehouse Officers record goods receipt, picking, packing and dispatch transactions directly in the warehouse management module; equipment and system access are both prerequisites for the role.',
          employeeIds: [employee.employeeId, manager.employeeId],
          entityRefs: [
            { type: 'department', id: DEPT.WH },
            { type: 'warehouse', id: 'WH-KSM-001' },
          ],
          systemIds: [SYS.SCM, SYS.SD, SYS.IAM],
          policyIds: ['HR-POL-002', 'IT-POL-001'],
          events: [
            'HR completes onboarding, including equipment handover requirements, in the Employee Management System.',
            'The site raises an IT Service Desk ticket for the handheld scanning equipment.',
            'IT provisions Microsoft Dynamics 365 Supply Chain Management warehouse-module access for the Warehouse Officer role.',
            'The Warehouse Manager confirms the employee can record a test goods-receipt transaction before go-live.',
          ],
          expectedOutcome:
            'Equipment procurement for onboarding follows the standard IT Service Desk request path; system access follows the Warehouse Officer role profile under IT-POL-001. Both must be confirmed working before the employee is relied upon for goods-receipt transactions.',
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) holds role ${employee.roleId} at warehouse WH-KSM-001, reporting to ${employeeName(manager)} (${manager.employeeId}).`,
            'HR-POL-002 includes equipment handover as part of onboarding.',
            'IT-POL-001 states that Warehouse access follows the role profile and business need in the enterprise data.',
          ],
          requiredReasoning: [
            "Identify the employee's warehouse and role.",
            'Separate the equipment-provisioning step from the system-access step.',
            'Confirm both are prerequisites before the employee can process transactions independently.',
          ],
          relationships: [
            { from: employee.employeeId, type: 'reports_to', to: manager.employeeId },
            { from: employee.employeeId, type: 'works_at', to: 'WH-KSM-001' },
          ],
          difficulty: 'easy',
          questionTypes: ['fact_lookup', 'workflow'],
          tags: ['onboarding', 'warehouse', 'it-access', 'equipment'],
        },
        indexes,
      ),
    );
  }

  // E. Manager submits access request with insufficient justification
  {
    const manager = mustGet(indexes.employeeById, 'EMP-0007', 'employee');
    const employee = mustGet(indexes.employeeById, 'EMP-0024', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'onboarding',
          idPrefix: 'ONB',
          idNumber: 5,
          title: 'IT Manager requests elevated Finance approval rights for an IT Support Officer without justification',
          description: `${employeeName(manager)} (IT Manager) submitted a request to grant ${employeeName(
            employee,
          )}, an IT Support Officer, Finance Manager-level approval rights in Microsoft Dynamics 365 Finance "to help cover Finance during a busy period". No business need, role change or Finance Manager sign-off accompanies the request.`,
          businessContext:
            'IT-POL-001 requires access to be mapped to canonical role duties on a least-privilege basis; access is not granted because a colleague, even a manager, requests it informally.',
          employeeIds: [manager.employeeId, employee.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.IT }],
          systemIds: [SYS.IAM, SYS.FIN],
          policyIds: ['IT-POL-001'],
          events: [
            'The IT Manager submits an access-change request for the IT Support Officer.',
            'The request asks for Finance Manager-level approval rights in Microsoft Dynamics 365 Finance.',
            "No change to the employee's canonical role or department accompanies the request.",
            'IT reviews the request against the role-based access policy before acting.',
          ],
          expectedOutcome:
            "The request should be rejected as submitted. IT-POL-001 maps access to canonical role duties on a least-privilege basis; an IT Support Officer's role profile does not include Finance approval rights, and a manager's informal request is explicitly insufficient grounds to grant them. A formal role change and Finance Manager sign-off would be required first.",
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) holds role ${employee.roleId} (IT Support Officer) in department ${DEPT.IT}.`,
            `${employeeName(manager)} (${manager.employeeId}) holds role ${manager.roleId} (IT Manager) and is the requester.`,
            "IT-POL-001 states: 'IT maps role duties to least-privilege access; access is not granted because a colleague requests it informally,' and role-based profiles align with canonical roles.",
          ],
          requiredReasoning: [
            "Compare the requested access against the employee's canonical role profile.",
            'Determine whether an informal request from a manager, without a role change, satisfies the access-control policy.',
            'Identify what would be required to legitimately grant the requested access.',
          ],
          relationships: [{ from: employee.employeeId, type: 'belongs_to', to: DEPT.IT }],
          difficulty: 'medium',
          questionTypes: ['exception', 'policy_lookup', 'recommendation'],
          tags: ['onboarding', 'it-access', 'negative', 'least-privilege'],
        },
        indexes,
      ),
    );
  }

  // F. Procurement Officer onboarding and segregation of duties
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0015', 'employee');
    const manager = mustGet(indexes.employeeById, 'EMP-0004', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'onboarding',
          idPrefix: 'ONB',
          idNumber: 6,
          title: 'Procurement Officer onboarding must respect segregation of duties from day one',
          description: `${employeeName(
            employee,
          )} has completed onboarding as a Procurement Officer. The role profile requires Microsoft Dynamics 365 Supply Chain Management access to raise purchase requisitions and orders, but the access design must not allow the same person to also approve or receive goods against their own purchase orders.`,
          businessContext:
            'PROC-POL-001 requires that the requester, approver and receiver of a purchase are not the same person; access provisioning must reflect this from the outset rather than being corrected after an incident.',
          employeeIds: [employee.employeeId, manager.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.PROC }],
          systemIds: [SYS.SCM, SYS.HR, SYS.IAM],
          policyIds: ['HR-POL-002', 'IT-POL-001', 'PROC-POL-001'],
          events: [
            'HR completes the onboarding record for the new Procurement Officer.',
            'IT provisions Microsoft Dynamics 365 Supply Chain Management access scoped to requisitions and purchase orders.',
            'The Procurement Manager confirms the access profile does not include approval or goods-receipt permissions.',
            'The employee begins raising purchase requisitions under supervision.',
          ],
          expectedOutcome:
            "The access profile granted to the Procurement Officer role must exclude approval and goods-receipt permissions, since PROC-POL-001 requires the requester, approver and receiver of a purchase to be separated. Approval remains with the Procurement Manager or the Finance approval matrix, and receiving remains with Warehouse.",
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) holds role ${employee.roleId} (Procurement Officer) in department ${DEPT.PROC}, reporting to ${employeeName(manager)}.`,
            "PROC-POL-001 states: 'The requester must not select, receive and approve the same purchase.'",
            'IT-POL-001 requires access profiles to be scoped to the canonical role, which for Procurement Officer covers creating and editing purchase requisitions and purchase orders only.',
          ],
          requiredReasoning: [
            "Identify the Procurement Officer role's canonical system access profile.",
            'Identify the segregation-of-duties requirement in PROC-POL-001.',
            'Determine which permissions must be excluded from this role to satisfy that requirement.',
          ],
          relationships: [
            { from: employee.employeeId, type: 'reports_to', to: manager.employeeId },
            { from: employee.employeeId, type: 'belongs_to', to: DEPT.PROC },
          ],
          difficulty: 'medium',
          questionTypes: ['policy_lookup', 'workflow', 'compliance'],
          tags: ['onboarding', 'procurement', 'segregation-of-duties'],
        },
        indexes,
      ),
    );
  }

  return scenarios;
}

// ---------------------------------------------------------------------------
// Category 2: Procurement
// ---------------------------------------------------------------------------

function generateProcurementScenarios(indexes: Indexes): Scenario[] {
  const scenarios: Scenario[] = [];

  // A. Normal low-value procurement (KES 25,000)
  {
    const amount = 25_000;
    const requester = mustGet(indexes.employeeById, 'EMP-0011', 'employee');
    const supplier = mustGet(indexes.supplierById, 'SUP-011', 'supplier');
    const costCenter = mustGet(indexes.costCenterById, 'CC-ADMIN', 'costCenter');
    const approval = resolveApproval(amount, DEPT.ADMIN, indexes);
    scenarios.push(
      assembleScenario(
        {
          category: 'procurement',
          idPrefix: 'PROC',
          idNumber: 1,
          title: `Routine office-supplies purchase of ${formatKes(amount)} from an approved supplier`,
          description: `The Administration department needs stationery and printing consumables costing ${formatKes(
            amount,
          )} from ${supplier.tradingName}, an approved office-supplies vendor. ${employeeName(
            requester,
          )} raises the purchase request against cost centre ${costCenter.costCenterId}.`,
          businessContext:
            'PROC-POL-001 requires a purchase requisition stating specification, quantity, required date, cost centre and business reason, approved under the FIN-POL-002 matrix before a purchase order is issued.',
          employeeIds: [requester.employeeId],
          entityRefs: [
            { type: 'department', id: DEPT.ADMIN },
            { type: 'costCenter', id: costCenter.costCenterId },
            { type: 'supplier', id: supplier.supplierId },
          ],
          systemIds: [SYS.SCM, SYS.FIN, SYS.DMS],
          policyIds: ['PROC-POL-001', 'FIN-POL-002'],
          events: [
            `${employeeName(requester)} raises a purchase requisition for ${formatKes(amount)} against cost centre ${
              costCenter.costCenterId
            }.`,
            'The system checks whether the item is already available from stock or an approved supplier before sourcing.',
            `${supplier.tradingName} is confirmed as an approved supplier for this category.`,
            'The requisition is approved within the requesting department.',
            'A purchase order is issued and goods receipt is recorded on delivery.',
          ],
          expectedOutcome: `At ${formatKes(amount)}, the amount falls within the Department Manager tier of the FIN-POL-002 matrix (up to and including KES 50,000). ${
            approval.approver.role.title
          } (${employeeName(approval.approver.employee)}) can approve this request within their own approval limit of ${
            approval.approver.personalLimitKes === null ? 'unlimited' : formatKes(approval.approver.personalLimitKes)
          } without escalation.`,
          relevantFacts: [
            `The request amount is ${formatKes(amount)}.`,
            `${supplier.tradingName} (${supplier.supplierId}) has approvalStatus "${supplier.approvalStatus}" in data/master-data/suppliers.json.`,
            `Cost centre ${costCenter.costCenterId} belongs to department ${DEPT.ADMIN}, headed by ${employeeName(
              approval.steps[0].employee,
            )}.`,
            'FIN-POL-002 sets the Department Manager/Department Head tier at up to and including KES 50,000.',
            ...approvalLadderFacts(approval).slice(0, 1),
          ],
          requiredReasoning: [
            'Confirm the supplier is on the approved supplier list.',
            'Determine which FIN-POL-002 matrix tier the amount falls into.',
            "Compare that tier's matrix ceiling against the department head's own canonical approval limit.",
            'Conclude whether escalation beyond the department head is required.',
          ],
          relationships: [
            { from: requester.employeeId, type: 'belongs_to', to: DEPT.ADMIN },
            { from: costCenter.costCenterId, type: 'belongs_to', to: DEPT.ADMIN },
            { from: supplier.supplierId, type: 'proposed_for', to: costCenter.costCenterId },
          ],
          difficulty: 'easy',
          questionTypes: ['calculation', 'policy_lookup', 'workflow'],
          tags: ['procurement', 'approval-matrix', 'administration', 'boundary'],
        },
        indexes,
      ),
    );
  }

  // B. KES 750,000 procurement - Finance Manager tier
  {
    const amount = 750_000;
    const requester = mustGet(indexes.employeeById, 'EMP-0007', 'employee');
    const supplier = mustGet(indexes.supplierById, 'SUP-012', 'supplier');
    const costCenter = mustGet(indexes.costCenterById, 'CC-IT', 'costCenter');
    const approval = resolveApproval(amount, DEPT.IT, indexes);
    scenarios.push(
      assembleScenario(
        {
          category: 'procurement',
          idPrefix: 'PROC',
          idNumber: 2,
          title: `IT hardware procurement of ${formatKes(amount)} tests the Finance Manager approval tier`,
          description: `The IT department needs replacement server and network hardware from ${supplier.tradingName}, priced at a KES equivalent of ${formatKes(
            amount,
          )} (the supplier invoices in ${supplier.currency}). ${employeeName(
            requester,
          )} raises the request against cost centre ${costCenter.costCenterId}.`,
          businessContext:
            'FIN-POL-002 establishes one approval matrix for expenditure and purchase commitments regardless of requesting department, evaluated on the total expected commitment.',
          employeeIds: [requester.employeeId],
          entityRefs: [
            { type: 'department', id: DEPT.IT },
            { type: 'costCenter', id: costCenter.costCenterId },
            { type: 'supplier', id: supplier.supplierId },
          ],
          systemIds: [SYS.SCM, SYS.FIN],
          policyIds: ['PROC-POL-001', 'FIN-POL-002'],
          events: [
            `${employeeName(requester)} raises a purchase requisition for a KES equivalent of ${formatKes(amount)}.`,
            'Procurement checks the amount against the FIN-POL-002 approval matrix.',
            'The IT department head is not eligible to approve alone at this amount.',
            'The requisition is routed to the next sufficient tier in the matrix.',
            'Finance reviews the purchase before the order is released, since it exceeds KES 500,000.',
          ],
          expectedOutcome: `${formatKes(amount)} exceeds the KES 500,000 ceiling of the Department Head tier, placing it in the Finance Manager tier (KES 500,001-2,000,000). ${employeeName(
            approval.approver.employee,
          )} (${approval.approver.role.title}), whose own approval limit is ${
            approval.approver.personalLimitKes === null ? 'unlimited' : formatKes(approval.approver.personalLimitKes)
          }, is the required approver. PROC-POL-001 additionally requires Finance review before the purchase order is released, since the amount exceeds KES 500,000.',`,
          relevantFacts: [
            `The request amount is ${formatKes(amount)}, requested by the ${DEPT.IT} department.`,
            `${supplier.tradingName} (${supplier.supplierId}) is an approved supplier invoicing in ${supplier.currency}.`,
            'FIN-POL-002: "KES 50,001 to 500,000, Department Head; KES 500,001 to 2,000,000, Finance Manager."',
            'PROC-POL-001: "Purchases above KES 500,000 require Finance review before a purchase order is released."',
            ...approvalLadderFacts(approval).slice(0, 2),
          ],
          requiredReasoning: [
            'Determine the FIN-POL-002 matrix tier for KES 750,000.',
            'Recognise that this exceeds the Department Head ceiling regardless of which department requested it.',
            "Confirm the Finance Manager's own approval limit covers this amount.",
            'Identify the additional Finance-review requirement from PROC-POL-001 for amounts above KES 500,000.',
          ],
          relationships: [
            { from: requester.employeeId, type: 'belongs_to', to: DEPT.IT },
            { from: costCenter.costCenterId, type: 'belongs_to', to: DEPT.IT },
          ],
          difficulty: 'medium',
          questionTypes: ['calculation', 'policy_lookup', 'multi_hop'],
          tags: ['procurement', 'approval-matrix', 'it', 'boundary'],
        },
        indexes,
      ),
    );
  }

  // C. KES 3,000,000 procurement - CFO tier
  {
    const amount = 3_000_000;
    const requester = mustGet(indexes.employeeById, 'EMP-0006', 'employee');
    const supplier = mustGet(indexes.supplierById, 'SUP-013', 'supplier');
    const costCenter = mustGet(indexes.costCenterById, 'CC-OPS', 'costCenter');
    const approval = resolveApproval(amount, DEPT.OPS, indexes);
    scenarios.push(
      assembleScenario(
        {
          category: 'procurement',
          idPrefix: 'PROC',
          idNumber: 3,
          title: `A ${formatKes(amount)} logistics contract with a high-risk supplier escalates past Finance Manager`,
          description: `Operations wants to commit ${formatKes(amount)} to a one-year distribution contract with ${supplier.tradingName}, which carries a "${
            supplier.riskRating
          }" risk rating in the supplier register. ${employeeName(requester)} raises the request.`,
          businessContext:
            "Higher-risk suppliers require stronger evidence and monitoring under PROC-POL-002, in addition to the amount itself determining the required financial approver.",
          employeeIds: [requester.employeeId],
          entityRefs: [
            { type: 'department', id: DEPT.OPS },
            { type: 'costCenter', id: costCenter.costCenterId },
            { type: 'supplier', id: supplier.supplierId },
          ],
          systemIds: [SYS.SCM, SYS.FIN, SYS.DMS],
          policyIds: ['PROC-POL-001', 'PROC-POL-002', 'FIN-POL-002'],
          events: [
            `${employeeName(requester)} raises a purchase requisition for ${formatKes(amount)}.`,
            `Procurement notes ${supplier.tradingName}'s "${supplier.riskRating}" risk rating and applies proportionate due diligence.`,
            'The amount is checked against the FIN-POL-002 matrix.',
            'Finance Manager approval alone is insufficient at this amount.',
            'The request escalates to the next sufficient tier.',
          ],
          expectedOutcome: `${formatKes(
            amount,
          )} falls in the matrix's CFO tier (KES 2,000,001-10,000,000) because it already exceeds the Finance Manager's own approval limit of ${formatKes(
            mustGet(indexes.roleById, 'ROLE-FIN-MGR', 'role').approvalAuthority!.approvalLimitKes as number,
          )}. ${employeeName(approval.approver.employee)} (${
            approval.approver.role.title
          }) is the required approver, and the supplier's elevated risk rating requires additional PROC-POL-002 due diligence alongside the financial approval.`,
          relevantFacts: [
            `The request amount is ${formatKes(amount)}.`,
            `${supplier.tradingName} (${supplier.supplierId}) has riskRating "${supplier.riskRating}" in data/master-data/suppliers.json.`,
            'FIN-POL-002: "KES 500,001 to 2,000,000, Finance Manager; KES 2,000,001 to 10,000,000, CFO."',
            "PROC-POL-002: 'Higher-risk suppliers require stronger evidence, contract controls, monitoring and renewal review.'",
            ...approvalLadderFacts(approval).slice(1, 3),
          ],
          requiredReasoning: [
            "Determine why KES 3,000,000 exceeds the Finance Manager's own approval limit, not just the matrix band's nominal range.",
            'Identify CFO as the next sufficient tier.',
            "Separately evaluate the supplier's risk rating against PROC-POL-002 due-diligence requirements.",
            'Combine both conclusions into a single procurement decision.',
          ],
          relationships: [
            { from: requester.employeeId, type: 'belongs_to', to: DEPT.OPS },
            { from: requester.employeeId, type: 'requests_from', to: supplier.supplierId },
          ],
          difficulty: 'hard',
          questionTypes: ['calculation', 'multi_hop', 'compliance'],
          tags: ['procurement', 'approval-matrix', 'operations', 'supplier-risk', 'boundary'],
        },
        indexes,
      ),
    );
  }

  // D. Emergency procurement
  {
    const zeroStock = nthMatch(
      findInventory(indexes, (r) => r.inventoryStatus === 'OUT_OF_STOCK' && r.warehouseId === 'WH-NRB-001'),
      0,
      'OUT_OF_STOCK at WH-NRB-001 for emergency procurement',
    );
    const product = mustGet(indexes.productById, zeroStock.productId, 'product');
    const supplierId = product.supplierIds[0];
    const supplier = mustGet(indexes.supplierById, supplierId, 'supplier');
    const requester = mustGet(indexes.employeeById, 'EMP-0022', 'employee');
    const amount = 180_000;
    const approval = resolveApproval(amount, DEPT.WH, indexes);
    scenarios.push(
      assembleScenario(
        {
          category: 'procurement',
          idPrefix: 'PROC',
          idNumber: 4,
          title: `Emergency replenishment of ${product.name} after it hits zero stock at the Nairobi hub`,
          description: `${product.name} (${product.productId}) has reached zero available stock at the Nairobi Distribution Centre, threatening committed dispatches. ${employeeName(
            requester,
          )} initiates an emergency purchase from ${supplier.tradingName} for ${formatKes(amount)} outside the normal purchase-order-first sequence.`,
          businessContext:
            'PROC-POL-001 and FIN-POL-002 both allow emergency procurement, but only where delay creates material risk to people, stock, systems or continuity, and both require the action to be documented and retrospectively approved promptly.',
          employeeIds: [requester.employeeId],
          entityRefs: [
            { type: 'product', id: product.productId },
            { type: 'inventory', id: zeroStock.inventoryId },
            { type: 'warehouse', id: 'WH-NRB-001' },
            { type: 'supplier', id: supplier.supplierId },
            { type: 'department', id: DEPT.WH },
          ],
          systemIds: [SYS.SCM, SYS.FIN],
          policyIds: ['PROC-POL-001', 'FIN-POL-002', 'INV-POL-001'],
          events: [
            `Inventory confirms ${product.name} is at zero available stock at WH-NRB-001.`,
            `${employeeName(requester)} determines the delay in normal procurement would create a material risk to committed dispatches.`,
            `An emergency order for ${formatKes(amount)} is placed with ${supplier.tradingName} without waiting for a purchase order to issue first.`,
            'The responsible manager records the reason, supplier, amount and evidence in Microsoft Dynamics 365 Finance within one business day.',
            'A retrospective approver reviews and confirms the emergency action.',
          ],
          expectedOutcome: `The emergency procurement is permitted because it protects continuity of committed dispatches, but it is not exempt from control: the reason, supplier, amount and evidence must be recorded within one business day, ${employeeName(
            approval.approver.employee,
          )} (${
            approval.approver.role.title
          }) must retrospectively confirm the decision under the FIN-POL-002 matrix for ${formatKes(
            amount,
          )}, and the emergency status does not waive conflict-disclosure, sanctions-screening or receipt-matching controls.`,
          relevantFacts: [
            `${product.name} (${product.productId}) has quantityAvailable of 0 at warehouse WH-NRB-001 (inventory record ${zeroStock.inventoryId}), reorderLevel ${zeroStock.reorderLevel}.`,
            `${supplier.tradingName} (${supplier.supplierId}) is an approved supplier of this product.`,
            `${formatKes(amount)} falls within the Department Head tier of the FIN-POL-002 matrix, which ${employeeName(
              approval.approver.employee,
            )} (${approval.approver.role.title}) can retrospectively confirm.`,
            "PROC-POL-001: 'Emergency procurement is used only where delay creates a material risk to people, stock, service continuity or critical systems... Procurement reports emergency use, exceptions, supplier performance and policy breaches to the Procurement Manager and Compliance.'",
            "FIN-POL-002: 'The responsible manager records the reason, supplier or payee, amount, evidence and retrospective approver in Microsoft Dynamics 365 Finance within one business day. Emergency status does not waive conflict disclosure, sanctions screening or receipt or invoice matching controls.'",
          ],
          requiredReasoning: [
            'Confirm the stock position justifies treating this as an emergency rather than routine replenishment.',
            'Identify the documentation and timing requirements that still apply despite the emergency route.',
            'Resolve which approver would retrospectively confirm this amount under the standard approval matrix.',
          ],
          relationships: [
            { from: product.productId, type: 'stocked_at', to: 'WH-NRB-001' },
            { from: product.productId, type: 'supplied_by', to: supplier.supplierId },
            { from: requester.employeeId, type: 'belongs_to', to: DEPT.WH },
          ],
          difficulty: 'medium',
          questionTypes: ['workflow', 'exception', 'policy_lookup'],
          tags: ['procurement', 'emergency', 'warehouse', 'inventory'],
        },
        indexes,
      ),
    );
  }

  // E. Supplier not on the approved supplier list
  {
    const requester = mustGet(indexes.employeeById, 'EMP-0016', 'employee');
    const manager = mustGet(indexes.employeeById, 'EMP-0004', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'procurement',
          idPrefix: 'PROC',
          idNumber: 5,
          title: 'A requester wants to use a supplier that is not on the approved supplier list',
          description: `${employeeName(
            requester,
          )} has been offered a lower price by a prospective vendor, "Greenline Packaging Solutions", for packaging materials, and wants to raise a purchase order directly with them because the current approved suppliers are more expensive.`,
          businessContext:
            'PROC-POL-002 requires supplier onboarding, due diligence and Procurement Manager approval before any supplier can receive a purchase order; a lower quoted price does not bypass this requirement.',
          employeeIds: [requester.employeeId, manager.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.PROC }],
          systemIds: [SYS.SCM, SYS.DMS],
          policyIds: ['PROC-POL-002', 'FIN-POL-002'],
          events: [
            `${employeeName(requester)} identifies a prospective vendor not present in the approved supplier list.`,
            'The requester proposes issuing a purchase order directly to the prospective vendor on price grounds.',
            "The proposal is checked against the approved supplier list in data/master-data/suppliers.json.",
            'The Procurement Manager is consulted before any commitment is made.',
          ],
          expectedOutcome:
            'The purchase order cannot be issued to the prospective vendor. PROC-POL-002 requires a completed supplier profile, Finance validation of payment and tax details, proportionate Compliance due diligence, and Procurement Manager approval before inclusion on the approved supplier list - a lower quoted price is not a substitute for this process.',
          relevantFacts: [
            "The proposed vendor, \"Greenline Packaging Solutions\", does not appear in data/master-data/suppliers.json.",
            "PROC-POL-002: 'A new supplier cannot be selected merely because a requester prefers it; the approved list, documented exception and FIN-POL-002 authority are required.'",
            "PROC-POL-002: 'Procurement collects legal identity, contacts, ownership information, payment details, tax information, service category, references and the proposed risk classification... Finance validates payment and tax details; Compliance performs proportionate due diligence; the Procurement Manager approves inclusion.'",
          ],
          requiredReasoning: [
            'Check whether the proposed vendor exists in the canonical supplier register.',
            'Identify the onboarding and due-diligence steps required before a new supplier can be used.',
            'Conclude that price alone does not justify bypassing the approved supplier list.',
          ],
          relationships: [{ from: requester.employeeId, type: 'belongs_to', to: DEPT.PROC }],
          difficulty: 'medium',
          questionTypes: ['exception', 'policy_lookup', 'recommendation'],
          tags: ['procurement', 'supplier-management', 'negative'],
        },
        indexes,
      ),
    );
  }

  // F. Goods receipt quantity mismatch (three-way match issue)
  {
    const product = mustGet(indexes.productById, 'PRD-013', 'product');
    const supplierId = product.supplierIds[0];
    const supplier = mustGet(indexes.supplierById, supplierId, 'supplier');
    const receivingOfficer = mustGet(indexes.employeeById, 'EMP-0036', 'employee');
    const warehouseManager = mustGet(indexes.employeeById, 'EMP-0022', 'employee');
    const amount = 50_000;
    scenarios.push(
      assembleScenario(
        {
          category: 'procurement',
          idPrefix: 'PROC',
          idNumber: 6,
          title: `Goods receipt at Mombasa Distribution Centre records fewer units than the ${formatKes(amount)} purchase order`,
          description: `${employeeName(
            receivingOfficer,
          )} receives a delivery of ${product.name} from ${supplier.tradingName} at the Mombasa Distribution Centre against a ${formatKes(
            amount,
          )} purchase order, but the delivered quantity is short of what the purchase order specifies.`,
          businessContext:
            'WH-POL-001 requires the receiving officer to verify quantity against the purchase order and record accepted, rejected, short or damaged quantities; PROC-POL-001 requires three-way matching before Finance pays the invoice.',
          employeeIds: [receivingOfficer.employeeId, warehouseManager.employeeId],
          entityRefs: [
            { type: 'product', id: product.productId },
            { type: 'supplier', id: supplier.supplierId },
            { type: 'warehouse', id: 'WH-MSA-001' },
          ],
          systemIds: [SYS.SCM, SYS.FIN],
          policyIds: ['WH-POL-001', 'PROC-POL-001'],
          events: [
            `${employeeName(receivingOfficer)} checks the delivery against the purchase order for ${product.name}.`,
            'The delivered quantity is short of the ordered quantity.',
            'The receiving officer records a goods receipt identifying the accepted and short quantities.',
            `The discrepancy is reported to ${employeeName(warehouseManager)} (Warehouse Manager) and to Procurement.`,
            'Finance holds the invoice for resolution pending three-way match confirmation.',
          ],
          expectedOutcome:
            'The delivery is not accepted as if it were complete: WH-POL-001 requires the receiving officer to record the accepted and short quantities exactly, the Warehouse Manager resolves the discrepancy, Procurement follows up with the supplier, and Finance holds payment until the purchase order, goods receipt and invoice reconcile under PROC-POL-001.',
          relevantFacts: [
            `${product.name} (${product.productId}) was ordered from ${supplier.tradingName} (${supplier.supplierId}) for ${formatKes(
              amount,
            )}, to be received at warehouse WH-MSA-001.`,
            "WH-POL-001: 'The receiver records a goods receipt... and identifies accepted, rejected, short or damaged quantities... Finance uses the goods receipt for invoice matching.'",
            "PROC-POL-001: 'Finance performs three-way matching of purchase order, goods receipt and invoice before payment; shortages, damage and price differences are held for resolution.'",
          ],
          requiredReasoning: [
            'Identify who is responsible for recording the discrepancy at receipt.',
            'Determine what happens to the invoice when quantities do not match.',
            'Identify who resolves the discrepancy versus who is merely notified of it.',
          ],
          relationships: [
            { from: product.productId, type: 'received_at', to: 'WH-MSA-001' },
            { from: product.productId, type: 'supplied_by', to: supplier.supplierId },
            { from: receivingOfficer.employeeId, type: 'reports_to', to: warehouseManager.employeeId },
          ],
          difficulty: 'medium',
          questionTypes: ['workflow', 'exception', 'policy_lookup'],
          tags: ['procurement', 'warehouse', 'three-way-match'],
        },
        indexes,
      ),
    );
  }

  // G. Segregation-of-duties violation: officer attempts to self-approve
  {
    const officer = mustGet(indexes.employeeById, 'EMP-0015', 'employee');
    const officerRole = mustGet(indexes.roleById, officer.roleId, 'role');
    const amount = 50_001;
    scenarios.push(
      assembleScenario(
        {
          category: 'procurement',
          idPrefix: 'PROC',
          idNumber: 7,
          title: `A Procurement Officer attempts to approve their own ${formatKes(amount)} purchase request`,
          description: `${employeeName(
            officer,
          )}, a Procurement Officer, raised a purchase requisition for ${formatKes(
            amount,
          )} and then marked it as approved themselves in Microsoft Dynamics 365 Supply Chain Management, without routing it to an authorised approver.`,
          businessContext:
            'Procurement Officer is an operational role with no approval authority in roles.json; FIN-POL-002 and PROC-POL-001 both prohibit self-approval regardless of amount.',
          employeeIds: [officer.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.PROC }, { type: 'role', id: officer.roleId }],
          systemIds: [SYS.SCM, SYS.FIN],
          policyIds: ['PROC-POL-001', 'FIN-POL-002'],
          events: [
            `${employeeName(officer)} raises a purchase requisition for ${formatKes(amount)}.`,
            'The same employee marks the requisition as approved in the system.',
            'A review identifies that the requester and approver are the same person.',
          ],
          expectedOutcome:
            "The approval is invalid and must be reversed. The Procurement Officer role carries no approval authority at all (approvalLimitKes is null in roles.json), and both FIN-POL-002 (\"No employee may approve their own request\") and PROC-POL-001 (\"The requester must not select, receive and approve the same purchase\") prohibit self-approval regardless of amount. The request must be routed to an authorised approver.",
          relevantFacts: [
            `${employeeName(officer)} (${officer.employeeId}) holds role ${officer.roleId} (${
              officerRole.title
            }), which has approvalAuthority: null in data/enterprise/roles.json.`,
            "FIN-POL-002: 'No employee may approve their own request, expense, access, supplier relationship or exception.'",
            "PROC-POL-001: 'The requester must not select, receive and approve the same purchase.'",
          ],
          requiredReasoning: [
            "Check the Procurement Officer role's approval authority in the canonical role register.",
            'Identify that self-approval is prohibited independent of the amount involved.',
            'Determine the corrective action required.',
          ],
          relationships: [{ from: officer.employeeId, type: 'holds_role', to: officer.roleId }],
          difficulty: 'medium',
          questionTypes: ['exception', 'policy_lookup', 'compliance'],
          tags: ['procurement', 'segregation-of-duties', 'negative'],
        },
        indexes,
      ),
    );
  }

  // H. Purchase order splitting to evade the Finance Manager threshold
  {
    const requester = mustGet(indexes.employeeById, 'EMP-0005', 'employee');
    const supplier = mustGet(indexes.supplierById, 'SUP-010', 'supplier');
    const splitAmount = 300_000;
    const totalAmount = 600_000;
    scenarios.push(
      assembleScenario(
        {
          category: 'procurement',
          idPrefix: 'PROC',
          idNumber: 8,
          title: `Two ${formatKes(splitAmount)} purchase orders to the same supplier total ${formatKes(totalAmount)}`,
          description: `${employeeName(
            requester,
          )} needs ${formatKes(totalAmount)} of promotional point-of-sale materials from ${supplier.tradingName}. Two separate purchase orders of ${formatKes(
            splitAmount,
          )} each are raised on the same day for the same business need, rather than one ${formatKes(totalAmount)} order.`,
          businessContext:
            'FIN-POL-002 evaluates the total expected commitment, not individual line items, specifically to prevent splitting a purchase to stay under a lower approval tier.',
          employeeIds: [requester.employeeId],
          entityRefs: [{ type: 'supplier', id: supplier.supplierId }, { type: 'department', id: DEPT.SALES }],
          systemIds: [SYS.SCM, SYS.FIN],
          policyIds: ['FIN-POL-002', 'PROC-POL-001'],
          events: [
            `${employeeName(requester)} identifies a single business need costing ${formatKes(totalAmount)}.`,
            `Two purchase orders of ${formatKes(splitAmount)} each are raised to the same supplier on the same day.`,
            'Each individual order falls under the Department Head approval tier on its own.',
            'A review identifies that both orders serve the same business need and were raised together.',
          ],
          expectedOutcome:
            "This is prohibited order-splitting. FIN-POL-002 states amounts are evaluated on the total expected commitment \"rather than being split to avoid a higher approval level,\" and PROC-POL-001 states \"a purchase order may not be split.\" The two orders must be treated as a single KES 600,000 commitment, placing it in the Finance Manager tier, not the Department Head tier.",
          relevantFacts: [
            `Two purchase orders of ${formatKes(splitAmount)} were raised to ${supplier.tradingName} (${
              supplier.supplierId
            }) on the same day for the same business need, totalling ${formatKes(totalAmount)}.`,
            `${formatKes(splitAmount)} alone falls under the KES 500,000 Department Head ceiling; ${formatKes(
              totalAmount,
            )} exceeds it and falls in the Finance Manager tier (KES 500,001-2,000,000).`,
            "FIN-POL-002: 'Amounts are evaluated on the total expected commitment... rather than being split to avoid a higher approval level.'",
            "PROC-POL-001: 'A purchase order may not be split, backdated, issued to an employee for personal use, or used to conceal a gift, conflict or unauthorised commitment.'",
          ],
          requiredReasoning: [
            'Recognise that the two orders serve one underlying business need.',
            'Sum the total expected commitment rather than evaluating each order in isolation.',
            'Re-determine the correct FIN-POL-002 tier using the combined total.',
            'Identify this pattern as a policy violation, not a coincidence.',
          ],
          relationships: [{ from: requester.employeeId, type: 'belongs_to', to: DEPT.SALES }],
          difficulty: 'hard',
          questionTypes: ['exception', 'calculation', 'compliance'],
          tags: ['procurement', 'approval-matrix', 'negative', 'boundary'],
        },
        indexes,
      ),
    );
  }

  return scenarios;
}

// ---------------------------------------------------------------------------
// Shared inventory selection helpers (used by Sales, Inventory, Cross-Domain)
// ---------------------------------------------------------------------------

function healthyStockRecords(indexes: Indexes): InventoryRecord[] {
  return findInventory(indexes, (r) => r.inventoryStatus === 'IN_STOCK' && r.quantityAvailable > r.reorderLevel * 2);
}

function reorderRequiredRecords(indexes: Indexes, warehouseId?: string): InventoryRecord[] {
  return findInventory(
    indexes,
    (r) => r.inventoryStatus === 'REORDER_REQUIRED' && (warehouseId === undefined || r.warehouseId === warehouseId),
  );
}

function outOfStockRecords(indexes: Indexes, warehouseId?: string): InventoryRecord[] {
  return findInventory(
    indexes,
    (r) =>
      r.inventoryStatus === 'OUT_OF_STOCK' &&
      r.warehouseId !== undefined &&
      (warehouseId === undefined || r.warehouseId === warehouseId) &&
      mustGet(indexes.productById, r.productId, 'product').status === 'ACTIVE',
  );
}

function highReservationRecords(indexes: Indexes): InventoryRecord[] {
  return findInventory(indexes, (r) => r.quantityReserved > 0 && r.quantityReserved / Math.max(r.quantityOnHand, 1) > 0.3);
}

/** Finds a product stocked at 3+ warehouses whose inventory records span at least 2 distinct statuses - useful for cross-warehouse comparison scenarios. */
function crossWarehouseComparisonProduct(indexes: Indexes): { product: Product; records: InventoryRecord[] } {
  for (const product of indexes.products) {
    const records = indexes.inventory.filter((r) => r.productId === product.productId);
    if (records.length >= 3 && new Set(records.map((r) => r.inventoryStatus)).size >= 2) {
      return { product, records };
    }
  }
  throw new Error('No product found with inventory spanning multiple statuses across 3+ warehouses.');
}

// ---------------------------------------------------------------------------
// Category 3: Sales
// ---------------------------------------------------------------------------

function generateSalesScenarios(indexes: Indexes): Scenario[] {
  const scenarios: Scenario[] = [];
  const healthy = healthyStockRecords(indexes);
  const reorderAtHub = reorderRequiredRecords(indexes, 'WH-NRB-001');

  // A. Sufficient inventory
  {
    const record = nthMatch(healthy, 0, 'healthy IN_STOCK record for sufficient-inventory sale');
    const product = mustGet(indexes.productById, record.productId, 'product');
    const warehouse = mustGet(indexes.warehouseById, record.warehouseId, 'warehouse');
    const customer = mustGet(indexes.customerById, 'CUS-001', 'customer');
    const accountManager = mustGet(indexes.employeeById, customer.accountManagerEmployeeId, 'employee');
    const requestedQuantity = 200;
    scenarios.push(
      assembleScenario(
        {
          category: 'sales',
          idPrefix: 'SALES',
          idNumber: 1,
          title: `${customer.tradingName} orders ${requestedQuantity} units of ${product.name} with ample stock available`,
          description: `${customer.tradingName} requests ${requestedQuantity} units of ${product.name}. The account manager, ${employeeName(
            accountManager,
          )}, checks availability at ${warehouse.name} before confirming the order.`,
          businessContext:
            'SALES-POL-001 requires a sales order to pass stock availability and credit controls before it becomes a warehouse instruction.',
          employeeIds: [accountManager.employeeId],
          entityRefs: [
            { type: 'customer', id: customer.customerId },
            { type: 'product', id: product.productId },
            { type: 'inventory', id: record.inventoryId },
            { type: 'warehouse', id: warehouse.warehouseId },
          ],
          systemIds: [SYS.SALES, SYS.SCM],
          policyIds: ['SALES-POL-001', 'INV-POL-001'],
          events: [
            `${customer.tradingName} requests ${requestedQuantity} units of ${product.name}.`,
            `${employeeName(accountManager)} creates a quotation in Microsoft Dynamics 365 Sales.`,
            'Microsoft Dynamics 365 Supply Chain Management confirms stock availability at the fulfilling warehouse.',
            'The order is confirmed and reserved against inventory.',
          ],
          expectedOutcome: `The order can be confirmed: quantityAvailable (${record.quantityAvailable}) at ${warehouse.name} comfortably exceeds the requested quantity (${requestedQuantity}) and remains above the reorder level (${record.reorderLevel}) after reservation.`,
          relevantFacts: [
            `${customer.tradingName} (${customer.customerId}) is managed by ${employeeName(accountManager)} (${
              accountManager.employeeId
            }).`,
            `${product.name} (${product.productId}) at ${warehouse.name} (${warehouse.warehouseId}) has quantityOnHand ${record.quantityOnHand}, quantityReserved ${record.quantityReserved}, quantityAvailable ${record.quantityAvailable}, reorderLevel ${record.reorderLevel} (inventory record ${record.inventoryId}).`,
            `The customer requested ${requestedQuantity} units.`,
          ],
          requiredReasoning: [
            'Resolve the customer to its account manager.',
            'Resolve the requested product and its inventory position at the relevant warehouse.',
            'Compare the requested quantity with quantityAvailable.',
            'Confirm the order can be fulfilled without breaching the reorder level.',
          ],
          relationships: [
            { from: customer.customerId, type: 'managed_by', to: accountManager.employeeId },
            { from: product.productId, type: 'stocked_at', to: warehouse.warehouseId },
          ],
          difficulty: 'easy',
          questionTypes: ['fact_lookup', 'comparison', 'workflow'],
          tags: ['sales', 'inventory', 'fulfilment'],
        },
        indexes,
      ),
    );
  }

  // B. Insufficient inventory
  {
    const record = nthMatch(reorderAtHub, 0, 'REORDER_REQUIRED record at hub for insufficient-inventory sale');
    const product = mustGet(indexes.productById, record.productId, 'product');
    const warehouse = mustGet(indexes.warehouseById, record.warehouseId, 'warehouse');
    const customer = mustGet(indexes.customerById, 'CUS-013', 'customer');
    const accountManager = mustGet(indexes.employeeById, customer.accountManagerEmployeeId, 'employee');
    const requestedQuantity = record.quantityAvailable + 1000;
    scenarios.push(
      assembleScenario(
        {
          category: 'sales',
          idPrefix: 'SALES',
          idNumber: 2,
          title: `${customer.tradingName} requests ${requestedQuantity} units of ${product.name}, more than is available`,
          description: `${customer.tradingName}, a wholesaler, requests ${requestedQuantity} units of ${product.name} from ${warehouse.name}. Available stock is well short of the request.`,
          businessContext:
            'SALES-POL-001 requires Sales to check availability before confirming; unavailable stock cannot be promised outright.',
          employeeIds: [accountManager.employeeId],
          entityRefs: [
            { type: 'customer', id: customer.customerId },
            { type: 'product', id: product.productId },
            { type: 'inventory', id: record.inventoryId },
            { type: 'warehouse', id: warehouse.warehouseId },
          ],
          systemIds: [SYS.SALES, SYS.SCM],
          policyIds: ['SALES-POL-001', 'INV-POL-001', 'PROC-POL-001'],
          events: [
            `${customer.tradingName} requests ${requestedQuantity} units of ${product.name}.`,
            `Microsoft Dynamics 365 Supply Chain Management reports quantityAvailable of ${record.quantityAvailable} at ${warehouse.name}.`,
            'Sales confirms the requested quantity exceeds quantityAvailable.',
            'The account manager proposes options rather than confirming the full quantity.',
          ],
          expectedOutcome: `The full order cannot be confirmed: ${requestedQuantity} exceeds quantityAvailable of ${record.quantityAvailable} at ${warehouse.name}. Per SALES-POL-001, Sales does not promise unavailable stock; the account manager may propose a partial delivery, an approved back-order, or an alternative product, while Inventory determines replenishment and Procurement follows PROC-POL-001.`,
          relevantFacts: [
            `${customer.tradingName} (${customer.customerId}) is managed by ${employeeName(accountManager)}.`,
            `${product.name} (${product.productId}) at ${warehouse.name} has quantityOnHand ${record.quantityOnHand}, quantityReserved ${record.quantityReserved}, quantityAvailable ${record.quantityAvailable} (inventory record ${record.inventoryId}), already below its reorderLevel of ${record.reorderLevel}.`,
            `The customer requested ${requestedQuantity} units.`,
            "SALES-POL-001: 'If requested quantity exceeds quantityAvailable, Sales does not promise unavailable stock. The account manager may propose a partial delivery, an approved back-order or an alternative product, while Inventory determines replenishment and Procurement follows PROC-POL-001.'",
          ],
          requiredReasoning: [
            'Resolve quantityOnHand, quantityReserved and quantityAvailable for the requested product and warehouse.',
            'Compare the requested quantity with quantityAvailable.',
            'Determine that the request cannot be fulfilled in full.',
            'Identify the Sales, Inventory and Procurement policies that govern the response.',
          ],
          relationships: [
            { from: customer.customerId, type: 'managed_by', to: accountManager.employeeId },
            { from: product.productId, type: 'stocked_at', to: warehouse.warehouseId },
          ],
          difficulty: 'hard',
          questionTypes: ['calculation', 'multi_hop', 'recommendation'],
          tags: ['sales', 'inventory', 'negative'],
        },
        indexes,
      ),
    );
  }

  // C. Low stock (available below reorder level, but request itself is fulfillable)
  {
    const record = nthMatch(reorderAtHub, 1, 'REORDER_REQUIRED record for low-stock sale');
    const product = mustGet(indexes.productById, record.productId, 'product');
    const warehouse = mustGet(indexes.warehouseById, record.warehouseId, 'warehouse');
    const customer = mustGet(indexes.customerById, 'CUS-003', 'customer');
    const accountManager = mustGet(indexes.employeeById, customer.accountManagerEmployeeId, 'employee');
    const requestedQuantity = 100;
    scenarios.push(
      assembleScenario(
        {
          category: 'sales',
          idPrefix: 'SALES',
          idNumber: 3,
          title: `${customer.tradingName} requests ${product.name}, already below its reorder level`,
          description: `${customer.tradingName} requests ${requestedQuantity} units of ${product.name} from ${warehouse.name}, where available stock is already below the reorder level even before this order is filled.`,
          businessContext:
            'INV-POL-001 requires the Inventory Manager to review replenishment when quantityAvailable falls below reorderLevel; a further sale from an already-low position increases the urgency.',
          employeeIds: [accountManager.employeeId],
          entityRefs: [
            { type: 'customer', id: customer.customerId },
            { type: 'product', id: product.productId },
            { type: 'inventory', id: record.inventoryId },
            { type: 'warehouse', id: warehouse.warehouseId },
          ],
          systemIds: [SYS.SALES, SYS.SCM],
          policyIds: ['SALES-POL-001', 'INV-POL-001', 'PROC-POL-001'],
          events: [
            `${customer.tradingName} requests ${requestedQuantity} units of ${product.name}.`,
            `The system confirms quantityAvailable (${record.quantityAvailable}) is already below reorderLevel (${record.reorderLevel}).`,
            'The order itself can be fulfilled from available stock.',
            'The Inventory Manager is notified that reorder review is required regardless of this individual order.',
          ],
          expectedOutcome: `The order for ${requestedQuantity} units can be fulfilled since it is within quantityAvailable of ${record.quantityAvailable}, but the underlying reorder condition (available already below reorderLevel of ${record.reorderLevel}) is unaffected by fulfilling it and independently requires the Inventory Manager's replenishment review under INV-POL-001, which may trigger PROC-POL-001.`,
          relevantFacts: [
            `${product.name} (${product.productId}) at ${warehouse.name} has quantityAvailable ${record.quantityAvailable}, below reorderLevel ${record.reorderLevel} (inventory record ${record.inventoryId}).`,
            `${customer.tradingName} (${customer.customerId}) requested ${requestedQuantity} units, managed by ${employeeName(
              accountManager,
            )}.`,
            "INV-POL-001: 'When quantityAvailable falls below reorderLevel, the Inventory Manager reviews demand, open purchase orders, stock in other warehouses and expected lead time... a reorder signal is not an automatic purchase commitment.'",
          ],
          requiredReasoning: [
            'Determine whether the requested quantity alone can be fulfilled from quantityAvailable.',
            'Separately determine whether the current stock position already breaches the reorder level.',
            'Identify that fulfilling the order does not resolve the reorder condition.',
            'Connect Sales, Inventory and the reorder rule to the possible next step in Procurement.',
          ],
          relationships: [
            { from: customer.customerId, type: 'managed_by', to: accountManager.employeeId },
            { from: product.productId, type: 'stocked_at', to: warehouse.warehouseId },
          ],
          difficulty: 'medium',
          questionTypes: ['comparison', 'multi_hop', 'recommendation'],
          tags: ['sales', 'inventory', 'reorder'],
        },
        indexes,
      ),
    );
  }

  // D. Customer return
  {
    const product = mustGet(indexes.productById, 'PRD-017', 'product');
    const warehouse = mustGet(indexes.warehouseById, 'WH-NRB-001', 'warehouse');
    const customer = mustGet(indexes.customerById, 'CUS-008', 'customer');
    const accountManager = mustGet(indexes.employeeById, customer.accountManagerEmployeeId, 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'sales',
          idPrefix: 'SALES',
          idNumber: 4,
          title: `${customer.tradingName} returns a damaged delivery of ${product.name}`,
          description: `${customer.tradingName} reports that part of a recent delivery of ${product.name}, dispatched from ${warehouse.name}, arrived damaged and requests a return and credit.`,
          businessContext:
            'SALES-POL-001 requires a return to state a reason, customer reference and condition assessment before stock is returned or a credit issued; damaged goods are then processed under INV-POL-001 and WH-POL-001.',
          employeeIds: [accountManager.employeeId],
          entityRefs: [
            { type: 'customer', id: customer.customerId },
            { type: 'product', id: product.productId },
            { type: 'warehouse', id: warehouse.warehouseId },
          ],
          systemIds: [SYS.SALES, SYS.SCM, SYS.FIN],
          policyIds: ['SALES-POL-001', 'WH-POL-001', 'INV-POL-001'],
          events: [
            `${customer.tradingName} reports damaged units of ${product.name} from a recent delivery.`,
            `${employeeName(accountManager)} logs the return with a reason and customer reference.`,
            `${warehouse.name} receives the returned stock and assesses its condition.`,
            'Damaged stock is segregated and held from sale pending disposition.',
            'Finance processes an approved credit once the return is confirmed.',
          ],
          expectedOutcome:
            'The return is not automatically credited: a reason, customer reference and condition assessment must be recorded and approved first. Once Warehouse confirms the goods are damaged, the stock is segregated under WH-POL-001 and INV-POL-001, and Finance issues the credit in Microsoft Dynamics 365 Finance under SALES-POL-001.',
          relevantFacts: [
            `${customer.tradingName} (${customer.customerId}) is managed by ${employeeName(accountManager)}.`,
            `${product.name} (${product.productId}) was dispatched from ${warehouse.name} (${warehouse.warehouseId}).`,
            "SALES-POL-001: 'Returns require a reason, customer reference, condition assessment and approval before stock is returned or a credit is issued... damaged, expired or disputed goods are isolated and processed under INV-POL-001 and WH-POL-001; Finance handles approved credits.'",
          ],
          requiredReasoning: [
            'Identify the information required before a return can be processed.',
            'Identify which department assesses the condition of returned goods.',
            'Determine which policy governs segregating damaged stock versus issuing the credit.',
          ],
          relationships: [
            { from: customer.customerId, type: 'managed_by', to: accountManager.employeeId },
            { from: product.productId, type: 'dispatched_from', to: warehouse.warehouseId },
          ],
          difficulty: 'medium',
          questionTypes: ['workflow', 'policy_lookup'],
          tags: ['sales', 'returns', 'warehouse'],
        },
        indexes,
      ),
    );
  }

  // E. Customer credit verification refresh
  {
    const customer = mustGet(indexes.customerById, 'CUS-007', 'customer');
    const accountManager = mustGet(indexes.employeeById, customer.accountManagerEmployeeId, 'employee');
    const salesManager = mustGet(indexes.employeeById, 'EMP-0005', 'employee');
    const requestedIncrease = 350_000;
    scenarios.push(
      assembleScenario(
        {
          category: 'sales',
          idPrefix: 'SALES',
          idNumber: 5,
          title: `${customer.tradingName} requests a credit limit increase to ${formatKes(requestedIncrease)}`,
          description: `${customer.tradingName}, rated "${customer.riskRating}" risk with a current credit limit of ${formatKes(
            customer.creditLimit,
          )}, requests an increase to ${formatKes(requestedIncrease)} ahead of the festive season.`,
          businessContext:
            'SALES-POL-001 requires the Sales Manager to approve credit terms within authority and Finance to perform the required credit checks; a higher-risk customer warrants closer verification.',
          employeeIds: [accountManager.employeeId, salesManager.employeeId],
          entityRefs: [{ type: 'customer', id: customer.customerId }],
          systemIds: [SYS.SALES, SYS.FIN],
          policyIds: ['SALES-POL-001', 'FIN-POL-002'],
          events: [
            `${customer.tradingName} requests a credit limit increase from ${formatKes(customer.creditLimit)} to ${formatKes(
              requestedIncrease,
            )}.`,
            `${employeeName(accountManager)} forwards the request with account history.`,
            'Finance performs the required credit and account checks.',
            `${employeeName(salesManager)} (Sales Manager) reviews the request given the customer's risk rating.`,
          ],
          expectedOutcome: `Given the customer's "${customer.riskRating}" risk rating, the increase requires renewed verification rather than routine approval: Finance must complete its credit checks and the Sales Manager must confirm the new limit is within their approval authority before it is applied in Microsoft Dynamics 365 Sales.`,
          relevantFacts: [
            `${customer.tradingName} (${customer.customerId}) currently has creditLimit ${formatKes(
              customer.creditLimit,
            )} and riskRating "${customer.riskRating}" in data/master-data/customers.json.`,
            `The requested new limit is ${formatKes(requestedIncrease)}.`,
            "SALES-POL-001: 'The Sales Manager approves credit terms and material discounts within authority; Finance performs the required credit and account checks.'",
          ],
          requiredReasoning: [
            "Compare the current and requested credit limits against the customer's risk rating.",
            'Identify who approves credit terms and who performs credit checks.',
            'Determine that a higher-risk customer requesting a large increase warrants closer verification, not automatic approval.',
          ],
          relationships: [
            { from: customer.customerId, type: 'managed_by', to: accountManager.employeeId },
            { from: customer.customerId, type: 'reviewed_by', to: salesManager.employeeId },
          ],
          difficulty: 'medium',
          questionTypes: ['policy_lookup', 'recommendation'],
          tags: ['sales', 'credit-control', 'customer-verification'],
        },
        indexes,
      ),
    );
  }

  // F. Suspended customer attempts a new order (real SUSPENDED customer)
  {
    const customer = mustGet(indexes.customerById, 'CUS-020', 'customer');
    const accountManager = mustGet(indexes.employeeById, customer.accountManagerEmployeeId, 'employee');
    const record = nthMatch(healthy, 2, 'healthy stock record for suspended-customer order');
    const product = mustGet(indexes.productById, record.productId, 'product');
    scenarios.push(
      assembleScenario(
        {
          category: 'sales',
          idPrefix: 'SALES',
          idNumber: 6,
          title: `${customer.tradingName} places a new order while its account is suspended`,
          description: `${customer.tradingName} submits a new order for ${product.name}. The customer's account status in Microsoft Dynamics 365 Sales is "${customer.customerStatus}".`,
          businessContext:
            'SALES-POL-001 requires a sales order to be checked for approval and credit status before confirmation; a suspended account status is a control signal that must not be bypassed by stock availability alone.',
          employeeIds: [accountManager.employeeId],
          entityRefs: [
            { type: 'customer', id: customer.customerId },
            { type: 'product', id: product.productId },
          ],
          systemIds: [SYS.SALES, SYS.FIN],
          policyIds: ['SALES-POL-001', 'FIN-POL-002'],
          events: [
            `${customer.tradingName} submits a new order for ${product.name}.`,
            'Microsoft Dynamics 365 Sales shows the account status as "SUSPENDED".',
            'Stock is otherwise available to fulfil the order.',
            'The order is checked for approval and credit status before confirmation.',
          ],
          expectedOutcome: `The order must not be confirmed while the account is suspended, regardless of stock availability. ${customer.tradingName}'s account status of "${customer.customerStatus}" must be resolved by the Sales Manager and Finance before any new order is accepted; stock availability is irrelevant to this decision.`,
          relevantFacts: [
            `${customer.tradingName} (${customer.customerId}) has customerStatus "${customer.customerStatus}" and riskRating "${customer.riskRating}" in data/master-data/customers.json.`,
            `${product.name} (${product.productId}) has sufficient available stock to fulfil the request.`,
            "SALES-POL-001: 'The order is checked for approval, credit status and pricing before confirmation... a sales order is not a warehouse instruction until it passes the required status and credit controls.'",
          ],
          requiredReasoning: [
            "Check the customer's account status before considering stock.",
            'Recognise that stock availability does not override an account-level control.',
            'Determine that the order must be escalated, not confirmed.',
          ],
          relationships: [
            { from: customer.customerId, type: 'managed_by', to: accountManager.employeeId },
            { from: customer.customerId, type: 'attempted_order_for', to: product.productId },
          ],
          difficulty: 'medium',
          questionTypes: ['exception', 'policy_lookup', 'compliance'],
          tags: ['sales', 'credit-control', 'negative'],
        },
        indexes,
      ),
    );
  }

  // G. Abstention: approval level requested without an order value
  {
    const customer = mustGet(indexes.customerById, 'CUS-002', 'customer');
    const salesRep = mustGet(indexes.employeeById, customer.accountManagerEmployeeId, 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'sales',
          idPrefix: 'SALES',
          idNumber: 7,
          title: `${employeeName(salesRep)} asks which approval level applies to a customer discount, without stating the amount`,
          description: `${employeeName(
            salesRep,
          )} asks which approval level is required to grant ${customer.tradingName} a requested discount, but does not state the discount amount, percentage, or resulting order value.`,
          businessContext:
            'SALES-POL-001 and FIN-POL-002 both determine the required approver from the specific amount involved; without that figure, the tier cannot be determined.',
          employeeIds: [salesRep.employeeId],
          entityRefs: [{ type: 'customer', id: customer.customerId }],
          systemIds: [SYS.SALES],
          policyIds: ['SALES-POL-001', 'FIN-POL-002'],
          events: [
            `${customer.tradingName} requests an unspecified discount.`,
            `${employeeName(salesRep)} asks which approval level is required.`,
            'No discount amount, percentage or resulting order value is provided.',
          ],
          expectedOutcome:
            'There is not enough information to answer: the FIN-POL-002 approval tier depends entirely on the amount of the commitment, which has not been stated. The correct response is to request the discount amount or resulting order value before determining an approver, not to guess a tier.',
          relevantFacts: [
            `${customer.tradingName} (${customer.customerId}) is managed by ${employeeName(salesRep)}.`,
            'No discount amount, percentage or order value was provided in the request.',
            'FIN-POL-002 determines the required approver from the total expected commitment amount.',
          ],
          requiredReasoning: [
            'Identify what information the approval matrix requires as its input.',
            'Confirm that this input (the amount) is missing from the request.',
            'Conclude that a specific approver cannot be named without it.',
          ],
          relationships: [{ from: customer.customerId, type: 'managed_by', to: salesRep.employeeId }],
          difficulty: 'medium',
          questionTypes: ['abstention', 'policy_lookup'],
          tags: ['sales', 'abstention', 'insufficient-information'],
        },
        indexes,
      ),
    );
  }

  return scenarios;
}

// ---------------------------------------------------------------------------
// Category 4: Inventory
// ---------------------------------------------------------------------------

function generateInventoryScenarios(indexes: Indexes): Scenario[] {
  const scenarios: Scenario[] = [];
  const inventoryManager = mustGet(indexes.employeeById, 'EMP-0021', 'employee');
  const warehouseManager = mustGet(indexes.employeeById, 'EMP-0022', 'employee');

  // A. Reorder required
  {
    const record = nthMatch(reorderRequiredRecords(indexes, 'WH-NRB-001'), 2, 'REORDER_REQUIRED record for INV-001');
    const product = mustGet(indexes.productById, record.productId, 'product');
    const warehouse = mustGet(indexes.warehouseById, record.warehouseId, 'warehouse');
    scenarios.push(
      assembleScenario(
        {
          category: 'inventory',
          idPrefix: 'INV',
          idNumber: 1,
          title: `${product.name} at ${warehouse.name} has fallen below its reorder level`,
          description: `Available stock of ${product.name} at ${warehouse.name} has dropped below the reorder level, triggering a replenishment review.`,
          businessContext:
            'INV-POL-001 requires the Inventory Manager to review demand, open purchase orders, other warehouses and lead time whenever quantityAvailable falls below reorderLevel.',
          employeeIds: [inventoryManager.employeeId],
          entityRefs: [
            { type: 'product', id: product.productId },
            { type: 'inventory', id: record.inventoryId },
            { type: 'warehouse', id: warehouse.warehouseId },
          ],
          systemIds: [SYS.SCM],
          policyIds: ['INV-POL-001', 'PROC-POL-001'],
          events: [
            `A cycle review finds quantityAvailable (${record.quantityAvailable}) below reorderLevel (${record.reorderLevel}) for ${product.name} at ${warehouse.name}.`,
            `${employeeName(inventoryManager)} reviews demand, open purchase orders and stock at other warehouses.`,
            'A purchase request or transfer is considered, but is not an automatic commitment.',
          ],
          expectedOutcome: `Per INV-POL-001, the Inventory Manager (${employeeName(
            inventoryManager,
          )}) reviews demand, open purchase orders, stock in other warehouses and expected lead time before a purchase request or transfer is raised; reaching the reorder level is a review trigger, not an automatic purchase commitment, and the resulting request would still follow PROC-POL-001 and FIN-POL-002.`,
          relevantFacts: [
            `${product.name} (${product.productId}) at ${warehouse.name} (${warehouse.warehouseId}) has quantityOnHand ${record.quantityOnHand}, quantityReserved ${record.quantityReserved}, quantityAvailable ${record.quantityAvailable}, reorderLevel ${record.reorderLevel} (inventory record ${record.inventoryId}).`,
            "INV-POL-001: 'When quantityAvailable falls below reorderLevel, the Inventory Manager reviews demand, open purchase orders, stock in other warehouses and expected lead time. The resulting purchase request or transfer follows PROC-POL-001 and FIN-POL-002; a reorder signal is not an automatic purchase commitment.'",
          ],
          requiredReasoning: [
            'Compare quantityAvailable against reorderLevel.',
            'Identify who is responsible for the replenishment review.',
            'Recognise that crossing the reorder level does not itself authorise a purchase.',
          ],
          relationships: [{ from: product.productId, type: 'stocked_at', to: warehouse.warehouseId }],
          difficulty: 'easy',
          questionTypes: ['fact_lookup', 'policy_lookup', 'workflow'],
          tags: ['inventory', 'reorder'],
        },
        indexes,
      ),
    );
  }

  // B. Out of stock
  {
    const record = nthMatch(outOfStockRecords(indexes, 'WH-NRB-001'), 1, 'OUT_OF_STOCK record for INV-002');
    const product = mustGet(indexes.productById, record.productId, 'product');
    const warehouse = mustGet(indexes.warehouseById, record.warehouseId, 'warehouse');
    scenarios.push(
      assembleScenario(
        {
          category: 'inventory',
          idPrefix: 'INV',
          idNumber: 2,
          title: `${product.name} is completely out of stock at ${warehouse.name}`,
          description: `${product.name} shows quantityAvailable of zero at ${warehouse.name}. Any sales order for this product at this warehouse cannot currently be fulfilled.`,
          businessContext: 'INV-POL-001 defines quantityAvailable as quantityOnHand less quantityReserved and any controlled hold.',
          employeeIds: [inventoryManager.employeeId],
          entityRefs: [
            { type: 'product', id: product.productId },
            { type: 'inventory', id: record.inventoryId },
            { type: 'warehouse', id: warehouse.warehouseId },
          ],
          systemIds: [SYS.SCM],
          policyIds: ['INV-POL-001'],
          events: [
            `Inventory reporting shows quantityOnHand of ${record.quantityOnHand} and quantityAvailable of ${record.quantityAvailable} for ${product.name} at ${warehouse.name}.`,
            'No stock is available to reserve against a new sales order at this warehouse.',
            'The Inventory Manager reviews replenishment options, including stock at other warehouses.',
          ],
          expectedOutcome: `${product.name} cannot be sold from ${warehouse.name} until stock is replenished or transferred in; quantityAvailable is exactly 0 (quantityOnHand ${record.quantityOnHand} minus quantityReserved ${record.quantityReserved}). Sales must check other warehouses or trigger a reorder through Inventory before promising this product to a customer from this site.`,
          relevantFacts: [
            `${product.name} (${product.productId}) at ${warehouse.name} has quantityOnHand ${record.quantityOnHand}, quantityReserved ${record.quantityReserved}, quantityAvailable ${record.quantityAvailable} (inventory record ${record.inventoryId}).`,
            "INV-POL-001: 'quantityAvailable is quantityOnHand less quantityReserved and any controlled hold.'",
          ],
          requiredReasoning: [
            'Confirm quantityAvailable is zero by subtracting quantityReserved from quantityOnHand.',
            'Determine that no reservation against a new order is possible at this site.',
            'Identify the next step: check other warehouses or trigger replenishment.',
          ],
          relationships: [{ from: product.productId, type: 'stocked_at', to: warehouse.warehouseId }],
          difficulty: 'medium',
          questionTypes: ['fact_lookup', 'calculation'],
          tags: ['inventory', 'out-of-stock'],
        },
        indexes,
      ),
    );
  }

  // C. Reserved inventory
  {
    const record = nthMatch(highReservationRecords(indexes), 0, 'high-reservation record for INV-003');
    const product = mustGet(indexes.productById, record.productId, 'product');
    const warehouse = mustGet(indexes.warehouseById, record.warehouseId, 'warehouse');
    scenarios.push(
      assembleScenario(
        {
          category: 'inventory',
          idPrefix: 'INV',
          idNumber: 3,
          title: `A large share of ${product.name} stock at ${warehouse.name} is already reserved`,
          description: `${product.name} at ${warehouse.name} shows a substantial quantityReserved relative to quantityOnHand, meaning the freely sellable quantityAvailable is significantly lower than the physical stock count would suggest.`,
          businessContext:
            'INV-POL-001 defines quantityReserved as stock committed to approved demand; reporting must distinguish physical, reserved and available stock rather than treating quantityOnHand as sellable.',
          employeeIds: [inventoryManager.employeeId],
          entityRefs: [
            { type: 'product', id: product.productId },
            { type: 'inventory', id: record.inventoryId },
            { type: 'warehouse', id: warehouse.warehouseId },
          ],
          systemIds: [SYS.SCM],
          policyIds: ['INV-POL-001'],
          events: [
            `Inventory reporting shows quantityOnHand of ${record.quantityOnHand} for ${product.name} at ${warehouse.name}.`,
            `Of that, ${record.quantityReserved} units are already reserved against approved demand.`,
            `quantityAvailable is calculated as ${record.quantityAvailable}, materially lower than quantityOnHand.`,
          ],
          expectedOutcome: `Only ${record.quantityAvailable} units of ${product.name} are actually available to promise to a new customer at ${warehouse.name}, even though ${record.quantityOnHand} units are physically on hand, because ${record.quantityReserved} units are already committed to approved demand under INV-POL-001.`,
          relevantFacts: [
            `${product.name} (${product.productId}) at ${warehouse.name} has quantityOnHand ${record.quantityOnHand}, quantityReserved ${record.quantityReserved}, quantityAvailable ${record.quantityAvailable} (inventory record ${record.inventoryId}).`,
            "INV-POL-001: 'quantityReserved is stock committed to approved demand. quantityAvailable is quantityOnHand less quantityReserved and any controlled hold.'",
          ],
          requiredReasoning: [
            'Distinguish quantityOnHand from quantityAvailable.',
            'Calculate quantityAvailable as quantityOnHand minus quantityReserved.',
            'Recognise that physical stock alone overstates what can be sold.',
          ],
          relationships: [{ from: product.productId, type: 'stocked_at', to: warehouse.warehouseId }],
          difficulty: 'medium',
          questionTypes: ['calculation', 'fact_lookup'],
          tags: ['inventory', 'reserved-stock'],
        },
        indexes,
      ),
    );
  }

  // D. Inventory discrepancy (cycle count variance)
  {
    const record = nthMatch(healthyStockRecords(indexes), 1, 'IN_STOCK record for cycle-count discrepancy');
    const product = mustGet(indexes.productById, record.productId, 'product');
    const warehouse = mustGet(indexes.warehouseById, record.warehouseId, 'warehouse');
    const countedQuantity = record.quantityOnHand - 50;
    scenarios.push(
      assembleScenario(
        {
          category: 'inventory',
          idPrefix: 'INV',
          idNumber: 4,
          title: `A cycle count of ${product.name} at ${warehouse.name} finds a variance against the system balance`,
          description: `A scheduled cycle count of ${product.name} at ${warehouse.name} recorded a physical count of ${countedQuantity} units, against a system quantityOnHand of ${record.quantityOnHand}.`,
          businessContext:
            'INV-POL-001 requires counters to record location, product, expected balance, counted balance and variance, with adjustments requiring independent review.',
          employeeIds: [inventoryManager.employeeId, warehouseManager.employeeId],
          entityRefs: [
            { type: 'product', id: product.productId },
            { type: 'inventory', id: record.inventoryId },
            { type: 'warehouse', id: warehouse.warehouseId },
          ],
          systemIds: [SYS.SCM, SYS.FIN],
          policyIds: ['INV-POL-001', 'FIN-POL-002'],
          events: [
            `A cycle count is performed for ${product.name} at ${warehouse.name}.`,
            `The system balance (quantityOnHand) is ${record.quantityOnHand}; the physical count is ${countedQuantity}.`,
            `A variance of ${record.quantityOnHand - countedQuantity} units is recorded with the location, product and expected balance.`,
            'An independent reviewer, not the counter, assesses the variance before any adjustment is posted.',
          ],
          expectedOutcome: `The variance of ${
            record.quantityOnHand - countedQuantity
          } units must not be silently corrected. INV-POL-001 requires the count evidence (location, product, expected and counted balance, variance) to be recorded, an independent review of the adjustment, and - since this may be a write-off for loss - approval at the level set by FIN-POL-002 in addition to the Inventory Manager's sign-off. No employee may erase the transaction to hide the discrepancy.`,
          relevantFacts: [
            `${product.name} (${product.productId}) at ${warehouse.name} has a system quantityOnHand of ${record.quantityOnHand} (inventory record ${record.inventoryId}).`,
            `The physical cycle count recorded ${countedQuantity} units, a variance of ${record.quantityOnHand - countedQuantity}.`,
            "INV-POL-001: 'Counters record the location, product, expected balance, counted balance, variance and evidence. Adjustments require an independent review; write-offs for damage, expiry, loss or obsolescence require the Inventory Manager and the approval level in FIN-POL-002. No employee may erase a transaction to hide a discrepancy.'",
          ],
          requiredReasoning: [
            'Calculate the variance between the system balance and the physical count.',
            'Identify the records required to document the count.',
            'Identify who must independently review the adjustment before it is posted.',
            'Determine whether an additional financial approval level applies to the resulting write-off.',
          ],
          relationships: [{ from: product.productId, type: 'stocked_at', to: warehouse.warehouseId }],
          difficulty: 'hard',
          questionTypes: ['calculation', 'workflow', 'exception'],
          tags: ['inventory', 'discrepancy', 'cycle-count'],
        },
        indexes,
      ),
    );
  }

  // E. Damaged stock identified at receiving
  {
    const product = mustGet(indexes.productById, 'PRD-025', 'product');
    const warehouse = mustGet(indexes.warehouseById, 'WH-KSM-001', 'warehouse');
    const warehouseOfficer = mustGet(indexes.employeeById, 'EMP-0037', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'inventory',
          idPrefix: 'INV',
          idNumber: 5,
          title: `${employeeName(warehouseOfficer)} finds water-damaged cartons of ${product.name} at ${warehouse.name}`,
          description: `While putting away a delivery, ${employeeName(
            warehouseOfficer,
          )} identifies several cartons of ${product.name} at ${warehouse.name} with visible water damage.`,
          businessContext:
            'WH-POL-001 requires damaged goods to be segregated and reported to Procurement and Inventory before disposition; INV-POL-001 requires damaged stock to be held from sale.',
          employeeIds: [warehouseOfficer.employeeId, warehouseManager.employeeId, inventoryManager.employeeId],
          entityRefs: [
            { type: 'product', id: product.productId },
            { type: 'warehouse', id: warehouse.warehouseId },
          ],
          systemIds: [SYS.SCM],
          policyIds: ['WH-POL-001', 'INV-POL-001'],
          events: [
            `${employeeName(warehouseOfficer)} identifies water damage on cartons of ${product.name}.`,
            'The damaged stock is segregated, labelled and held from sale.',
            `${employeeName(warehouseManager)} (Warehouse Manager) and ${employeeName(
              inventoryManager,
            )} (Inventory Manager) are notified before disposition.`,
            'A decision on write-off, supplier claim or disposal is made once the accounting treatment is approved.',
          ],
          expectedOutcome:
            'The damaged cartons must be segregated, labelled and held from sale immediately, and reported to both the Warehouse Manager and Inventory Manager before any disposition decision. The warehouse may not create an unexplained adjustment; Inventory approves the accounting treatment under INV-POL-001 and Procurement resolves any supplier claim.',
          relevantFacts: [
            `${product.name} (${product.productId}) is stocked at ${warehouse.name} (${warehouse.warehouseId}).`,
            "WH-POL-001: 'Damaged or questionable goods are segregated and reported to Procurement and Inventory before disposition... The warehouse may not create an unexplained adjustment.'",
            "INV-POL-001: 'Damaged or expired stock is segregated, labelled and held from sale. Warehouse confirms movement and condition under WH-POL-001; Finance receives valuation-impacting adjustments.'",
          ],
          requiredReasoning: [
            'Identify the immediate physical control required for damaged stock.',
            'Identify who must be notified before any disposition decision.',
            'Recognise that the warehouse cannot unilaterally write off the stock.',
          ],
          relationships: [
            { from: product.productId, type: 'stocked_at', to: warehouse.warehouseId },
            { from: warehouseOfficer.employeeId, type: 'reports_to', to: warehouseManager.employeeId },
          ],
          difficulty: 'medium',
          questionTypes: ['workflow', 'policy_lookup'],
          tags: ['inventory', 'warehouse', 'damaged-stock'],
        },
        indexes,
      ),
    );
  }

  // F. Healthy baseline stock (contrast case)
  {
    const record = nthMatch(healthyStockRecords(indexes), 3, 'IN_STOCK record for healthy baseline');
    const product = mustGet(indexes.productById, record.productId, 'product');
    const warehouse = mustGet(indexes.warehouseById, record.warehouseId, 'warehouse');
    scenarios.push(
      assembleScenario(
        {
          category: 'inventory',
          idPrefix: 'INV',
          idNumber: 6,
          title: `${product.name} at ${warehouse.name} is well stocked with no reorder concern`,
          description: `${product.name} at ${warehouse.name} shows healthy stock, comfortably above its reorder level, with no replenishment action needed.`,
          businessContext:
            'A baseline healthy stock position, for contrast against the reorder and out-of-stock scenarios in this same product line.',
          employeeIds: [inventoryManager.employeeId],
          entityRefs: [
            { type: 'product', id: product.productId },
            { type: 'inventory', id: record.inventoryId },
            { type: 'warehouse', id: warehouse.warehouseId },
          ],
          systemIds: [SYS.SCM],
          policyIds: ['INV-POL-001'],
          events: [
            `Routine inventory reporting shows quantityAvailable of ${record.quantityAvailable} for ${product.name} at ${warehouse.name}.`,
            `This is well above the reorderLevel of ${record.reorderLevel}.`,
            'No replenishment review is triggered.',
          ],
          expectedOutcome: `No action is required: quantityAvailable (${record.quantityAvailable}) is comfortably above reorderLevel (${record.reorderLevel}) for ${product.name} at ${warehouse.name}.`,
          relevantFacts: [
            `${product.name} (${product.productId}) at ${warehouse.name} has quantityOnHand ${record.quantityOnHand}, quantityReserved ${record.quantityReserved}, quantityAvailable ${record.quantityAvailable}, reorderLevel ${record.reorderLevel} (inventory record ${record.inventoryId}).`,
          ],
          requiredReasoning: ['Compare quantityAvailable against reorderLevel.', 'Confirm no replenishment trigger applies.'],
          relationships: [{ from: product.productId, type: 'stocked_at', to: warehouse.warehouseId }],
          difficulty: 'easy',
          questionTypes: ['fact_lookup', 'comparison'],
          tags: ['inventory', 'baseline'],
        },
        indexes,
      ),
    );
  }

  // G. Cross-warehouse comparison
  {
    const { product, records } = crossWarehouseComparisonProduct(indexes);
    const lines = records.map((r) => {
      const w = mustGet(indexes.warehouseById, r.warehouseId, 'warehouse');
      return `${w.name}: quantityAvailable ${r.quantityAvailable}, reorderLevel ${r.reorderLevel}, status ${r.inventoryStatus}`;
    });
    scenarios.push(
      assembleScenario(
        {
          category: 'inventory',
          idPrefix: 'INV',
          idNumber: 7,
          title: `${product.name} shows very different stock positions across SVGA's four distribution centres`,
          description: `${product.name} is stocked at all four SVGA distribution centres, but the stock position differs sharply between sites: ${lines.join(
            '; ',
          )}.`,
          businessContext:
            'Comparing the same product across warehouses surfaces where a customer order should be routed and where replenishment is most urgent.',
          employeeIds: [mustGet(indexes.employeeById, 'EMP-0021', 'employee').employeeId],
          entityRefs: [
            { type: 'product', id: product.productId },
            ...records.map((r) => ({ type: 'inventory' as const, id: r.inventoryId })),
            ...records.map((r) => ({ type: 'warehouse' as const, id: r.warehouseId })),
          ],
          systemIds: [SYS.SCM],
          policyIds: ['INV-POL-001'],
          events: [
            `Inventory reporting is pulled for ${product.name} across all four distribution centres.`,
            'Stock positions are compared to identify which sites are healthy and which need replenishment.',
            'A recommendation is made on which warehouse should fulfil the next large order for this product.',
          ],
          expectedOutcome: `Fulfilment of a new order for ${product.name} should be routed to the warehouse with the strongest available position, and replenishment should be prioritised at any site where quantityAvailable is at or below reorderLevel. Specifically: ${lines.join(
            '; ',
          )}.`,
          relevantFacts: records.map((r) => {
            const w = mustGet(indexes.warehouseById, r.warehouseId, 'warehouse');
            return `${product.name} (${product.productId}) at ${w.name} (${r.warehouseId}): quantityOnHand ${r.quantityOnHand}, quantityReserved ${r.quantityReserved}, quantityAvailable ${r.quantityAvailable}, reorderLevel ${r.reorderLevel}, status ${r.inventoryStatus} (inventory record ${r.inventoryId}).`;
          }),
          requiredReasoning: [
            'Retrieve the inventory position for this product at every warehouse.',
            'Compare quantityAvailable against reorderLevel at each site.',
            'Rank the warehouses by stock health.',
            'Recommend a fulfilment source and flag any site needing replenishment.',
          ],
          relationships: records.map((r) => ({ from: product.productId, type: 'stocked_at', to: r.warehouseId })),
          difficulty: 'medium',
          questionTypes: ['comparison', 'multi_hop', 'recommendation'],
          tags: ['inventory', 'cross-warehouse', 'comparison'],
        },
        indexes,
      ),
    );
  }

  return scenarios;
}

// ---------------------------------------------------------------------------
// Category 5: Supplier Management
// ---------------------------------------------------------------------------

function generateSupplierScenarios(indexes: Indexes): Scenario[] {
  const scenarios: Scenario[] = [];
  const procurementManager = mustGet(indexes.employeeById, 'EMP-0004', 'employee');

  // A. New supplier seeking approval (real PENDING_APPROVAL supplier)
  {
    const supplier = mustGet(indexes.supplierById, 'SUP-016', 'supplier');
    const complianceManager = mustGet(indexes.employeeById, 'EMP-0008', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'supplier-management',
          idPrefix: 'SUP',
          idNumber: 1,
          title: `${supplier.tradingName} is awaiting approval to join the approved supplier list`,
          description: `${supplier.tradingName}, a prospective household-goods supplier, has submitted a supplier profile and currently has approvalStatus "${supplier.approvalStatus}" in the supplier register.`,
          businessContext:
            'PROC-POL-002 requires Finance to validate payment and tax details, Compliance to perform proportionate due diligence, and the Procurement Manager to approve inclusion on the approved supplier list.',
          employeeIds: [procurementManager.employeeId, complianceManager.employeeId],
          entityRefs: [{ type: 'supplier', id: supplier.supplierId }],
          systemIds: [SYS.SCM, SYS.DMS],
          policyIds: ['PROC-POL-002', 'COMP-POL-001'],
          events: [
            `${supplier.tradingName} submits a completed supplier profile with legal identity, contacts, payment and tax information.`,
            'Finance validates the payment and tax details.',
            `${employeeName(complianceManager)} (Compliance Manager) performs proportionate due diligence based on risk.`,
            `${employeeName(procurementManager)} (Procurement Manager) reviews the outcome before approving inclusion.`,
          ],
          expectedOutcome: `${supplier.tradingName} cannot receive purchase orders while approvalStatus remains "${supplier.approvalStatus}". Finance must validate payment and tax details, Compliance must complete proportionate due diligence, and only the Procurement Manager can approve inclusion on the approved supplier list.`,
          relevantFacts: [
            `${supplier.tradingName} (${supplier.supplierId}) has approvalStatus "${supplier.approvalStatus}" and riskRating "${supplier.riskRating}" in data/master-data/suppliers.json.`,
            "PROC-POL-002: 'Procurement collects legal identity, contacts, ownership information, payment details, tax information, service category, references and the proposed risk classification. Finance validates payment and tax details; Compliance performs proportionate due diligence; the Procurement Manager approves inclusion on the approved supplier list.'",
          ],
          requiredReasoning: [
            "Check the supplier's current approvalStatus.",
            'Identify the three parties who must each complete their part of onboarding.',
            'Determine that purchase orders cannot be placed until approval is granted.',
          ],
          relationships: [
            { from: supplier.supplierId, type: 'reviewed_by', to: complianceManager.employeeId },
            { from: supplier.supplierId, type: 'approved_by', to: procurementManager.employeeId },
          ],
          difficulty: 'medium',
          questionTypes: ['fact_lookup', 'workflow', 'policy_lookup'],
          tags: ['supplier-management', 'onboarding', 'procurement'],
        },
        indexes,
      ),
    );
  }

  // B. Supplier performance deterioration
  {
    const supplier = mustGet(indexes.supplierById, 'SUP-013', 'supplier');
    scenarios.push(
      assembleScenario(
        {
          category: 'supplier-management',
          idPrefix: 'SUP',
          idNumber: 2,
          title: `${supplier.tradingName}'s delivery performance has deteriorated over three consecutive months`,
          description: `${supplier.tradingName}, already rated "${supplier.riskRating}" risk, has missed agreed delivery windows for three consecutive months, affecting warehouse dispatch schedules.`,
          businessContext:
            'PROC-POL-002 requires Procurement to review supplier performance against delivery, quality, fulfilment and responsiveness, with a corrective action plan for material failures.',
          employeeIds: [procurementManager.employeeId],
          entityRefs: [{ type: 'supplier', id: supplier.supplierId }],
          systemIds: [SYS.SCM, SYS.DMS],
          policyIds: ['PROC-POL-002'],
          events: [
            `Delivery performance data for ${supplier.tradingName} is reviewed over three consecutive months.`,
            'Repeated missed delivery windows are identified as a material failure.',
            `${employeeName(procurementManager)} (Procurement Manager) determines a corrective action plan is required.`,
            'An owner and due date are assigned to the corrective action plan.',
          ],
          expectedOutcome: `A material failure has been identified for ${supplier.tradingName}, which already carries a "${supplier.riskRating}" risk rating. PROC-POL-002 requires a corrective action plan with an owner and due date; continued non-performance after that plan would support suspension, which blocks new purchase orders until the Procurement Manager records reinstatement or termination.`,
          relevantFacts: [
            `${supplier.tradingName} (${supplier.supplierId}) has riskRating "${supplier.riskRating}" in data/master-data/suppliers.json.`,
            'Delivery windows were missed for three consecutive months.',
            "PROC-POL-002: 'Procurement reviews performance against delivery, quality, fulfilment, responsiveness, invoice accuracy and policy compliance. A material failure receives a corrective action plan with an owner and due date.'",
          ],
          requiredReasoning: [
            "Assess whether repeated missed deliveries constitute a material failure under the policy.",
            'Identify the required response (corrective action plan) versus an immediate suspension.',
            'Identify what would escalate this from a corrective action plan to suspension.',
          ],
          relationships: [{ from: supplier.supplierId, type: 'reviewed_by', to: procurementManager.employeeId }],
          difficulty: 'medium',
          questionTypes: ['workflow', 'recommendation', 'policy_lookup'],
          tags: ['supplier-management', 'performance'],
        },
        indexes,
      ),
    );
  }

  // C. Conflict of interest (procurement officer, undisclosed relationship)
  {
    const supplier = mustGet(indexes.supplierById, 'SUP-006', 'supplier');
    const officer = mustGet(indexes.employeeById, 'EMP-0016', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'supplier-management',
          idPrefix: 'SUP',
          idNumber: 3,
          title: `A Procurement Officer's family member works at a supplier they are currently evaluating`,
          description: `${employeeName(
            officer,
          )} is evaluating renewal terms for ${supplier.tradingName}. During the review, it emerges that a close family member of ${employeeName(
            officer,
          )} is employed by ${supplier.tradingName} in a sales role. This relationship has not been disclosed.`,
          businessContext:
            'COMP-POL-002 requires disclosure of actual, potential or perceived conflicts involving suppliers, with withdrawal from evaluation pending a decision by the manager and Compliance Manager.',
          employeeIds: [officer.employeeId],
          entityRefs: [{ type: 'supplier', id: supplier.supplierId }],
          systemIds: [SYS.SCM, SYS.DMS],
          policyIds: ['COMP-POL-002', 'PROC-POL-002'],
          events: [
            `${employeeName(officer)} is assigned to evaluate renewal terms for ${supplier.tradingName}.`,
            "A family relationship between the officer and the supplier's sales contact is identified.",
            'The relationship has not been disclosed to a manager or Compliance.',
            'The evaluation is paused pending disclosure and review.',
          ],
          expectedOutcome: `${employeeName(
            officer,
          )} must disclose the relationship to their manager and the Compliance Manager and withdraw from evaluating or approving this supplier. Undisclosed, this is a conflict-of-interest breach under COMP-POL-002; PROC-POL-002 separately requires evaluators with an undisclosed relationship to be removed from the process.`,
          relevantFacts: [
            `${employeeName(officer)} (${officer.employeeId}) holds role ${officer.roleId} in department ${DEPT.PROC}.`,
            `${supplier.tradingName} (${supplier.supplierId}) is the supplier under evaluation.`,
            "COMP-POL-002: 'Employees disclose actual, potential or perceived conflicts involving suppliers... The manager and Compliance Manager decide whether the employee must withdraw, whether an independent review is required or whether the activity must stop.'",
            "PROC-POL-002: 'Employees disclose personal, family or financial relationships with a supplier under COMP-POL-002 and withdraw from evaluation or approval.'",
          ],
          requiredReasoning: [
            'Identify that a family relationship with a supplier contact exists.',
            'Determine that this relationship was not disclosed as required.',
            'Identify the required corrective action: disclosure and withdrawal from evaluation.',
          ],
          relationships: [{ from: officer.employeeId, type: 'undisclosed_relationship_with', to: supplier.supplierId }],
          difficulty: 'hard',
          questionTypes: ['compliance', 'exception', 'policy_lookup'],
          tags: ['supplier-management', 'conflict-of-interest', 'negative', 'compliance'],
        },
        indexes,
      ),
    );
  }

  // D. Supplier suspension
  {
    const supplier = mustGet(indexes.supplierById, 'SUP-004', 'supplier');
    scenarios.push(
      assembleScenario(
        {
          category: 'supplier-management',
          idPrefix: 'SUP',
          idNumber: 4,
          title: `${supplier.tradingName} is suspended after a quality failure is confirmed`,
          description: `A batch of goods from ${supplier.tradingName} failed incoming quality inspection at the warehouse, and the issue is confirmed as a recurring quality problem rather than an isolated incident.`,
          businessContext:
            'PROC-POL-002 permits suspension for quality failure, blocking new purchase orders until the Procurement Manager records reinstatement or termination.',
          employeeIds: [procurementManager.employeeId],
          entityRefs: [{ type: 'supplier', id: supplier.supplierId }],
          systemIds: [SYS.SCM, SYS.DMS],
          policyIds: ['PROC-POL-002', 'WH-POL-001'],
          events: [
            `Goods from ${supplier.tradingName} fail incoming quality inspection.`,
            'The failure is confirmed as recurring rather than isolated.',
            `${employeeName(procurementManager)} (Procurement Manager) records the supplier as suspended.`,
            'New purchase orders to this supplier are blocked.',
          ],
          expectedOutcome: `${supplier.tradingName} is suspended: no new purchase orders may be issued to them until the Procurement Manager records reinstatement or termination. Existing open commitments are reviewed separately; the suspension itself does not retroactively cancel confirmed deliveries already in transit.`,
          relevantFacts: [
            `${supplier.tradingName} (${supplier.supplierId}) has a confirmed recurring quality failure.`,
            "PROC-POL-002: 'A supplier may be suspended for quality failure, suspected fraud, conflict, sanctions concern, data incident or repeated non-performance; suspension blocks new purchase orders until the Procurement Manager records reinstatement or termination.'",
          ],
          requiredReasoning: [
            'Determine whether a recurring quality failure meets the suspension criteria.',
            'Identify who has authority to record a supplier suspension.',
            'Identify what a suspension does and does not affect.',
          ],
          relationships: [{ from: supplier.supplierId, type: 'suspended_by', to: procurementManager.employeeId }],
          difficulty: 'hard',
          questionTypes: ['exception', 'workflow', 'policy_lookup'],
          tags: ['supplier-management', 'suspension', 'negative'],
        },
        indexes,
      ),
    );
  }

  // E. Supplier information update
  {
    const supplier = mustGet(indexes.supplierById, 'SUP-005', 'supplier');
    scenarios.push(
      assembleScenario(
        {
          category: 'supplier-management',
          idPrefix: 'SUP',
          idNumber: 5,
          title: `${supplier.tradingName} requests updated payment terms and bank details`,
          description: `${supplier.tradingName} has requested a change to its payment terms and settlement bank account details on file.`,
          businessContext:
            'PROC-POL-002 and GEN-POL-001 require supplier record changes to be controlled, versioned and evidenced, given the fraud risk associated with payment detail changes.',
          employeeIds: [procurementManager.employeeId],
          entityRefs: [{ type: 'supplier', id: supplier.supplierId }],
          systemIds: [SYS.SCM, SYS.FIN, SYS.DMS],
          policyIds: ['PROC-POL-002', 'GEN-POL-001', 'COMP-POL-001'],
          events: [
            `${supplier.tradingName} requests a change to payment terms and bank account details.`,
            'Finance independently verifies the new bank details before any change is applied.',
            'The change is recorded with the approver, effective date and superseded version.',
            'Supplier contact information continues to be protected under data protection controls.',
          ],
          expectedOutcome: `The change is not applied on the strength of the request alone: Finance must independently verify the new bank details (a common fraud vector), the update is recorded as a new version with an approver and effective date under GEN-POL-001, and the supplier's contact information remains protected under COMP-POL-001.`,
          relevantFacts: [
            `${supplier.tradingName} (${supplier.supplierId}) is an existing approved supplier requesting a payment-details change.`,
            "GEN-POL-001: 'A revised policy creates a new version and records the approver, effective date and superseded version; users do not overwrite an approved record to hide history.'",
            "PROC-POL-002: 'Supplier records are maintained in Microsoft Dynamics 365 Supply Chain Management and sensitive information is handled under COMP-POL-001.'",
          ],
          requiredReasoning: [
            'Identify the fraud risk associated with an unverified bank-details change.',
            'Identify the independent verification step required before applying it.',
            'Identify the records/versioning requirement for the change itself.',
          ],
          relationships: [{ from: supplier.supplierId, type: 'record_owned_by', to: DEPT.PROC }],
          difficulty: 'easy',
          questionTypes: ['workflow', 'policy_lookup'],
          tags: ['supplier-management', 'records'],
        },
        indexes,
      ),
    );
  }

  return scenarios;
}

// ---------------------------------------------------------------------------
// Category 6: Finance
// ---------------------------------------------------------------------------

function generateFinanceScenarios(indexes: Indexes): Scenario[] {
  const scenarios: Scenario[] = [];

  // A. Routine expense claim with receipt
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0032', 'employee');
    const amount = 8_500;
    scenarios.push(
      assembleScenario(
        {
          category: 'finance',
          idPrefix: 'FIN',
          idNumber: 1,
          title: `${employeeName(employee)} submits a ${formatKes(amount)} local transport expense claim with a receipt`,
          description: `${employeeName(
            employee,
          )} submits a claim for ${formatKes(amount)} of local transport incurred while performing an authorised duty, with a receipt attached.`,
          businessContext:
            'FIN-POL-001 requires a receipt for each expense of KES 2,000 or more, submitted within 10 calendar days, with the line manager confirming business purpose and Finance checking arithmetic and approval authority.',
          employeeIds: [employee.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.FIN }],
          systemIds: [SYS.FIN],
          policyIds: ['FIN-POL-001'],
          events: [
            `${employeeName(employee)} submits a ${formatKes(amount)} expense claim with a receipt in Microsoft Dynamics 365 Finance.`,
            'The line manager confirms business purpose and budget.',
            'Finance checks arithmetic, duplicates, tax treatment, receipts and approval authority.',
          ],
          expectedOutcome: `The claim is eligible for standard processing: ${formatKes(
            amount,
          )} exceeds the KES 2,000 receipt threshold and a receipt is attached, so the claim proceeds to manager confirmation and Finance review without an exception.`,
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) submitted a claim of ${formatKes(amount)} with a receipt attached.`,
            "FIN-POL-001: 'A receipt is required for each expense of KES 2,000 or more and should be attached to the claim... The employee submits the claim in Microsoft Dynamics 365 Finance within 10 calendar days.'",
          ],
          requiredReasoning: [
            'Check whether the amount requires a receipt under the KES 2,000 threshold.',
            'Confirm a receipt is attached.',
            'Confirm no exception handling is triggered.',
          ],
          relationships: [{ from: employee.employeeId, type: 'belongs_to', to: DEPT.FIN }],
          difficulty: 'easy',
          questionTypes: ['fact_lookup', 'policy_lookup'],
          tags: ['finance', 'expense-claim'],
        },
        indexes,
      ),
    );
  }

  // B. Travel reimbursement
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0019', 'employee');
    const accommodationPerNight = 12_000;
    const nights = 2;
    scenarios.push(
      assembleScenario(
        {
          category: 'finance',
          idPrefix: 'FIN',
          idNumber: 2,
          title: `${employeeName(employee)} claims travel reimbursement for a Nairobi head-office visit`,
          description: `${employeeName(
            employee,
          )}, based in Kisumu, travelled to Nairobi Head Office for ${nights} nights for a sales planning meeting, claiming accommodation at ${formatKes(
            accommodationPerNight,
          )} per night plus meals and local transport.`,
          businessContext:
            'OPS-POL-001 sets the travel logistics rules and defers approval to FIN-POL-002; FIN-POL-001 caps accommodation at KES 12,000 per night and meals at KES 3,000 per person per meal unless an approved exception is recorded.',
          employeeIds: [employee.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.SALES }],
          systemIds: [SYS.FIN, SYS.DMS],
          policyIds: ['OPS-POL-001', 'FIN-POL-001', 'FIN-POL-002'],
          events: [
            `${employeeName(employee)} books travel from Kisumu to Nairobi for a ${nights}-night business trip.`,
            `Accommodation is booked at ${formatKes(accommodationPerNight)} per night.`,
            'Meal and local transport costs are incurred within policy limits.',
            'The claim is submitted in Microsoft Dynamics 365 Finance with the cost centre and business purpose.',
          ],
          expectedOutcome: `The accommodation claim of ${formatKes(
            accommodationPerNight,
          )} per night is exactly at the FIN-POL-001 cap and requires no exception; meal claims remain reimbursable up to KES 3,000 per person per meal. The travel itself was authorised under OPS-POL-001, with financial approval following the FIN-POL-002 matrix.`,
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) travelled from Kisumu to Nairobi for ${nights} nights.`,
            `Accommodation was claimed at ${formatKes(accommodationPerNight)} per night.`,
            "FIN-POL-001: 'Meal claims are capped at KES 3,000 per person per meal and accommodation at KES 12,000 per night unless a documented exception is approved before commitment.'",
            "OPS-POL-001: 'Accommodation is reimbursed up to KES 12,000 per night unless an approved exception is recorded... approval follows FIN-POL-002.'",
          ],
          requiredReasoning: [
            'Compare the claimed accommodation rate against the FIN-POL-001/OPS-POL-001 cap.',
            'Determine whether an exception is required at this rate.',
            'Identify which policy governs the travel authorisation versus the expense claim itself.',
          ],
          relationships: [{ from: employee.employeeId, type: 'belongs_to', to: DEPT.SALES }],
          difficulty: 'medium',
          questionTypes: ['comparison', 'policy_lookup', 'calculation'],
          tags: ['finance', 'travel', 'boundary'],
        },
        indexes,
      ),
    );
  }

  // C. Approval delegation while manager is on leave
  {
    const warehouseManager = mustGet(indexes.employeeById, 'EMP-0022', 'employee');
    const delegate = mustGet(indexes.employeeById, 'EMP-0006', 'employee');
    const amount = 150_000;
    scenarios.push(
      assembleScenario(
        {
          category: 'finance',
          idPrefix: 'FIN',
          idNumber: 3,
          title: `A ${formatKes(amount)} warehouse consumables purchase needs approval while the Warehouse Manager is on leave`,
          description: `${employeeName(
            warehouseManager,
          )} (Warehouse Manager) is on approved annual leave for the week a ${formatKes(
            amount,
          )} purchase requisition for warehouse consumables needs approval.`,
          businessContext:
            "FIN-POL-002 permits delegated approval but requires it to be formally recorded with dates and scope, and delegation does not permit self-approval or bypassing segregation of duties.",
          employeeIds: [warehouseManager.employeeId, delegate.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.WH }],
          systemIds: [SYS.FIN, SYS.SCM],
          policyIds: ['FIN-POL-002', 'HR-POL-001'],
          events: [
            `${employeeName(warehouseManager)} is on approved annual leave under HR-POL-001.`,
            `A ${formatKes(amount)} requisition for warehouse consumables requires approval during this period.`,
            `${employeeName(
              delegate,
            )} (Operations Manager), who oversees the Warehouse function, is formally recorded as the delegated approver for the period.`,
            'The delegated approval is recorded with its dates and scope.',
          ],
          expectedOutcome: `${employeeName(
            delegate,
          )} may approve the ${formatKes(
            amount,
          )} requisition as the formally recorded delegate while ${employeeName(
            warehouseManager,
          )} is on leave, provided the delegation is documented with its dates and scope; delegation must not be used to let the traveling manager pre-approve their own request before departure or to bypass segregation of duties.`,
          relevantFacts: [
            `${employeeName(warehouseManager)} (${warehouseManager.employeeId}) is the Warehouse Manager and is on approved leave.`,
            `${employeeName(delegate)} (${delegate.employeeId}) is the Operations Manager, which oversees the Warehouse department.`,
            'The requisition amount is ' + formatKes(amount) + '.',
            "FIN-POL-002: 'A delegated approver must be formally recorded with dates and scope; delegation does not permit self-approval, approval of a conflict, or bypass of segregation of duties.'",
          ],
          requiredReasoning: [
            'Confirm the primary approver is unavailable and why.',
            'Identify a suitable delegate given the reporting structure.',
            'Confirm the delegation is formally recorded, not informal.',
          ],
          relationships: [
            { from: warehouseManager.employeeId, type: 'belongs_to', to: DEPT.WH },
            { from: delegate.employeeId, type: 'oversees', to: DEPT.WH },
          ],
          difficulty: 'medium',
          questionTypes: ['workflow', 'policy_lookup', 'exception'],
          tags: ['finance', 'delegation', 'warehouse'],
        },
        indexes,
      ),
    );
  }

  // D. Abstention: reimbursability question without type or amount
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0028', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'finance',
          idPrefix: 'FIN',
          idNumber: 4,
          title: `${employeeName(employee)} asks whether "an expense" is reimbursable without saying what it is`,
          description: `${employeeName(
            employee,
          )} asks Finance whether an expense they incurred is reimbursable, but does not state the expense category, the amount, or whether a receipt was obtained.`,
          businessContext:
            "FIN-POL-001's eligibility rules and receipt requirements both depend on the expense category and amount; neither is known here.",
          employeeIds: [employee.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.CS }],
          systemIds: [SYS.FIN],
          policyIds: ['FIN-POL-001'],
          events: [
            `${employeeName(employee)} asks whether "an expense" they incurred is reimbursable.`,
            'No expense category, amount or receipt status is provided.',
          ],
          expectedOutcome:
            'There is not enough information to answer. FIN-POL-001 eligibility depends on the expense category (some categories, like alcohol or personal purchases, are never reimbursable) and the amount determines whether a receipt is mandatory. The correct response is to ask what the expense was, its amount, and whether a receipt exists - not to assume it is reimbursable.',
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) has not specified the expense category, amount, or receipt status.`,
            "FIN-POL-001 lists both reimbursable categories (travel, accommodation, meals, local transport, mileage, modest communication costs) and categories that are never reimbursable (personal purchases, fines, entertainment without business purpose, alcohol, convenience upgrades).",
          ],
          requiredReasoning: [
            'Identify what information FIN-POL-001 requires to determine reimbursability.',
            'Confirm that category and amount are both missing from the request.',
            'Conclude that a definitive answer cannot be given without that information.',
          ],
          relationships: [{ from: employee.employeeId, type: 'belongs_to', to: DEPT.CS }],
          difficulty: 'easy',
          questionTypes: ['abstention', 'policy_lookup'],
          tags: ['finance', 'abstention', 'insufficient-information'],
        },
        indexes,
      ),
    );
  }

  // E. High-value expenditure: Finance Manager's real limit is below the matrix band ceiling
  {
    const requester = mustGet(indexes.employeeById, 'EMP-0009', 'employee');
    const amount = 1_500_000;
    const approval = resolveApproval(amount, DEPT.LEGAL, indexes);
    const financeManagerRole = mustGet(indexes.roleById, 'ROLE-FIN-MGR', 'role');
    scenarios.push(
      assembleScenario(
        {
          category: 'finance',
          idPrefix: 'FIN',
          idNumber: 5,
          title: `A ${formatKes(amount)} contract commitment exceeds the Finance Manager's own approval limit`,
          description: `${employeeName(
            requester,
          )} (Legal Manager) needs to commit ${formatKes(amount)} for external legal counsel on a major contract dispute.`,
          businessContext:
            "FIN-POL-002's Finance Manager matrix tier runs up to KES 2,000,000, but the Finance Manager's own canonical approval limit in roles.json is lower, and the policy states the lower limit applies.",
          employeeIds: [requester.employeeId, approval.approver.employee.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.LEGAL }],
          systemIds: [SYS.FIN],
          policyIds: ['FIN-POL-002'],
          events: [
            `${employeeName(requester)} raises a commitment request for ${formatKes(amount)}.`,
            "The amount is checked against the FIN-POL-002 matrix band, which nominally names Finance Manager for this range.",
            `The Finance Manager's own approval limit (${formatKes(
              financeManagerRole.approvalAuthority!.approvalLimitKes as number,
            )}) is found to be lower than the requested amount.`,
            'The request escalates to the next sufficient tier.',
          ],
          expectedOutcome: `Although ${formatKes(
            amount,
          )} falls within the matrix's stated Finance Manager range (KES 500,001-2,000,000), the Finance Manager's own canonical approval limit of ${formatKes(
            financeManagerRole.approvalAuthority!.approvalLimitKes as number,
          )} is lower than the requested amount. Per FIN-POL-002's rule that "a role-specific authority may be lower and the lower limit applies," approval escalates to ${employeeName(
            approval.approver.employee,
          )} (${approval.approver.role.title}).`,
          relevantFacts: [
            `The request amount is ${formatKes(amount)}.`,
            `FIN-POL-002 assigns the KES 500,001-2,000,000 band to the Finance Manager tier.`,
            `The Finance Manager's approvalLimitKes in data/enterprise/roles.json is ${formatKes(
              financeManagerRole.approvalAuthority!.approvalLimitKes as number,
            )}, below the matrix band's own ceiling of ${formatKes(MATRIX_CEILING_KES.FINANCE_MANAGER as number)}.`,
            "FIN-POL-002: 'A role-specific authority may be lower and the lower limit applies.'",
          ],
          requiredReasoning: [
            'Identify the nominal FIN-POL-002 matrix tier for this amount.',
            "Cross-reference the named tier's actual canonical approval limit in roles.json, not just the matrix band's ceiling.",
            'Recognise the canonical limit is lower than the matrix band ceiling.',
            'Escalate to the next tier whose own limit is sufficient.',
          ],
          relationships: [{ from: requester.employeeId, type: 'belongs_to', to: DEPT.LEGAL }],
          difficulty: 'hard',
          questionTypes: ['calculation', 'multi_hop', 'exception'],
          tags: ['finance', 'approval-matrix', 'boundary'],
        },
        indexes,
      ),
    );
  }

  // F. CFO/CEO boundary mismatch
  {
    const requester = mustGet(indexes.employeeById, 'EMP-0006', 'employee');
    const amount = 7_000_000;
    const approval = resolveApproval(amount, DEPT.OPS, indexes);
    const cfoRole = mustGet(indexes.roleById, 'ROLE-CFO', 'role');
    scenarios.push(
      assembleScenario(
        {
          category: 'finance',
          idPrefix: 'FIN',
          idNumber: 6,
          title: `A ${formatKes(amount)} capital investment exceeds even the CFO's own approval limit`,
          description: `${employeeName(
            requester,
          )} (Operations Manager) proposes a ${formatKes(amount)} investment in new warehouse racking and materials-handling equipment across all four distribution centres.`,
          businessContext:
            "FIN-POL-002's CFO matrix tier runs up to KES 10,000,000, but the CFO's own canonical approval limit in roles.json is lower.",
          employeeIds: [requester.employeeId, approval.approver.employee.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.OPS }],
          systemIds: [SYS.FIN],
          policyIds: ['FIN-POL-002'],
          events: [
            `${employeeName(requester)} proposes a ${formatKes(amount)} capital investment.`,
            'The amount is checked against the FIN-POL-002 matrix band, which nominally names the CFO for this range.',
            `The CFO's own approval limit (${formatKes(cfoRole.approvalAuthority!.approvalLimitKes as number)}) is found to be lower than the requested amount.`,
            'The request escalates to the CEO.',
          ],
          expectedOutcome: `Although ${formatKes(
            amount,
          )} falls within the matrix's stated CFO range (KES 2,000,001-10,000,000), the CFO's own canonical approval limit of ${formatKes(
            cfoRole.approvalAuthority!.approvalLimitKes as number,
          )} is lower than the requested amount. Approval escalates to ${employeeName(approval.approver.employee)} (${
            approval.approver.role.title
          }).`,
          relevantFacts: [
            `The request amount is ${formatKes(amount)}.`,
            'FIN-POL-002 assigns the KES 2,000,001-10,000,000 band to the CFO tier.',
            `The CFO's approvalLimitKes in data/enterprise/roles.json is ${formatKes(
              cfoRole.approvalAuthority!.approvalLimitKes as number,
            )}, below the matrix band's own ceiling of ${formatKes(MATRIX_CEILING_KES.CFO as number)}.`,
            "FIN-POL-002: 'A role-specific authority may be lower and the lower limit applies... above KES 10,000,000, CEO or Executive Committee.'",
          ],
          requiredReasoning: [
            'Identify the nominal FIN-POL-002 matrix tier for this amount.',
            "Cross-reference the CFO's actual canonical approval limit in roles.json.",
            'Recognise the canonical limit is lower than the matrix band ceiling.',
            'Conclude that CEO approval is required even though the amount is below the matrix\'s stated KES 10,000,000 CFO ceiling.',
          ],
          relationships: [{ from: requester.employeeId, type: 'belongs_to', to: DEPT.OPS }],
          difficulty: 'hard',
          questionTypes: ['calculation', 'multi_hop', 'exception'],
          tags: ['finance', 'approval-matrix', 'boundary'],
        },
        indexes,
      ),
    );
  }

  return scenarios;
}

// ---------------------------------------------------------------------------
// Category 7: IT Incidents
// ---------------------------------------------------------------------------

function generateIncidentScenarios(indexes: Indexes): Scenario[] {
  const scenarios: Scenario[] = [];
  const itManager = mustGet(indexes.employeeById, 'EMP-0007', 'employee');

  // A. Cannot access Dynamics 365 Finance
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0033', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'incidents',
          idPrefix: 'INC',
          idNumber: 1,
          title: `${employeeName(employee)} cannot log in to Microsoft Dynamics 365 Finance`,
          description: `${employeeName(
            employee,
          )}, a Finance Analyst, reports being unable to log in to Microsoft Dynamics 365 Finance this morning, blocking reconciliation work for one user.`,
          businessContext:
            'IT-POL-002 classifies incidents by business impact; a single-user login failure to one system is a limited-service impact, not a widespread outage.',
          employeeIds: [employee.employeeId, itManager.employeeId],
          entityRefs: [{ type: 'system', id: 'SYS-D365-FIN' }],
          systemIds: [SYS.FIN, SYS.SD],
          policyIds: ['IT-POL-002', 'IT-POL-001'],
          events: [
            `${employeeName(employee)} creates a ticket in the IT Service Desk describing the affected system, symptoms, time and business impact.`,
            'The service desk triages and categorises the ticket.',
            'The impact is assessed as limited to one user and one system.',
            'The ticket is assigned a response target based on its severity classification.',
          ],
          expectedOutcome:
            'This is a P3 Medium incident under IT-POL-002 ("P3 Medium incidents affect a limited service") with a 240-minute response target, since it affects one user and one system rather than a critical system or widespread operations. The service desk triages, categorises and assigns it accordingly.',
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) cannot access Microsoft Dynamics 365 Finance (${
              mustGet(indexes.systemById, 'SYS-D365-FIN', 'system').name
            }).`,
            'The impact is limited to one user; no other users or systems are reported affected.',
            "IT-POL-002: 'P1 Critical incidents threaten a critical system, widespread operations, safety or confirmed serious security exposure... P3 Medium incidents affect a limited service with a 240-minute target.'",
          ],
          requiredReasoning: [
            'Assess the scope of impact: one user versus widespread operations.',
            'Match that scope to the correct P1-P4 severity definition.',
            'State the corresponding response target.',
          ],
          relationships: [{ from: employee.employeeId, type: 'affected_by', to: 'SYS-D365-FIN' }],
          difficulty: 'medium',
          questionTypes: ['comparison', 'policy_lookup'],
          tags: ['incidents', 'it-access', 'severity'],
        },
        indexes,
      ),
    );
  }

  // B. Unauthorized access detected
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0024', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'incidents',
          idPrefix: 'INC',
          idNumber: 2,
          title: `Unusual login activity is detected on ${employeeName(employee)}'s account outside normal hours`,
          description: `The Identity and Access Management System logs a successful login on ${employeeName(
            employee,
          )}'s account at 02:40 local time, a time the employee was not scheduled to be working, followed by an attempt to access Enterprise Document Management System folders outside their normal duties.`,
          businessContext:
            'IT-POL-002 treats a suspected loss of confidentiality or unauthorised access as an incident requiring immediate escalation; COMP-POL-001 governs any personal-data exposure risk.',
          employeeIds: [employee.employeeId, itManager.employeeId],
          entityRefs: [
            { type: 'system', id: 'SYS-IAM' },
            { type: 'system', id: 'SYS-DMS' },
          ],
          systemIds: [SYS.IAM, SYS.DMS, SYS.SD],
          policyIds: ['IT-POL-002', 'IT-POL-001', 'COMP-POL-001'],
          events: [
            'The Identity and Access Management System logs an out-of-hours login on the account.',
            'An attempt to access document folders outside the normal duties of the role follows.',
            `${employeeName(itManager)} (IT Manager) is notified immediately and coordinates the response.`,
            'The account is suspended pending investigation.',
            'Compliance is engaged to assess data-exposure scope.',
          ],
          expectedOutcome:
            'This is treated as a P1 or P2 incident given the confirmed suspicious security pattern: the service desk escalates immediately per IT-POL-002, the account is suspended under IT-POL-001 pending investigation, and Compliance assesses scope, containment and notification under COMP-POL-001 rather than the matter being dismissed as routine activity.',
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) holds role ${employee.roleId} in department ${DEPT.IT}.`,
            'The login occurred at 02:40 local time, outside the employee\'s normal working pattern, followed by access attempts outside the role\'s normal duties.',
            "IT-POL-002: 'P1 Critical incidents threaten a critical system, widespread operations, safety or confirmed serious security exposure; the service desk acknowledges within 15 minutes and escalates immediately.'",
            "COMP-POL-001: 'Employees report suspected loss, misdirection, unauthorised access, malware, disclosure or excessive access immediately through the IT Service Desk and to Compliance.'",
          ],
          requiredReasoning: [
            'Identify the anomalous signals: timing and access pattern outside role norms.',
            'Classify the severity given the security exposure.',
            'Identify the immediate containment action (account suspension) and the parties to notify.',
          ],
          relationships: [{ from: employee.employeeId, type: 'flagged_on', to: 'SYS-IAM' }],
          difficulty: 'hard',
          questionTypes: ['exception', 'compliance', 'multi_hop'],
          tags: ['incidents', 'security', 'negative', 'compliance'],
        },
        indexes,
      ),
    );
  }

  // C. System outage affecting Sales operations
  {
    scenarios.push(
      assembleScenario(
        {
          category: 'incidents',
          idPrefix: 'INC',
          idNumber: 3,
          title: 'Microsoft Dynamics 365 Sales is unavailable company-wide',
          description:
            'Microsoft Dynamics 365 Sales becomes unreachable for all Sales users across every location at 10:15, preventing quotations, sales orders and customer account access company-wide.',
          businessContext:
            'IT-POL-002 defines P1 Critical incidents as those threatening a critical system or widespread operations; a company-wide CRM outage during business hours is squarely in this category.',
          employeeIds: [itManager.employeeId, mustGet(indexes.employeeById, 'EMP-0005', 'employee').employeeId],
          entityRefs: [{ type: 'system', id: 'SYS-D365-SALES' }, { type: 'department', id: DEPT.SALES }],
          systemIds: [SYS.SALES, SYS.SD],
          policyIds: ['IT-POL-002'],
          events: [
            'Sales users across all locations report being unable to access Microsoft Dynamics 365 Sales at the same time.',
            'The IT Service Desk acknowledges the incident within 15 minutes.',
            `${employeeName(itManager)} (IT Manager) coordinates the major incident response and assigns technical owners.`,
            'Business updates are issued to affected departments while restoration is in progress.',
            'A post-incident review is scheduled once service is restored.',
          ],
          expectedOutcome:
            'This is a P1 Critical incident: it threatens a critical system and widespread operations. The service desk must acknowledge within 15 minutes and escalate immediately, the IT Manager coordinates the response and provides business updates, and a post-incident review with actions and owners follows restoration.',
          relevantFacts: [
            `${mustGet(indexes.systemById, 'SYS-D365-SALES', 'system').name} is unreachable for all Sales users across every location.`,
            "IT-POL-002: 'P1 Critical incidents threaten a critical system, widespread operations, safety or confirmed serious security exposure; the service desk acknowledges within 15 minutes and escalates immediately... Major incidents receive a post-incident review with actions and owners.'",
          ],
          requiredReasoning: [
            'Assess the scope of impact: company-wide versus a single user.',
            'Match that scope to the P1 definition.',
            'Identify the required acknowledgement time and follow-up review.',
          ],
          relationships: [{ from: 'SYS-D365-SALES', type: 'owned_by', to: DEPT.SALES }],
          difficulty: 'hard',
          questionTypes: ['comparison', 'policy_lookup', 'workflow'],
          tags: ['incidents', 'system-outage', 'sales', 'p1'],
        },
        indexes,
      ),
    );
  }

  // D. Abstention: vague suspicious-activity report
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0028', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'incidents',
          idPrefix: 'INC',
          idNumber: 4,
          title: `${employeeName(employee)} reports that "something seems wrong" without further detail`,
          description: `${employeeName(
            employee,
          )} tells the service desk that "something seems wrong with my account" but does not identify which system is affected, what the symptoms are, when it started, or what business impact it is having.`,
          businessContext:
            'IT-POL-002 requires a ticket to state the affected system, symptoms, time, location, business impact and contact details before it can be triaged and classified.',
          employeeIds: [employee.employeeId],
          entityRefs: [],
          systemIds: [SYS.SD],
          policyIds: ['IT-POL-002'],
          events: [
            `${employeeName(employee)} contacts the service desk with a vague concern.`,
            'No affected system, symptoms, timing or business impact is provided.',
            'The service desk cannot yet triage, categorise or classify the severity of the report.',
          ],
          expectedOutcome:
            'The report cannot yet be classified as P1-P4 or routed to a resolver group: IT-POL-002 requires the affected system, symptoms, time, location and business impact to triage a ticket. The correct next step is for the service desk to gather these specifics from the employee, not to guess a severity level or close the ticket.',
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) has not stated which system is affected, what the symptoms are, or when the issue started.`,
            "IT-POL-002: 'Employees create a ticket in the IT Service Desk with the affected system, symptoms, time, location, business impact and contact details.'",
          ],
          requiredReasoning: [
            'Identify the information IT-POL-002 requires to triage a ticket.',
            'Confirm that information is missing from this report.',
            'Conclude that severity cannot be classified yet, and clarification must be sought first.',
          ],
          relationships: [],
          difficulty: 'medium',
          questionTypes: ['abstention', 'policy_lookup'],
          tags: ['incidents', 'abstention', 'insufficient-information'],
        },
        indexes,
      ),
    );
  }

  // E. Terminated employee retains system access (discovered via access review)
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0031', 'employee');
    const manager = mustGet(indexes.employeeById, 'EMP-0011', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'incidents',
          idPrefix: 'INC',
          idNumber: 5,
          title: `A quarterly access review finds a departed employee's account still enabled`,
          description: `During a scheduled IT-POL-001 access review, IT finds that ${employeeName(
            employee,
          )}'s Identity and Access Management System account is still active, even though HR's records show the employee's manager, ${employeeName(
            manager,
          )}, confirmed the employment relationship ended a month earlier.`,
          businessContext:
            'IT-POL-001 requires managers to review access when duties change and IT to remove access promptly on termination; a month-long gap discovered only by a scheduled review indicates the original handoff failed.',
          employeeIds: [employee.employeeId, manager.employeeId, itManager.employeeId],
          entityRefs: [{ type: 'system', id: 'SYS-IAM' }],
          systemIds: [SYS.IAM, SYS.SD],
          policyIds: ['IT-POL-001', 'HR-POL-002', 'IT-POL-002'],
          events: [
            `${employeeName(itManager)} runs the scheduled quarterly access review under IT-POL-001.`,
            `The review finds ${employeeName(employee)}'s account is still enabled.`,
            "HR records confirm the employment relationship ended approximately one month earlier.",
            'The account is disabled immediately and the gap is logged for root-cause review.',
          ],
          expectedOutcome:
            'This is a control failure that must be logged and investigated, not just quietly corrected: the account should have been disabled at or near the termination date under HR-POL-002 and IT-POL-001, and a month-long gap discovered only by a scheduled review is treated as an incident requiring root-cause analysis, not a routine finding.',
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) belongs to department ${DEPT.ADMIN}; the canonical enterprise record currently shows this employee as ACTIVE, and the scenario tests the discovery of a control gap once separation is confirmed.`,
            "IT-POL-001: 'Managers review access when duties change and at the scheduled review interval. IT removes dormant, excessive or unsupported access.'",
            "HR-POL-002: 'When employment ends... HR notifies IT before the effective time where practicable.'",
          ],
          requiredReasoning: [
            'Determine how long the account remained active after the employment relationship ended.',
            'Identify which policy required the account to be disabled promptly.',
            'Determine whether discovery via a scheduled review, rather than the original handoff, indicates a control failure.',
          ],
          relationships: [
            { from: employee.employeeId, type: 'reports_to', to: manager.employeeId },
            { from: employee.employeeId, type: 'flagged_on', to: 'SYS-IAM' },
          ],
          difficulty: 'hard',
          questionTypes: ['exception', 'compliance', 'multi_hop'],
          tags: ['incidents', 'offboarding', 'it-access', 'negative'],
        },
        indexes,
      ),
    );
  }

  return scenarios;
}

// ---------------------------------------------------------------------------
// Category 8: Business Travel
// ---------------------------------------------------------------------------

function generateTravelScenarios(indexes: Indexes): Scenario[] {
  const scenarios: Scenario[] = [];

  // A. Domestic business travel request
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0017', 'employee');
    const manager = mustGet(indexes.employeeById, 'EMP-0005', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'travel',
          idPrefix: 'TRV',
          idNumber: 1,
          title: `${employeeName(employee)} requests domestic travel from Nairobi to Kisumu for a customer visit`,
          description: `${employeeName(
            employee,
          )} requests approval to travel from Nairobi to Kisumu for a one-day customer visit, with the purpose, dates, destination and estimated cost documented before booking.`,
          businessContext:
            'OPS-POL-001 requires a documented purpose, traveller, destination, dates, estimated cost and business owner before booking, with the line manager confirming need and budget.',
          employeeIds: [employee.employeeId, manager.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.SALES }],
          systemIds: [SYS.FIN, SYS.DMS],
          policyIds: ['OPS-POL-001', 'FIN-POL-002'],
          events: [
            `${employeeName(employee)} documents the purpose, destination, dates and estimated cost of the trip.`,
            `${employeeName(manager)} (Sales Manager) confirms business need and budget.`,
            'The request is approved under the FIN-POL-002 matrix before booking.',
          ],
          expectedOutcome:
            'The trip can proceed once the line manager confirms business need and budget and the estimated cost is approved under FIN-POL-002; OPS-POL-001 requires this documentation to exist before booking, not after.',
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) requests travel from Nairobi to Kisumu for a customer visit, reporting to ${employeeName(
              manager,
            )}.`,
            "OPS-POL-001: 'Business travel requires a documented purpose, traveller, destination, dates, estimated cost and business owner before booking. The line manager confirms need and budget; approval follows FIN-POL-002.'",
          ],
          requiredReasoning: [
            'Identify the information that must be documented before booking.',
            'Identify who confirms business need versus who approves the cost.',
          ],
          relationships: [{ from: employee.employeeId, type: 'reports_to', to: manager.employeeId }],
          difficulty: 'easy',
          questionTypes: ['workflow', 'policy_lookup'],
          tags: ['travel', 'sales'],
        },
        indexes,
      ),
    );
  }

  // B. Accommodation and transport boundary test
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0004', 'employee');
    const standardRate = 12_000;
    const exceptionRate = 15_000;
    scenarios.push(
      assembleScenario(
        {
          category: 'travel',
          idPrefix: 'TRV',
          idNumber: 2,
          title: `A 3-night Mombasa trip mixes standard-rate and above-cap accommodation nights`,
          description: `${employeeName(
            employee,
          )} (Procurement Manager) travels to Mombasa for 3 nights to conduct supplier due diligence. Two nights are booked at ${formatKes(
            standardRate,
          )}, the OPS-POL-001 cap, but the only room available for the third night costs ${formatKes(exceptionRate)}.`,
          businessContext:
            'OPS-POL-001 reimburses accommodation up to KES 12,000 per night unless an approved exception is recorded before commitment.',
          employeeIds: [employee.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.PROC }],
          systemIds: [SYS.FIN],
          policyIds: ['OPS-POL-001', 'FIN-POL-001'],
          events: [
            `Two nights of accommodation are booked at ${formatKes(standardRate)} per night, within the standard cap.`,
            `The third night is only available at ${formatKes(exceptionRate)}, above the standard cap.`,
            'An exception request is documented and approved before the booking is committed.',
          ],
          expectedOutcome: `The first two nights at ${formatKes(
            standardRate,
          )} require no exception, since they sit exactly at the OPS-POL-001 cap. The third night at ${formatKes(
            exceptionRate,
          )} exceeds the cap and requires a documented exception approved before the booking is committed, not claimed afterward.`,
          relevantFacts: [
            `Two nights are booked at ${formatKes(standardRate)}; one night is booked at ${formatKes(exceptionRate)}.`,
            "OPS-POL-001: 'Accommodation is reimbursed up to KES 12,000 per night unless an approved exception is recorded.'",
            "FIN-POL-001: 'Meal claims are capped at KES 3,000 per person per meal and accommodation at KES 12,000 per night unless a documented exception is approved before commitment.'",
          ],
          requiredReasoning: [
            'Compare each night\'s rate against the KES 12,000 cap individually.',
            'Identify that only the night above the cap requires an exception.',
            'Confirm the exception must be approved before commitment, not after the fact.',
          ],
          relationships: [{ from: employee.employeeId, type: 'belongs_to', to: DEPT.PROC }],
          difficulty: 'medium',
          questionTypes: ['comparison', 'policy_lookup', 'exception'],
          tags: ['travel', 'procurement', 'boundary'],
        },
        indexes,
      ),
    );
  }

  // C. Travel expense submission (mileage and meals)
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0009', 'employee');
    const distanceKm = 220;
    const mileageRate = 45;
    const mealClaim = 3_000;
    scenarios.push(
      assembleScenario(
        {
          category: 'travel',
          idPrefix: 'TRV',
          idNumber: 3,
          title: `${employeeName(employee)} claims mileage and meals for a personal-vehicle business trip`,
          description: `${employeeName(
            employee,
          )} (Legal Manager) drove ${distanceKm} km in a personal vehicle for an authorised business trip and claims mileage plus a ${formatKes(
            mealClaim,
          )} per-person meal expense, with route and receipt evidence attached.`,
          businessContext: `OPS-POL-001 and FIN-POL-001 set mileage at KES ${mileageRate} per kilometre with route evidence, and cap meal claims at KES 3,000 per person per meal.`,
          employeeIds: [employee.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.LEGAL }],
          systemIds: [SYS.FIN],
          policyIds: ['OPS-POL-001', 'FIN-POL-001'],
          events: [
            `${employeeName(employee)} records the route, date, purpose and distance (${distanceKm} km) for the journey.`,
            `Mileage is calculated at KES ${mileageRate} per kilometre.`,
            `A meal expense of ${formatKes(mealClaim)} per person is claimed with a receipt.`,
            'The claim is submitted in Microsoft Dynamics 365 Finance within 10 calendar days.',
          ],
          expectedOutcome: `The mileage claim totals ${formatKes(
            distanceKm * mileageRate,
          )} (${distanceKm} km at KES ${mileageRate} per km), fully reimbursable with route evidence. The ${formatKes(
            mealClaim,
          )} meal claim is exactly at the KES 3,000 per-person cap and requires no exception.`,
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) drove ${distanceKm} km with route evidence recorded.`,
            `A meal expense of ${formatKes(mealClaim)} per person was claimed.`,
            `OPS-POL-001: 'Approved personal-vehicle mileage is KES 45 per kilometre with route evidence.'`,
            "FIN-POL-001: 'Meal claims are capped at KES 3,000 per person per meal.'",
          ],
          requiredReasoning: [
            'Calculate the mileage reimbursement from distance and rate.',
            'Compare the meal claim against the per-person cap.',
            'Confirm both are within policy without requiring an exception.',
          ],
          relationships: [{ from: employee.employeeId, type: 'belongs_to', to: DEPT.LEGAL }],
          difficulty: 'medium',
          questionTypes: ['calculation', 'policy_lookup'],
          tags: ['travel', 'expense-claim', 'legal'],
        },
        indexes,
      ),
    );
  }

  // D. Emergency business travel
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0007', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'travel',
          idPrefix: 'TRV',
          idNumber: 4,
          title: `${employeeName(employee)} is dispatched to Mombasa on short notice to resolve a critical system issue`,
          description: `Following a critical system disruption affecting the Mombasa Distribution Centre, ${employeeName(
            employee,
          )} (IT Manager) travels there same-day without the usual advance booking process, since resolving the issue on-site could not wait for standard travel authorisation.`,
          businessContext:
            'OPS-POL-001 permits emergency travel to be recorded as soon as practicable and regularised after the event, rather than blocking urgent business-critical travel on process grounds.',
          employeeIds: [employee.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.IT }, { type: 'warehouse', id: 'WH-MSA-001' }],
          systemIds: [SYS.FIN, SYS.SD],
          policyIds: ['OPS-POL-001', 'FIN-POL-002'],
          events: [
            'A critical system issue affecting Mombasa operations is identified.',
            `${employeeName(employee)} travels same-day without advance booking.`,
            'The trip purpose, dates and cost are recorded as soon as practicable after departure.',
            'The travel is regularised and approved retrospectively under the financial matrix.',
          ],
          expectedOutcome:
            'The same-day travel is permitted as an emergency trip under OPS-POL-001, but it is not exempt from records: the purpose, dates and cost must still be documented as soon as practicable and the trip regularised and approved retrospectively under the FIN-POL-002 matrix.',
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) travelled to Mombasa same-day to address a critical system issue.`,
            "OPS-POL-001: 'Emergency travel is recorded as soon as practicable and regularised after the event.'",
          ],
          requiredReasoning: [
            'Confirm the urgency justifies bypassing the standard advance-booking sequence.',
            'Identify what documentation is still required despite the emergency.',
            'Identify when and how retrospective approval occurs.',
          ],
          relationships: [{ from: employee.employeeId, type: 'belongs_to', to: DEPT.IT }],
          difficulty: 'medium',
          questionTypes: ['workflow', 'exception', 'policy_lookup'],
          tags: ['travel', 'emergency', 'it'],
        },
        indexes,
      ),
    );
  }

  // E. Travel-related hospitality compliance concern
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0016', 'employee');
    const supplier = mustGet(indexes.supplierById, 'SUP-002', 'supplier');
    const disclosableAmount = 15_000;
    const prohibitedAmount = 22_000;
    scenarios.push(
      assembleScenario(
        {
          category: 'travel',
          idPrefix: 'TRV',
          idNumber: 5,
          title: `${supplier.tradingName} offers escalating hospitality during a site-visit trip`,
          description: `During a site visit to ${supplier.tradingName}'s facility, ${employeeName(
            employee,
          )} (Procurement Officer) is offered dinner hospitality valued at approximately ${formatKes(
            disclosableAmount,
          )} per person, and separately offered a weekend hospitality package valued at approximately ${formatKes(
            prohibitedAmount,
          )} per person.`,
          businessContext:
            'COMP-POL-002 requires gifts or hospitality of KES 5,000 or more per person to be disclosed before acceptance, and prohibits anything at or above KES 20,000 outright.',
          employeeIds: [employee.employeeId],
          entityRefs: [{ type: 'supplier', id: supplier.supplierId }],
          systemIds: [SYS.DMS],
          policyIds: ['COMP-POL-002', 'OPS-POL-001'],
          events: [
            `${supplier.tradingName} offers dinner hospitality valued at approximately ${formatKes(disclosableAmount)} per person.`,
            `${supplier.tradingName} separately offers a weekend hospitality package valued at approximately ${formatKes(
              prohibitedAmount,
            )} per person.`,
            'Both offers are assessed against the COMP-POL-002 gift and hospitality thresholds before any response.',
          ],
          expectedOutcome: `The ${formatKes(
            disclosableAmount,
          )} dinner is above the KES 5,000 disclosure threshold and must be disclosed to the Compliance Manager before acceptance and recorded in the gifts register, but is not automatically prohibited. The ${formatKes(
            prohibitedAmount,
          )} weekend package is at or above the KES 20,000 threshold and must be declined outright, regardless of disclosure.`,
          relevantFacts: [
            `${supplier.tradingName} (${supplier.supplierId}) is a current supplier, and ${employeeName(
              employee,
            )} (${employee.employeeId}) is involved in procurement decisions affecting them.`,
            `One offer is valued at approximately ${formatKes(disclosableAmount)} per person; the other at approximately ${formatKes(
              prohibitedAmount,
            )} per person.`,
            "COMP-POL-002: 'Gifts or hospitality valued at KES 5,000 or more per person must be disclosed to the Compliance Manager before acceptance where practicable and recorded in the gifts register. Gifts or hospitality at or above KES 20,000, cash or cash equivalents, and anything intended to influence a tender, approval, inspection or payment are prohibited.'",
          ],
          requiredReasoning: [
            'Compare each offer against the KES 5,000 disclosure threshold and the KES 20,000 prohibition threshold separately.',
            'Determine that the two offers fall on different sides of the prohibition line.',
            'Identify the correct action for each: disclose-and-may-accept versus decline outright.',
          ],
          relationships: [{ from: employee.employeeId, type: 'offered_hospitality_by', to: supplier.supplierId }],
          difficulty: 'hard',
          questionTypes: ['comparison', 'compliance', 'exception'],
          tags: ['travel', 'compliance', 'gifts-and-hospitality', 'negative', 'boundary'],
        },
        indexes,
      ),
    );
  }

  return scenarios;
}

// ---------------------------------------------------------------------------
// Category 9: Compliance
// ---------------------------------------------------------------------------

function generateComplianceScenarios(indexes: Indexes): Scenario[] {
  const scenarios: Scenario[] = [];
  const complianceManager = mustGet(indexes.employeeById, 'EMP-0008', 'employee');

  // A. Personal data request
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0038', 'employee');
    const hrManager = mustGet(indexes.employeeById, 'EMP-0003', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'compliance',
          idPrefix: 'COMP',
          idNumber: 1,
          title: `${employeeName(employee)} requests a copy of their own personal data held by HR`,
          description: `${employeeName(
            employee,
          )} asks Human Resources for a copy of the personal data SVGA holds about them in the Employee Management System.`,
          businessContext:
            'COMP-POL-001 requires data subject requests to be logged with Compliance, which coordinates with the record owner while preserving any applicable legal or investigation hold.',
          employeeIds: [employee.employeeId, hrManager.employeeId, complianceManager.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.HR }],
          systemIds: [SYS.HR, SYS.DMS],
          policyIds: ['COMP-POL-001', 'GEN-POL-001'],
          events: [
            `${employeeName(employee)} submits a request for their own personal data held in the Employee Management System.`,
            `${employeeName(complianceManager)} (Compliance Manager) logs the request.`,
            `${employeeName(hrManager)} (HR Manager), as record owner, coordinates the response.`,
            'The response is provided unless an active legal hold, investigation or dispute requires preservation instead.',
          ],
          expectedOutcome:
            'The request should be logged with Compliance and coordinated with HR as the record owner; the employee is entitled to their own personal data absent an active legal hold, investigation or unresolved dispute, which would be identified and explained rather than silently withholding the data.',
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) requested their own personal data from department ${DEPT.HR}.`,
            "COMP-POL-001: 'Data subject requests, corrections, access questions and deletion or retention concerns are logged with Compliance, which coordinates with the record owner and preserves applicable legal or investigation holds.'",
          ],
          requiredReasoning: [
            'Identify who logs and coordinates a data subject request.',
            'Identify the only grounds on which the data could be withheld.',
          ],
          relationships: [{ from: employee.employeeId, type: 'belongs_to', to: DEPT.HR }],
          difficulty: 'medium',
          questionTypes: ['policy_lookup', 'workflow'],
          tags: ['compliance', 'data-protection'],
        },
        indexes,
      ),
    );
  }

  // B. Data incident: accidental exposure
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0018', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'compliance',
          idPrefix: 'COMP',
          idNumber: 2,
          title: `${employeeName(employee)} accidentally emails a customer contact list to the wrong recipient`,
          description: `${employeeName(
            employee,
          )} (Sales Representative) exports a customer contact list from Microsoft Dynamics 365 Sales and accidentally emails it to an external address instead of the intended internal recipient.`,
          businessContext:
            'COMP-POL-001 requires suspected loss, misdirection or unauthorised disclosure to be reported immediately through the IT Service Desk and to Compliance; IT-POL-002 governs the incident triage.',
          employeeIds: [employee.employeeId, complianceManager.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.SALES }],
          systemIds: [SYS.SALES, SYS.SD, SYS.DMS],
          policyIds: ['COMP-POL-001', 'IT-POL-002', 'GEN-POL-001'],
          events: [
            `${employeeName(employee)} realises the customer contact list was sent to the wrong, external recipient.`,
            'The employee reports the misdirection immediately through the IT Service Desk and to Compliance.',
            'The first response preserves evidence rather than forwarding the data further.',
            `${employeeName(complianceManager)} (Compliance Manager) assesses scope, containment and notification needs.`,
          ],
          expectedOutcome:
            'This is a reportable data incident: it must be reported immediately, not quietly corrected. Compliance assesses the scope of exposure, containment (such as requesting deletion by the recipient) and whether affected customers or authorities must be notified, following COMP-POL-001 and the IT-POL-002 incident process.',
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) sent a customer contact list to an external, unintended recipient.`,
            "COMP-POL-001: 'Employees report suspected loss, misdirection, unauthorised access, malware, disclosure or excessive access immediately through the IT Service Desk and to Compliance... The first response preserves evidence and avoids forwarding sensitive data unnecessarily.'",
          ],
          requiredReasoning: [
            'Recognise that a misdirected email containing personal data is a reportable incident, not a minor mistake.',
            'Identify the immediate reporting obligation and to whom.',
            'Identify what Compliance must assess once notified.',
          ],
          relationships: [{ from: employee.employeeId, type: 'belongs_to', to: DEPT.SALES }],
          difficulty: 'hard',
          questionTypes: ['exception', 'compliance', 'workflow'],
          tags: ['compliance', 'data-protection', 'negative'],
        },
        indexes,
      ),
    );
  }

  // C. Conflict of interest (Compliance investigation angle)
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0004', 'employee');
    const supplier = mustGet(indexes.supplierById, 'SUP-007', 'supplier');
    scenarios.push(
      assembleScenario(
        {
          category: 'compliance',
          idPrefix: 'COMP',
          idNumber: 3,
          title: `Compliance investigates whether the Procurement Manager has an undisclosed interest in ${supplier.tradingName}`,
          description: `An anonymous concern is raised with Compliance suggesting ${employeeName(
            employee,
          )} (Procurement Manager) may have a financial interest in ${supplier.tradingName}, a supplier whose contracts she personally approves.`,
          businessContext:
            'COMP-POL-002 requires Compliance to determine investigation scope and preserve relevant records, and prohibits the subject of the concern from investigating themselves.',
          employeeIds: [employee.employeeId, complianceManager.employeeId],
          entityRefs: [{ type: 'supplier', id: supplier.supplierId }],
          systemIds: [SYS.DMS, SYS.SCM],
          policyIds: ['COMP-POL-002', 'PROC-POL-002', 'GEN-POL-001'],
          events: [
            'An anonymous concern is reported to Compliance about a possible undisclosed financial interest.',
            `${employeeName(complianceManager)} (Compliance Manager) determines the investigation scope.`,
            `${employeeName(employee)} is not permitted to review or approve further contracts with ${supplier.tradingName} while the concern is investigated.`,
            'Relevant records are preserved under GEN-POL-001 pending the outcome.',
          ],
          expectedOutcome: `${employeeName(
            employee,
          )} must be withdrawn from any decision involving ${supplier.tradingName} while Compliance investigates; PROC-POL-002 approvals for that supplier require an alternative approver during this period, and the employee "cooperate[s] and does not investigate a subject they are connected to" per COMP-POL-002.`,
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) holds role ${employee.roleId} (Procurement Manager), which approves inclusion of suppliers such as ${supplier.tradingName} (${supplier.supplierId}) on the approved list.`,
            "COMP-POL-002: 'Compliance determines investigation scope, preserves relevant records under GEN-POL-001 and coordinates with Legal or HR when needed. Employees cooperate and do not investigate a subject they are connected to.'",
          ],
          requiredReasoning: [
            'Identify the conflict between the role that approves this supplier and the person under investigation.',
            'Determine who takes over approval authority for this supplier during the investigation.',
            'Identify the records-preservation obligation that applies regardless of outcome.',
          ],
          relationships: [{ from: employee.employeeId, type: 'investigated_regarding', to: supplier.supplierId }],
          difficulty: 'hard',
          questionTypes: ['compliance', 'exception', 'multi_hop'],
          tags: ['compliance', 'conflict-of-interest', 'negative', 'procurement'],
        },
        indexes,
      ),
    );
  }

  // D. Hospitality boundary (Compliance-side, distinct pairing from Travel category)
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0021', 'employee');
    const supplier = mustGet(indexes.supplierById, 'SUP-001', 'supplier');
    const giftValue = 5_000;
    scenarios.push(
      assembleScenario(
        {
          category: 'compliance',
          idPrefix: 'COMP',
          idNumber: 4,
          title: `${supplier.tradingName} offers ${employeeName(employee)} a gift valued at exactly the disclosure threshold`,
          description: `${supplier.tradingName} offers ${employeeName(
            employee,
          )} (Inventory Manager) a corporate gift valued at exactly ${formatKes(
            giftValue,
          )} at the end of a supplier review meeting.`,
          businessContext:
            'COMP-POL-002 requires gifts or hospitality of KES 5,000 or more per person to be disclosed to the Compliance Manager before acceptance and recorded in the gifts register.',
          employeeIds: [employee.employeeId, complianceManager.employeeId],
          entityRefs: [{ type: 'supplier', id: supplier.supplierId }],
          systemIds: [SYS.DMS],
          policyIds: ['COMP-POL-002'],
          events: [
            `${supplier.tradingName} offers a gift valued at exactly ${formatKes(giftValue)}.`,
            `${employeeName(employee)} assesses the value against the COMP-POL-002 disclosure threshold.`,
            `The gift is disclosed to ${employeeName(complianceManager)} (Compliance Manager) before acceptance.`,
            'The disclosure is recorded in the gifts register.',
          ],
          expectedOutcome: `At exactly ${formatKes(
            giftValue,
          )}, the gift meets the "KES 5,000 or more" disclosure threshold and must be disclosed to the Compliance Manager before acceptance and recorded in the gifts register; it is not automatically prohibited, since it remains below the KES 20,000 prohibition threshold.`,
          relevantFacts: [
            `${supplier.tradingName} (${supplier.supplierId}) offered a gift valued at exactly ${formatKes(giftValue)}.`,
            "COMP-POL-002: 'Gifts or hospitality valued at KES 5,000 or more per person must be disclosed to the Compliance Manager before acceptance where practicable and recorded in the gifts register.'",
          ],
          requiredReasoning: [
            'Compare the exact gift value against the KES 5,000 disclosure threshold.',
            'Compare it separately against the KES 20,000 prohibition threshold.',
            'Conclude disclosure is required but the gift is not outright prohibited.',
          ],
          relationships: [{ from: employee.employeeId, type: 'offered_gift_by', to: supplier.supplierId }],
          difficulty: 'medium',
          questionTypes: ['comparison', 'policy_lookup', 'compliance'],
          tags: ['compliance', 'gifts-and-hospitality', 'boundary'],
        },
        indexes,
      ),
    );
  }

  // E. Improper payment suggestion
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0015', 'employee');
    const supplier = mustGet(indexes.supplierById, 'SUP-010', 'supplier');
    scenarios.push(
      assembleScenario(
        {
          category: 'compliance',
          idPrefix: 'COMP',
          idNumber: 5,
          title: `A ${supplier.tradingName} contact suggests a "facilitation fee" would speed up a pending purchase order`,
          description: `A contact at ${supplier.tradingName} tells ${employeeName(
            employee,
          )} (Procurement Officer) that a small "facilitation fee" paid directly to them would help expedite a delayed purchase order.`,
          businessContext:
            'COMP-POL-002 explicitly prohibits facilitation payments and requires the concern to be reported to Compliance rather than acted on or ignored.',
          employeeIds: [employee.employeeId, complianceManager.employeeId],
          entityRefs: [{ type: 'supplier', id: supplier.supplierId }],
          systemIds: [SYS.DMS],
          policyIds: ['COMP-POL-002'],
          events: [
            `A contact at ${supplier.tradingName} suggests a facilitation fee to expedite processing.`,
            `${employeeName(employee)} declines and does not make the payment.`,
            'The suggestion is reported to Compliance rather than handled informally.',
            `${employeeName(complianceManager)} (Compliance Manager) determines whether further investigation of the supplier relationship is warranted.`,
          ],
          expectedOutcome:
            'The payment must not be made under any circumstances, and the suggestion itself must be reported to Compliance. COMP-POL-002 states "facilitation payments are prohibited" and "a transaction cannot be made acceptable by labelling it a marketing cost or emergency"; the employee cannot treat this as a minor accommodation to keep the order moving.',
          relevantFacts: [
            `A contact at ${supplier.tradingName} (${supplier.supplierId}) suggested a facilitation fee to ${employeeName(
              employee,
            )} (${employee.employeeId}).`,
            "COMP-POL-002: 'Bribery includes offering, promising, giving, requesting or accepting anything of value to improperly influence a decision... Facilitation payments are prohibited.'",
            "COMP-POL-002: 'Concerns may be reported to Compliance or through the approved reporting channel.'",
          ],
          requiredReasoning: [
            'Identify that the suggested payment is a facilitation payment, not a legitimate fee.',
            'Confirm facilitation payments are prohibited outright, independent of amount.',
            'Identify the reporting obligation that follows.',
          ],
          relationships: [{ from: supplier.supplierId, type: 'suggested_payment_to', to: employee.employeeId }],
          difficulty: 'hard',
          questionTypes: ['compliance', 'exception', 'policy_lookup'],
          tags: ['compliance', 'anti-bribery', 'negative'],
        },
        indexes,
      ),
    );
  }

  return scenarios;
}

// ---------------------------------------------------------------------------
// Category 10: Cross-Domain
// ---------------------------------------------------------------------------

function generateCrossDomainScenarios(indexes: Indexes): Scenario[] {
  const scenarios: Scenario[] = [];

  // 1. New Finance employee: HR -> Employee -> Finance -> Role -> IT Access -> D365 Finance
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0033', 'employee');
    const manager = mustGet(indexes.employeeById, 'EMP-0012', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'cross-domain',
          idPrefix: 'XD',
          idNumber: 1,
          title: `Tracing a new Finance hire from HR onboarding through to live Dynamics 365 Finance access`,
          description: `${employeeName(
            employee,
          )} joined Finance as a Finance Analyst. Confirming she is fully operational requires tracing five linked facts: her HR onboarding record, her department and role, the access profile that role entitles her to, and whether that access has actually been provisioned in Microsoft Dynamics 365 Finance.`,
          businessContext:
            'This chain spans HR (onboarding), the canonical role/department register, IT access control, and the finance system itself - a genuinely multi-hop trace rather than a single-file lookup.',
          employeeIds: [employee.employeeId, manager.employeeId],
          entityRefs: [{ type: 'department', id: DEPT.FIN }, { type: 'role', id: employee.roleId }],
          systemIds: [SYS.HR, SYS.IAM, SYS.FIN],
          policyIds: ['HR-POL-002', 'IT-POL-001'],
          events: [
            'HR completes the onboarding record for the new Finance Analyst.',
            'The canonical role register confirms the Finance Analyst access profile.',
            'IT provisions that profile through the Identity and Access Management System.',
            'The employee successfully accesses Microsoft Dynamics 365 Finance for the first time.',
          ],
          expectedOutcome: `${employeeName(
            employee,
          )}'s access is correctly provisioned once all four links hold: a completed HR onboarding record, a canonical Finance Analyst role assignment in department ${DEPT.FIN}, an IT-provisioned access profile matching that role under IT-POL-001, and confirmed working access in Microsoft Dynamics 365 Finance.`,
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) holds role ${employee.roleId} in department ${DEPT.FIN}, reporting to ${employeeName(
              manager,
            )}.`,
            'HR-POL-002 requires HR to supply IT with the start date, approved role, manager and required access profile before IT provisions access.',
            'IT-POL-001 states a Finance Analyst receives the Microsoft Dynamics 365 Finance read/write transactional and reconciliation profile.',
          ],
          requiredReasoning: [
            "Resolve the employee's canonical department and role.",
            'Identify the HR-to-IT handoff required before provisioning.',
            'Identify the specific system access profile that role entitles her to.',
            'Confirm all four links (HR record, role, IT provisioning, system access) are satisfied.',
          ],
          relationships: [
            { from: employee.employeeId, type: 'reports_to', to: manager.employeeId },
            { from: employee.employeeId, type: 'belongs_to', to: DEPT.FIN },
            { from: employee.employeeId, type: 'holds_role', to: employee.roleId },
          ],
          difficulty: 'hard',
          questionTypes: ['multi_hop', 'workflow', 'policy_lookup'],
          tags: ['cross-domain', 'onboarding', 'finance', 'it-access'],
        },
        indexes,
      ),
    );
  }

  // 2. Customer order exceeds stock: Sales -> Customer -> Product -> Inventory -> Warehouse -> Procurement
  {
    const record = nthMatch(outOfStockRecords(indexes).filter((r) => r.warehouseId !== 'WH-NRB-001'), 0, 'non-hub OUT_OF_STOCK record for XD-002');
    const product = mustGet(indexes.productById, record.productId, 'product');
    const warehouse = mustGet(indexes.warehouseById, record.warehouseId, 'warehouse');
    const customer = mustGet(indexes.customerById, 'CUS-015', 'customer');
    const accountManager = mustGet(indexes.employeeById, customer.accountManagerEmployeeId, 'employee');
    const requestedQuantity = 500;
    const supplierId = product.supplierIds[0];
    const supplier = mustGet(indexes.supplierById, supplierId, 'supplier');
    scenarios.push(
      assembleScenario(
        {
          category: 'cross-domain',
          idPrefix: 'XD',
          idNumber: 2,
          title: `${customer.tradingName}'s order for ${product.name} cannot be filled from ${warehouse.name} and triggers a procurement question`,
          description: `${customer.tradingName} requests ${requestedQuantity} units of ${product.name} through ${employeeName(
            accountManager,
          )}. ${warehouse.name} shows zero available stock, raising the question of whether and how to replenish before the order can be promised.`,
          businessContext:
            'This chain runs from the customer relationship through the product and its inventory position, into the warehouse holding it, and out to the supplier who could replenish it.',
          employeeIds: [accountManager.employeeId],
          entityRefs: [
            { type: 'customer', id: customer.customerId },
            { type: 'product', id: product.productId },
            { type: 'inventory', id: record.inventoryId },
            { type: 'warehouse', id: warehouse.warehouseId },
            { type: 'supplier', id: supplier.supplierId },
          ],
          systemIds: [SYS.SALES, SYS.SCM],
          policyIds: ['SALES-POL-001', 'INV-POL-001', 'PROC-POL-001'],
          events: [
            `${customer.tradingName} requests ${requestedQuantity} units of ${product.name}.`,
            `${warehouse.name} reports quantityAvailable of ${record.quantityAvailable}.`,
            'Sales cannot promise the order from this warehouse as it stands.',
            `Inventory identifies ${supplier.tradingName} as a supplier who could replenish the product.`,
            'Procurement is asked whether an expedited purchase is warranted.',
          ],
          expectedOutcome: `The order cannot be confirmed from ${warehouse.name} as-is, since quantityAvailable is ${record.quantityAvailable} against a request for ${requestedQuantity}. Per SALES-POL-001, the account manager may offer a partial delivery, back-order or alternative product while Inventory reviews replenishment via ${supplier.tradingName} under INV-POL-001 and PROC-POL-001 - stock elsewhere or an expedited order are the two realistic paths forward.`,
          relevantFacts: [
            `${customer.tradingName} (${customer.customerId}) is managed by ${employeeName(accountManager)} and requested ${requestedQuantity} units of ${product.name} (${product.productId}).`,
            `${warehouse.name} (${warehouse.warehouseId}) has quantityAvailable ${record.quantityAvailable} for this product (inventory record ${record.inventoryId}).`,
            `${supplier.tradingName} (${supplier.supplierId}) is a supplier of this product per data/master-data/products.json.`,
          ],
          requiredReasoning: [
            'Resolve the customer to its account manager.',
            'Resolve the product to its inventory position at the relevant warehouse.',
            'Compare requested quantity against quantityAvailable.',
            'Trace the product to its supplier(s) to evaluate replenishment.',
            'Combine the Sales, Inventory and Procurement policies into one recommended course of action.',
          ],
          relationships: [
            { from: customer.customerId, type: 'managed_by', to: accountManager.employeeId },
            { from: product.productId, type: 'stocked_at', to: warehouse.warehouseId },
            { from: product.productId, type: 'supplied_by', to: supplier.supplierId },
          ],
          difficulty: 'hard',
          questionTypes: ['multi_hop', 'calculation', 'recommendation'],
          tags: ['cross-domain', 'sales', 'inventory', 'procurement'],
        },
        indexes,
      ),
    );
  }

  // 3. Inventory below reorder level: Inventory -> Product -> Supplier -> Procurement -> Finance -> Approval Matrix
  {
    const record = nthMatch(reorderRequiredRecords(indexes).filter((r) => r.warehouseId !== 'WH-NRB-001'), 0, 'non-hub REORDER_REQUIRED record for XD-003');
    const product = mustGet(indexes.productById, record.productId, 'product');
    const warehouse = mustGet(indexes.warehouseById, record.warehouseId, 'warehouse');
    const supplierId = product.supplierIds[0];
    const supplier = mustGet(indexes.supplierById, supplierId, 'supplier');
    const reorderCost = record.reorderQuantity * product.unitCost;
    const approval = resolveApproval(reorderCost, DEPT.INV, indexes);
    scenarios.push(
      assembleScenario(
        {
          category: 'cross-domain',
          idPrefix: 'XD',
          idNumber: 3,
          title: `Replenishing ${product.name} at ${warehouse.name} means resolving a supplier, a cost, and an approver`,
          description: `${product.name} at ${warehouse.name} has fallen below its reorder level. Raising the standard reorderQuantity of ${record.reorderQuantity} units from ${supplier.tradingName} at unit cost ${formatKes(
            product.unitCost,
          )} would commit approximately ${formatKes(reorderCost)}.`,
          businessContext:
            'This chain connects the inventory trigger to the product, to its supplier, to the resulting procurement commitment, and finally to the FIN-POL-002 approval matrix for that amount.',
          employeeIds: [mustGet(indexes.employeeById, 'EMP-0021', 'employee').employeeId, approval.approver.employee.employeeId],
          entityRefs: [
            { type: 'product', id: product.productId },
            { type: 'inventory', id: record.inventoryId },
            { type: 'warehouse', id: warehouse.warehouseId },
            { type: 'supplier', id: supplier.supplierId },
          ],
          systemIds: [SYS.SCM, SYS.FIN],
          policyIds: ['INV-POL-001', 'PROC-POL-001', 'FIN-POL-002'],
          events: [
            `Inventory identifies ${product.name} at ${warehouse.name} as below its reorder level.`,
            `The standard reorderQuantity of ${record.reorderQuantity} units is priced at ${formatKes(product.unitCost)} each.`,
            `The resulting commitment of approximately ${formatKes(reorderCost)} is checked against the FIN-POL-002 matrix.`,
            'A purchase requisition is raised to the resolved approver.',
          ],
          expectedOutcome: `Reordering the standard quantity (${record.reorderQuantity} units at ${formatKes(
            product.unitCost,
          )} each) commits approximately ${formatKes(reorderCost)}, which requires ${employeeName(
            approval.approver.employee,
          )} (${approval.approver.role.title}) as approver under the FIN-POL-002 matrix, in addition to the Inventory Manager's replenishment review under INV-POL-001.`,
          relevantFacts: [
            `${product.name} (${product.productId}) at ${warehouse.name} has quantityAvailable ${record.quantityAvailable}, below reorderLevel ${record.reorderLevel}, with a standard reorderQuantity of ${record.reorderQuantity} (inventory record ${record.inventoryId}).`,
            `${product.name} has unitCost ${formatKes(product.unitCost)} and is supplied by ${supplier.tradingName} (${supplier.supplierId}).`,
            ...approvalLadderFacts(approval).slice(0, 2),
          ],
          requiredReasoning: [
            'Confirm the product is below its reorder level.',
            'Identify the supplier and the standard reorder quantity and unit cost.',
            'Calculate the total commitment (reorderQuantity x unitCost).',
            'Resolve the FIN-POL-002 approver for that commitment amount.',
          ],
          relationships: [
            { from: product.productId, type: 'stocked_at', to: warehouse.warehouseId },
            { from: product.productId, type: 'supplied_by', to: supplier.supplierId },
          ],
          difficulty: 'hard',
          questionTypes: ['multi_hop', 'calculation', 'policy_lookup'],
          tags: ['cross-domain', 'inventory', 'procurement', 'finance', 'approval-matrix'],
        },
        indexes,
      ),
    );
  }

  // 4. High-value procurement at exactly KES 10,000,000: Department -> Cost Center -> Procurement -> Finance -> Supplier -> Warehouse
  {
    const amount = 10_000_000;
    const requester = mustGet(indexes.employeeById, 'EMP-0022', 'employee');
    const supplier = mustGet(indexes.supplierById, 'SUP-012', 'supplier');
    const costCenter = mustGet(indexes.costCenterById, 'CC-WH', 'costCenter');
    const approval = resolveApproval(amount, DEPT.WH, indexes);
    const cfoRole = mustGet(indexes.roleById, 'ROLE-CFO', 'role');
    scenarios.push(
      assembleScenario(
        {
          category: 'cross-domain',
          idPrefix: 'XD',
          idNumber: 4,
          title: `A ${formatKes(amount)} warehouse automation project sits exactly at the matrix's CFO ceiling`,
          description: `${employeeName(
            requester,
          )} (Warehouse Manager) proposes a ${formatKes(
            amount,
          )} project with ${supplier.tradingName} to upgrade warehouse automation systems across all four distribution centres, against cost centre ${costCenter.costCenterId}.`,
          businessContext:
            "This amount sits exactly at the FIN-POL-002 matrix's stated CFO ceiling (KES 10,000,000), but the CFO's own canonical approval limit is lower, so the correct approver depends on cross-referencing two sources, not the matrix text alone.",
          employeeIds: [requester.employeeId, approval.approver.employee.employeeId],
          entityRefs: [
            { type: 'department', id: DEPT.WH },
            { type: 'costCenter', id: costCenter.costCenterId },
            { type: 'supplier', id: supplier.supplierId },
          ],
          systemIds: [SYS.SCM, SYS.FIN],
          policyIds: ['PROC-POL-001', 'FIN-POL-002'],
          events: [
            `${employeeName(requester)} raises a requisition for ${formatKes(amount)} against cost centre ${costCenter.costCenterId}.`,
            'The amount is checked against the FIN-POL-002 matrix, which nominally caps the CFO tier at exactly this amount.',
            `The CFO's own canonical approval limit (${formatKes(cfoRole.approvalAuthority!.approvalLimitKes as number)}) is found to be lower.`,
            'The request escalates to the CEO.',
            'Finance review is triggered given the amount exceeds KES 500,000.',
          ],
          expectedOutcome: `${formatKes(
            amount,
          )} sits exactly at the matrix's stated CFO ceiling, but the CFO's own approval limit of ${formatKes(
            cfoRole.approvalAuthority!.approvalLimitKes as number,
          )} is lower, so ${employeeName(approval.approver.employee)} (${
            approval.approver.role.title
          }) is the required approver, not the CFO. Finance review under PROC-POL-001 also applies given the amount exceeds KES 500,000.`,
          relevantFacts: [
            `The request amount is ${formatKes(amount)}, exactly at the FIN-POL-002 matrix's stated CFO tier ceiling.`,
            `The CFO's approvalLimitKes in data/enterprise/roles.json is ${formatKes(
              cfoRole.approvalAuthority!.approvalLimitKes as number,
            )}.`,
            `${supplier.tradingName} (${supplier.supplierId}) is the proposed supplier.`,
          ],
          requiredReasoning: [
            "Determine the matrix tier from the amount alone.",
            "Cross-reference the CFO's actual canonical approval limit rather than relying on the matrix ceiling text.",
            'Recognise the canonical limit is lower, forcing escalation to the CEO.',
            'Separately identify the Finance-review requirement for amounts above KES 500,000.',
          ],
          relationships: [
            { from: requester.employeeId, type: 'belongs_to', to: DEPT.WH },
            { from: costCenter.costCenterId, type: 'belongs_to', to: DEPT.WH },
          ],
          difficulty: 'hard',
          questionTypes: ['multi_hop', 'calculation', 'exception'],
          tags: ['cross-domain', 'procurement', 'finance', 'approval-matrix', 'warehouse', 'boundary'],
        },
        indexes,
      ),
    );
  }

  // 5. Supplier conflict: Supplier -> Procurement -> Employee -> Conflict of Interest -> Compliance
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0004', 'employee');
    const supplier = mustGet(indexes.supplierById, 'SUP-008', 'supplier');
    const complianceManager = mustGet(indexes.employeeById, 'EMP-0008', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'cross-domain',
          idPrefix: 'XD',
          idNumber: 5,
          title: `A contract renewal with ${supplier.tradingName} surfaces a second, separate conflict-of-interest question`,
          description: `While preparing ${supplier.tradingName}'s contract renewal, ${employeeName(
            employee,
          )} (Procurement Manager) discloses that her spouse recently joined ${supplier.tradingName}'s board in a non-executive capacity.`,
          businessContext:
            'This chain runs from the supplier relationship, through the procurement approval role, to the disclosed conflict, and into the Compliance decision process.',
          employeeIds: [employee.employeeId, complianceManager.employeeId],
          entityRefs: [{ type: 'supplier', id: supplier.supplierId }],
          systemIds: [SYS.SCM, SYS.DMS],
          policyIds: ['PROC-POL-002', 'COMP-POL-002'],
          events: [
            `${supplier.tradingName}'s contract renewal is due for review.`,
            `${employeeName(employee)} proactively discloses her spouse's non-executive board role at the supplier.`,
            `${employeeName(complianceManager)} (Compliance Manager) and her manager assess the disclosure.`,
            'A decision is made on withdrawal, independent review, or continuation with controls.',
          ],
          expectedOutcome: `Because the disclosure was proactive, ${employeeName(
            employee,
          )} has met her COMP-POL-002 obligation; she must still withdraw from approving this specific supplier's renewal, and the manager and Compliance Manager decide whether an independent reviewer approves it instead or further controls are needed, per PROC-POL-002's requirement that a conflicted employee withdraw from evaluation or approval.`,
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) is the Procurement Manager who would normally approve ${supplier.tradingName}'s (${supplier.supplierId}) renewal.`,
            'The relationship (spouse on the board) was proactively disclosed before any decision was made.',
            "COMP-POL-002: 'The manager and Compliance Manager decide whether the employee must withdraw, whether an independent review is required or whether the activity must stop.'",
          ],
          requiredReasoning: [
            'Identify who would normally approve this supplier relationship.',
            'Recognise that proactive disclosure changes the response from investigation to controlled continuation.',
            'Identify who takes over the approval decision.',
          ],
          relationships: [{ from: employee.employeeId, type: 'disclosed_relationship_with', to: supplier.supplierId }],
          difficulty: 'hard',
          questionTypes: ['multi_hop', 'compliance', 'exception'],
          tags: ['cross-domain', 'supplier-management', 'conflict-of-interest', 'compliance'],
        },
        indexes,
      ),
    );
  }

  // 6. Security incident: Employee -> System -> IT Incident -> Access Control -> Data Protection -> Records
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0023', 'employee');
    const itManager = mustGet(indexes.employeeById, 'EMP-0007', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'cross-domain',
          idPrefix: 'XD',
          idNumber: 6,
          title: `An IT Support Officer's own credentials are used to access records outside his duties`,
          description: `${employeeName(
            employee,
          )} (IT Support Officer) reports that his own Enterprise Document Management System credentials were used to open compliance investigation files he has no business reason to access, from a location he was not working from.`,
          businessContext:
            'This chain runs from the affected employee, to the system involved, into IT incident triage, then to access control and data protection, and finally to the records obligation that follows.',
          employeeIds: [employee.employeeId, itManager.employeeId],
          entityRefs: [{ type: 'system', id: 'SYS-DMS' }, { type: 'system', id: 'SYS-IAM' }],
          systemIds: [SYS.DMS, SYS.IAM, SYS.SD],
          policyIds: ['IT-POL-002', 'IT-POL-001', 'COMP-POL-001', 'GEN-POL-001'],
          events: [
            `${employeeName(employee)} notices document access he did not perform under his own account.`,
            'He reports it immediately through the IT Service Desk rather than investigating it himself.',
            `${employeeName(itManager)} (IT Manager) treats this as a suspected compromised-credential incident.`,
            'The account is suspended and Compliance is engaged given the files accessed were compliance investigation records.',
            'The incident record and access logs are preserved under GEN-POL-001.',
          ],
          expectedOutcome:
            'This is escalated as a suspected credential compromise, not dismissed as a self-reported error: IT-POL-002 governs the incident response, IT-POL-001 governs suspending and resetting the account, COMP-POL-001 governs the fact that compliance investigation records (likely containing personal data) were accessed without business need, and GEN-POL-001 requires the evidence to be preserved rather than the logs being cleared.',
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) reported access to compliance investigation files he did not perform.`,
            'The access occurred from a location inconsistent with his normal work pattern.',
            "COMP-POL-001: 'Employees report suspected loss, misdirection, unauthorised access, malware, disclosure or excessive access immediately through the IT Service Desk and to Compliance.'",
          ],
          requiredReasoning: [
            'Identify that self-reporting does not reduce this to a routine ticket.',
            'Determine why the specific files accessed (compliance investigation records) matter to the response.',
            'Identify the four policies each governing a different part of the response.',
          ],
          relationships: [{ from: employee.employeeId, type: 'flagged_on', to: 'SYS-DMS' }],
          difficulty: 'hard',
          questionTypes: ['multi_hop', 'compliance', 'exception'],
          tags: ['cross-domain', 'incidents', 'compliance', 'it-access', 'negative'],
        },
        indexes,
      ),
    );
  }

  // 7. Travel expense: Employee -> Travel -> Financial Approval -> Expense -> Records
  {
    const employee = mustGet(indexes.employeeById, 'EMP-0008', 'employee');
    const supplier = mustGet(indexes.supplierById, 'SUP-006', 'supplier');
    scenarios.push(
      assembleScenario(
        {
          category: 'cross-domain',
          idPrefix: 'XD',
          idNumber: 7,
          title: `${employeeName(employee)}'s Kisumu supplier-audit trip must be traced from travel authorisation to the retained expense record`,
          description: `${employeeName(
            employee,
          )} (Compliance Manager) travels to Kisumu to audit ${supplier.tradingName} on-site, then submits a travel expense claim covering accommodation, meals and local transport.`,
          businessContext:
            'This chain runs from the travel authorisation, through the financial approval matrix, to the expense claim itself, and finally to the records-retention obligation.',
          employeeIds: [employee.employeeId],
          entityRefs: [{ type: 'supplier', id: supplier.supplierId }, { type: 'department', id: DEPT.COMP }],
          systemIds: [SYS.FIN, SYS.DMS],
          policyIds: ['OPS-POL-001', 'FIN-POL-001', 'FIN-POL-002', 'GEN-POL-001'],
          events: [
            `${employeeName(employee)} documents the purpose, destination and estimated cost of the Kisumu audit trip.`,
            'The trip is approved under the FIN-POL-002 matrix before booking.',
            `${employeeName(employee)} submits the expense claim in Microsoft Dynamics 365 Finance within 10 calendar days of return.`,
            'The travel authorisation, itinerary, claim and receipts are retained under GEN-POL-001.',
          ],
          expectedOutcome:
            'The full chain must hold together: OPS-POL-001 governs the travel authorisation and approval routing through FIN-POL-002, FIN-POL-001 governs the expense claim itself (receipts, caps, the 10-day submission window), and GEN-POL-001 requires the travel authorisation, itinerary, claim and receipts to all be retained as one traceable record.',
          relevantFacts: [
            `${employeeName(employee)} (${employee.employeeId}) travelled to Kisumu to audit ${supplier.tradingName} (${supplier.supplierId}).`,
            "OPS-POL-001: 'Operations keeps the travel authorisation and itinerary record; Finance keeps the claim, advance and payment evidence.'",
            "GEN-POL-001 sets a default 7-year retention for corporate control records.",
          ],
          requiredReasoning: [
            'Identify which policy governs the travel authorisation versus the expense claim.',
            'Identify the approval route for the trip cost.',
            'Identify what must be retained and for how long.',
          ],
          relationships: [{ from: employee.employeeId, type: 'belongs_to', to: DEPT.COMP }],
          difficulty: 'medium',
          questionTypes: ['multi_hop', 'workflow', 'policy_lookup'],
          tags: ['cross-domain', 'travel', 'finance', 'records', 'compliance'],
        },
        indexes,
      ),
    );
  }

  // 8. Damaged inventory: Warehouse -> Inventory -> Stock Adjustment -> Finance -> Records
  {
    const product = mustGet(indexes.productById, 'PRD-021', 'product');
    const warehouse = mustGet(indexes.warehouseById, 'WH-NKR-001', 'warehouse');
    const writeOffValue = 45_000;
    const approval = resolveApproval(writeOffValue, DEPT.WH, indexes);
    scenarios.push(
      assembleScenario(
        {
          category: 'cross-domain',
          idPrefix: 'XD',
          idNumber: 8,
          title: `A ${formatKes(writeOffValue)} write-off for water-damaged ${product.name} must pass through Inventory, Finance and Records`,
          description: `${warehouse.name} identifies water-damaged cartons of ${product.name} valued at approximately ${formatKes(
            writeOffValue,
          )}. The stock is segregated, and the write-off must be approved and recorded before it leaves the books.`,
          businessContext:
            'This chain runs from the physical warehouse finding, through the Inventory Manager\'s accounting treatment, to the financial approval matrix, and into the retained record.',
          employeeIds: [
            mustGet(indexes.employeeById, 'EMP-0022', 'employee').employeeId,
            mustGet(indexes.employeeById, 'EMP-0021', 'employee').employeeId,
            approval.approver.employee.employeeId,
          ],
          entityRefs: [
            { type: 'product', id: product.productId },
            { type: 'warehouse', id: warehouse.warehouseId },
          ],
          systemIds: [SYS.SCM, SYS.FIN, SYS.DMS],
          policyIds: ['WH-POL-001', 'INV-POL-001', 'FIN-POL-002', 'GEN-POL-001'],
          events: [
            `${warehouse.name} identifies water-damaged cartons of ${product.name} valued at ${formatKes(writeOffValue)}.`,
            'The stock is segregated, labelled and held from sale.',
            'The Inventory Manager proposes a write-off for the damaged quantity.',
            `${employeeName(approval.approver.employee)} (${approval.approver.role.title}) approves the write-off under FIN-POL-002.`,
            'The count evidence, approval and adjustment are retained under GEN-POL-001.',
          ],
          expectedOutcome: `The ${formatKes(
            writeOffValue,
          )} write-off requires the Inventory Manager's sign-off under INV-POL-001 plus ${employeeName(
            approval.approver.employee,
          )} (${
            approval.approver.role.title
          })'s approval under the FIN-POL-002 matrix for this amount; the warehouse cannot post the adjustment unilaterally, and the full evidence trail is retained under GEN-POL-001.`,
          relevantFacts: [
            `${product.name} (${product.productId}) at ${warehouse.name} (${warehouse.warehouseId}) has an estimated damaged-stock value of ${formatKes(
              writeOffValue,
            )}.`,
            "WH-POL-001: 'The warehouse may not create an unexplained adjustment.'",
            "INV-POL-001: 'Write-offs for damage, expiry, loss or obsolescence require the Inventory Manager and the approval level in FIN-POL-002.'",
          ],
          requiredReasoning: [
            'Identify the physical control step (segregation) versus the accounting step (write-off).',
            "Resolve the FIN-POL-002 approver for this amount.",
            'Identify what must be retained once the write-off is approved.',
          ],
          relationships: [{ from: product.productId, type: 'stocked_at', to: warehouse.warehouseId }],
          difficulty: 'hard',
          questionTypes: ['multi_hop', 'calculation', 'workflow'],
          tags: ['cross-domain', 'inventory', 'warehouse', 'finance', 'records'],
        },
        indexes,
      ),
    );
  }

  // 9. Customer return: Customer -> Sales -> Warehouse -> Inventory -> Records
  {
    const customer = mustGet(indexes.customerById, 'CUS-011', 'customer');
    const accountManager = mustGet(indexes.employeeById, customer.accountManagerEmployeeId, 'employee');
    const product = mustGet(indexes.productById, 'PRD-011', 'product');
    const warehouse = mustGet(indexes.warehouseById, 'WH-NRB-001', 'warehouse');
    scenarios.push(
      assembleScenario(
        {
          category: 'cross-domain',
          idPrefix: 'XD',
          idNumber: 9,
          title: `${customer.tradingName}'s return of ${product.name} must be traced from the customer complaint to the retained record`,
          description: `${customer.tradingName} reports several tins of ${product.name} received from ${warehouse.name} were past their best-before indication and requests a return and credit.`,
          businessContext:
            'This chain runs from the customer complaint, through the Sales return process, into the warehouse condition assessment and inventory disposition, and finally to the retained record.',
          employeeIds: [accountManager.employeeId],
          entityRefs: [
            { type: 'customer', id: customer.customerId },
            { type: 'product', id: product.productId },
            { type: 'warehouse', id: warehouse.warehouseId },
          ],
          systemIds: [SYS.SALES, SYS.SCM, SYS.DMS],
          policyIds: ['SALES-POL-001', 'WH-POL-001', 'INV-POL-001', 'GEN-POL-001'],
          events: [
            `${customer.tradingName} reports the condition issue and requests a return.`,
            `${employeeName(accountManager)} logs the return with a reason and customer reference in Microsoft Dynamics 365 Sales.`,
            `${warehouse.name} assesses the condition of the returned stock on arrival.`,
            'Inventory determines the disposition (return to saleable stock, write-off, or supplier claim).',
            'The complaint, return, assessment and disposition are retained as one linked record.',
          ],
          expectedOutcome:
            'The return must pass through each step before a credit is issued: a logged reason and customer reference, a Warehouse condition assessment, an Inventory disposition decision under INV-POL-001, and a retained record connecting the original complaint to the final outcome under GEN-POL-001 - a credit cannot be issued from the complaint alone.',
          relevantFacts: [
            `${customer.tradingName} (${customer.customerId}) is managed by ${employeeName(accountManager)}.`,
            `${product.name} (${product.productId}) was received by the customer via ${warehouse.name} (${warehouse.warehouseId}).`,
            "SALES-POL-001: 'Returns require a reason, customer reference, condition assessment and approval before stock is returned or a credit is issued.'",
          ],
          requiredReasoning: [
            'Identify each step the return must pass through, in order.',
            'Identify which department performs the condition assessment.',
            'Identify what must be retained once the return is resolved.',
          ],
          relationships: [
            { from: customer.customerId, type: 'managed_by', to: accountManager.employeeId },
            { from: product.productId, type: 'dispatched_from', to: warehouse.warehouseId },
          ],
          difficulty: 'hard',
          questionTypes: ['multi_hop', 'workflow'],
          tags: ['cross-domain', 'sales', 'warehouse', 'inventory', 'records'],
        },
        indexes,
      ),
    );
  }

  // 10. Supplier suspension: Supplier -> Supplier Management -> Procurement -> Compliance -> Purchasing
  {
    const supplier = mustGet(indexes.supplierById, 'SUP-009', 'supplier');
    const procurementManager = mustGet(indexes.employeeById, 'EMP-0004', 'employee');
    const complianceManager = mustGet(indexes.employeeById, 'EMP-0008', 'employee');
    scenarios.push(
      assembleScenario(
        {
          category: 'cross-domain',
          idPrefix: 'XD',
          idNumber: 10,
          title: `${supplier.tradingName}'s suspension must block purchasing without disrupting existing commitments`,
          description: `${supplier.tradingName} is suspended following a sanctions-screening concern raised by Compliance. Procurement must determine what this means for open and future purchase orders.`,
          businessContext:
            'This chain runs from the supplier record, through supplier-management suspension rules, into the Procurement Manager\'s authority, Compliance\'s ongoing role, and the effect on active purchasing.',
          employeeIds: [procurementManager.employeeId, complianceManager.employeeId],
          entityRefs: [{ type: 'supplier', id: supplier.supplierId }],
          systemIds: [SYS.SCM, SYS.DMS],
          policyIds: ['PROC-POL-002', 'COMP-POL-002'],
          events: [
            `${employeeName(complianceManager)} (Compliance Manager) raises a sanctions-screening concern about ${supplier.tradingName}.`,
            `${employeeName(procurementManager)} (Procurement Manager) records the supplier as suspended.`,
            'New purchase orders to this supplier are blocked in Microsoft Dynamics 365 Supply Chain Management.',
            'Existing open commitments are reviewed separately for closure or continuation.',
          ],
          expectedOutcome: `${supplier.tradingName}'s suspension blocks new purchase orders immediately; only ${employeeName(
            procurementManager,
          )} (Procurement Manager) can record reinstatement or termination, and that decision follows further Compliance input given the sanctions-screening trigger. Existing open commitments are reviewed on their own terms rather than being automatically cancelled.`,
          relevantFacts: [
            `${supplier.tradingName} (${supplier.supplierId}) is suspended following a sanctions-screening concern.`,
            "PROC-POL-002: 'A supplier may be suspended for quality failure, suspected fraud, conflict, sanctions concern, data incident or repeated non-performance; suspension blocks new purchase orders until the Procurement Manager records reinstatement or termination.'",
          ],
          requiredReasoning: [
            'Identify the suspension trigger and who raised it.',
            'Identify who has sole authority to lift the suspension.',
            'Distinguish the effect on new orders from the effect on existing commitments.',
          ],
          relationships: [{ from: supplier.supplierId, type: 'suspended_by', to: procurementManager.employeeId }],
          difficulty: 'hard',
          questionTypes: ['multi_hop', 'exception', 'compliance'],
          tags: ['cross-domain', 'supplier-management', 'procurement', 'compliance', 'negative'],
        },
        indexes,
      ),
    );
  }

  // 11. Customer credit limit breach: Sales -> Customer -> Credit Limit -> Finance Approval -> Compliance monitoring
  {
    const customer = mustGet(indexes.customerById, 'CUS-006', 'customer');
    const accountManager = mustGet(indexes.employeeById, customer.accountManagerEmployeeId, 'employee');
    const salesManager = mustGet(indexes.employeeById, 'EMP-0005', 'employee');
    const orderValue = 320_000;
    scenarios.push(
      assembleScenario(
        {
          category: 'cross-domain',
          idPrefix: 'XD',
          idNumber: 11,
          title: `${customer.tradingName}'s ${formatKes(orderValue)} order exceeds its ${formatKes(customer.creditLimit)} credit limit`,
          description: `${customer.tradingName} places an order valued at ${formatKes(
            orderValue,
          )}, above its current creditLimit of ${formatKes(customer.creditLimit)}. The order must be resolved across Sales, Finance and Compliance before dispatch.`,
          businessContext:
            'This chain runs from the sales order, through the credit-limit control, to the Sales Manager and Finance approval required to exceed it, and into Compliance monitoring of credit-limit breaches.',
          employeeIds: [accountManager.employeeId, salesManager.employeeId],
          entityRefs: [{ type: 'customer', id: customer.customerId }],
          systemIds: [SYS.SALES, SYS.FIN],
          policyIds: ['SALES-POL-001', 'FIN-POL-002'],
          events: [
            `${customer.tradingName} places an order valued at ${formatKes(orderValue)}.`,
            `The order is checked against the customer's creditLimit of ${formatKes(customer.creditLimit)} and found to exceed it.`,
            `${employeeName(salesManager)} (Sales Manager) reviews whether a temporary credit exception is warranted.`,
            'Finance confirms whether the exception is approved before the order is released to Warehouse.',
            'Sales Managers review credit breaches as part of ongoing monitoring.',
          ],
          expectedOutcome: `The order cannot be released as a routine transaction: it exceeds the customer's credit limit by ${formatKes(
            orderValue - customer.creditLimit,
          )}. Per SALES-POL-001, this requires the Sales Manager to review and, given it is a credit exception, Finance confirmation before the order proceeds; SALES-POL-001 also requires ongoing monitoring of credit breaches as a management reporting item.`,
          relevantFacts: [
            `${customer.tradingName} (${customer.customerId}) has creditLimit ${formatKes(
              customer.creditLimit,
            )} in data/master-data/customers.json.`,
            `The new order is valued at ${formatKes(orderValue)}, exceeding the limit by ${formatKes(orderValue - customer.creditLimit)}.`,
            "SALES-POL-001: 'The order is checked for approval, credit status and pricing before confirmation... Sales Managers review order ageing, cancelled orders, credit breaches, stock-outs, returns and unusual discounts.'",
          ],
          requiredReasoning: [
            "Compare the order value against the customer's credit limit.",
            'Calculate the amount by which the limit is exceeded.',
            'Identify who must approve an exception to proceed.',
            'Identify the ongoing monitoring obligation this breach creates.',
          ],
          relationships: [
            { from: customer.customerId, type: 'managed_by', to: accountManager.employeeId },
            { from: customer.customerId, type: 'reviewed_by', to: salesManager.employeeId },
          ],
          difficulty: 'hard',
          questionTypes: ['multi_hop', 'calculation', 'exception'],
          tags: ['cross-domain', 'sales', 'finance', 'compliance', 'credit-control'],
        },
        indexes,
      ),
    );
  }

  return scenarios;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

class ScenarioValidationError extends Error {
  constructor(issues: string[]) {
    super(`Scenario validation failed with ${issues.length} issue(s):\n- ${issues.join('\n- ')}`);
    this.name = 'ScenarioValidationError';
  }
}

const ALLOWED_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/** Per-scenario structural and referential checks (defensive re-check: assembleScenario already resolves every reference via mustGet, which throws immediately on any bad id). */
function validateScenario(scenario: Scenario, indexes: Indexes): string[] {
  const issues: string[] = [];

  if (!ALLOWED_DIFFICULTIES.includes(scenario.difficulty)) {
    issues.push(`${scenario.id}: invalid difficulty "${scenario.difficulty}"`);
  }
  if (scenario.questionTypes.length === 0) issues.push(`${scenario.id}: no questionTypes`);
  if (scenario.tags.length === 0) issues.push(`${scenario.id}: no tags`);
  if (scenario.events.length === 0) issues.push(`${scenario.id}: no events`);
  if (scenario.relevantFacts.length === 0) issues.push(`${scenario.id}: no relevantFacts`);
  if (scenario.requiredReasoning.length === 0) issues.push(`${scenario.id}: no requiredReasoning`);
  if (scenario.actors.length === 0) issues.push(`${scenario.id}: no actors`);

  scenario.events.forEach((e, i) => {
    if (e.sequence !== i + 1) issues.push(`${scenario.id}: event sequence out of order at index ${i}`);
  });

  for (const actor of scenario.actors) {
    const employee = indexes.employeeById.get(actor.employeeId);
    if (!employee) {
      issues.push(`${scenario.id}: actor references unknown employee ${actor.employeeId}`);
      continue;
    }
    if (actor.roleId !== employee.roleId || actor.departmentId !== employee.departmentId) {
      issues.push(`${scenario.id}: actor ${actor.employeeId} role/department does not match canonical employee record`);
    }
  }

  const knownIds = new Set<string>();
  scenario.entities.forEach((e) => knownIds.add(e.id));
  scenario.actors.forEach((a) => knownIds.add(a.employeeId));

  for (const sysName of scenario.systems) {
    if (!indexes.systemNameSet.has(sysName)) issues.push(`${scenario.id}: unknown system "${sysName}"`);
  }
  for (const policyId of scenario.policies) {
    if (!indexes.policyById.has(policyId)) issues.push(`${scenario.id}: unknown policy "${policyId}"`);
  }
  for (const rel of scenario.relationships) {
    if (!knownIds.has(rel.from) && !indexes.globalIdSet.has(rel.from)) {
      issues.push(`${scenario.id}: relationship "from" id "${rel.from}" does not resolve to any known entity`);
    }
    if (!knownIds.has(rel.to) && !indexes.globalIdSet.has(rel.to)) {
      issues.push(`${scenario.id}: relationship "to" id "${rel.to}" does not resolve to any known entity`);
    }
  }

  for (const entity of scenario.entities) {
    switch (entity.type) {
      case 'employee':
        if (!indexes.employeeById.has(entity.id)) issues.push(`${scenario.id}: entity references unknown employee ${entity.id}`);
        break;
      case 'department':
        if (!indexes.departmentById.has(entity.id)) issues.push(`${scenario.id}: entity references unknown department ${entity.id}`);
        break;
      case 'role':
        if (!indexes.roleById.has(entity.id)) issues.push(`${scenario.id}: entity references unknown role ${entity.id}`);
        break;
      case 'supplier':
        if (!indexes.supplierById.has(entity.id)) issues.push(`${scenario.id}: entity references unknown supplier ${entity.id}`);
        break;
      case 'customer':
        if (!indexes.customerById.has(entity.id)) issues.push(`${scenario.id}: entity references unknown customer ${entity.id}`);
        break;
      case 'product':
        if (!indexes.productById.has(entity.id)) issues.push(`${scenario.id}: entity references unknown product ${entity.id}`);
        break;
      case 'warehouse':
        if (!indexes.warehouseById.has(entity.id)) issues.push(`${scenario.id}: entity references unknown warehouse ${entity.id}`);
        break;
      case 'inventory':
        if (!indexes.inventoryById.has(entity.id)) issues.push(`${scenario.id}: entity references unknown inventory record ${entity.id}`);
        break;
      case 'costCenter':
        if (!indexes.costCenterById.has(entity.id)) issues.push(`${scenario.id}: entity references unknown cost centre ${entity.id}`);
        break;
      case 'system':
        if (!indexes.systemById.has(entity.id)) issues.push(`${scenario.id}: entity references unknown system ${entity.id}`);
        break;
      case 'policy':
        if (!indexes.policyById.has(entity.id)) issues.push(`${scenario.id}: entity references unknown policy ${entity.id}`);
        break;
    }
  }

  // Inventory consistency: for any inventory entity referenced, recompute quantityAvailable.
  for (const entity of scenario.entities) {
    if (entity.type === 'inventory') {
      const record = indexes.inventoryById.get(entity.id);
      if (record && record.quantityAvailable !== record.quantityOnHand - record.quantityReserved) {
        issues.push(`${scenario.id}: inventory record ${entity.id} has an internally inconsistent quantityAvailable`);
      }
    }
  }

  return issues;
}

function validateAllScenarios(all: Scenario[], indexes: Indexes): string[] {
  const issues: string[] = [];

  const idDupes = findDuplicates(all.map((s) => s.id));
  if (idDupes.length > 0) {
    issues.push(`Duplicate scenario IDs: ${idDupes.join(', ')}`);
  }

  for (const scenario of all) {
    issues.push(...validateScenario(scenario, indexes));
  }

  if (all.length < 50) {
    issues.push(`Only ${all.length} scenarios were generated; the minimum is 50.`);
  }

  const crossDomainCount = all.filter((s) => s.category === 'cross-domain').length;
  if (crossDomainCount < 10) {
    issues.push(`Only ${crossDomainCount} cross-domain scenarios were generated; the minimum is 10.`);
  }

  const negativeCount = all.filter((s) => s.tags.includes('negative')).length;
  if (negativeCount < 5) {
    issues.push(`Only ${negativeCount} scenarios are tagged "negative"; the minimum is 5.`);
  }

  const abstentionCount = all.filter((s) => s.tags.includes('abstention')).length;
  if (abstentionCount < 3) {
    issues.push(`Only ${abstentionCount} scenarios are tagged "abstention"; the minimum is 3.`);
  }

  for (const category of Object.keys(CATEGORY_INFO)) {
    const count = all.filter((s) => s.category === category).length;
    if (count < 5) {
      issues.push(`Category "${category}" has only ${count} scenario(s); the minimum per category is 5.`);
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const CATEGORY_INFO: Record<string, { folder: string; idPrefix: string; label: string }> = {
  onboarding: { folder: 'onboarding', idPrefix: 'ONB', label: 'Onboarding' },
  procurement: { folder: 'procurement', idPrefix: 'PROC', label: 'Procurement' },
  sales: { folder: 'sales', idPrefix: 'SALES', label: 'Sales' },
  inventory: { folder: 'inventory', idPrefix: 'INV', label: 'Inventory' },
  'supplier-management': { folder: 'supplier-management', idPrefix: 'SUP', label: 'Supplier Management' },
  finance: { folder: 'finance', idPrefix: 'FIN', label: 'Finance' },
  incidents: { folder: 'incidents', idPrefix: 'INC', label: 'Incidents' },
  travel: { folder: 'travel', idPrefix: 'TRV', label: 'Travel' },
  compliance: { folder: 'compliance', idPrefix: 'COMP', label: 'Compliance' },
  'cross-domain': { folder: 'cross-domain', idPrefix: 'XD', label: 'Cross-Domain' },
};

async function ensureCategoryDirs(): Promise<void> {
  await mkdir(SCENARIOS_DIR, { recursive: true });
  await Promise.all(
    Object.values(CATEGORY_INFO).map((info) => mkdir(resolve(SCENARIOS_DIR, info.folder), { recursive: true })),
  );
}

async function writeScenario(scenario: Scenario): Promise<void> {
  const info = CATEGORY_INFO[scenario.category];
  if (!info) {
    throw new Error(`writeScenario: unknown category "${scenario.category}" for scenario ${scenario.id}`);
  }
  const filePath = resolve(SCENARIOS_DIR, info.folder, `${scenario.id}.json`);
  await writeFile(filePath, `${JSON.stringify(scenario, null, 2)}\n`, 'utf-8');
}

interface ScenarioIndex {
  total: number;
  categories: Record<string, number>;
  scenarios: Array<{ id: string; category: string; difficulty: Difficulty; policies: string[] }>;
}

async function writeIndex(all: Scenario[]): Promise<void> {
  const categories: Record<string, number> = {};
  for (const category of Object.keys(CATEGORY_INFO)) {
    categories[category] = all.filter((s) => s.category === category).length;
  }

  const index: ScenarioIndex = {
    total: all.length,
    categories,
    scenarios: all.map((s) => ({ id: s.id, category: s.category, difficulty: s.difficulty, policies: s.policies })),
  };

  await writeFile(resolve(SCENARIOS_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf-8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function assertCanonicalIdsExist(indexes: Indexes): void {
  for (const [key, systemId] of Object.entries(SYS)) {
    if (!indexes.systemById.has(systemId)) {
      throw new Error(`Expected canonical system ${key} (${systemId}) not found in data/enterprise/systems.json`);
    }
  }
  for (const [key, departmentId] of Object.entries(DEPT)) {
    if (!indexes.departmentById.has(departmentId)) {
      throw new Error(`Expected canonical department ${key} (${departmentId}) not found in data/enterprise/departments.json`);
    }
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(50));
  console.log('SVGA ENTERPRISE SCENARIO GENERATOR');
  console.log('='.repeat(50));

  console.log('\nLoading enterprise data...');
  const enterprise = await loadEnterpriseData();
  console.log('✓ Enterprise loaded');

  console.log('\nLoading master data...');
  const masterData = await loadMasterData();
  console.log('✓ Master data loaded');

  console.log('\nLoading policies...');
  const policies = await loadPolicies();
  console.log(`✓ ${policies.length} policies loaded`);

  const indexes = buildIndexes(enterprise, masterData, policies);
  assertCanonicalIdsExist(indexes);

  console.log('\nGenerating scenarios...\n');

  const generators: Array<[string, (i: Indexes) => Scenario[]]> = [
    ['onboarding', generateOnboardingScenarios],
    ['procurement', generateProcurementScenarios],
    ['sales', generateSalesScenarios],
    ['inventory', generateInventoryScenarios],
    ['supplier-management', generateSupplierScenarios],
    ['finance', generateFinanceScenarios],
    ['incidents', generateIncidentScenarios],
    ['travel', generateTravelScenarios],
    ['compliance', generateComplianceScenarios],
    ['cross-domain', generateCrossDomainScenarios],
  ];

  const allScenarios: Scenario[] = [];
  for (const [category, generate] of generators) {
    const scenarios = generate(indexes);
    allScenarios.push(...scenarios);
    console.log(`  ${CATEGORY_INFO[category].label.padEnd(22)} ${scenarios.length}`);
  }

  console.log('\n' + '-'.repeat(50));
  console.log(`TOTAL: ${allScenarios.length} scenarios`);
  console.log('-'.repeat(50));

  console.log('\nValidation:');
  const issues = validateAllScenarios(allScenarios, indexes);

  if (issues.length > 0) {
    console.log('✗ One or more checks FAILED\n');
    throw new ScenarioValidationError(issues);
  }

  console.log('✓ Entity references');
  console.log('✓ Policy references');
  console.log('✓ System references');
  console.log('✓ Inventory references');
  console.log('✓ Approval thresholds');
  console.log('✓ Scenario relationships');

  await ensureCategoryDirs();
  for (const scenario of allScenarios) {
    await writeScenario(scenario);
  }
  await writeIndex(allScenarios);

  console.log('\nSTATUS: PASS');
  console.log('='.repeat(50));

  const negativeCount = allScenarios.filter((s) => s.tags.includes('negative')).length;
  const abstentionCount = allScenarios.filter((s) => s.tags.includes('abstention')).length;
  const crossDomainCount = allScenarios.filter((s) => s.category === 'cross-domain').length;
  console.log(`\nOutput directory: ${relative(PROJECT_ROOT, SCENARIOS_DIR)}`);
  console.log(`Cross-domain scenarios: ${crossDomainCount}`);
  console.log(`Negative scenarios (reject/escalate/abstain outcome): ${negativeCount}`);
  console.log(`Abstention scenarios (deliberately insufficient information): ${abstentionCount}`);
}

main().catch((error: unknown) => {
  console.error('\nScenario generation FAILED.\n');
  if (error instanceof ScenarioValidationError) {
    console.error(error.message);
  } else if (error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
