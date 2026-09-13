import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const ENTERPRISE_DIR = resolve(ROOT, 'data', 'enterprise');
const MASTER_DIR = resolve(ROOT, 'data', 'master-data');
const POLICY_DIR = resolve(ROOT, 'data', 'policies');
const REPORT_DIR = resolve(ROOT, 'data', 'validation');

const ENTERPRISE_FILES = [
  'company.json',
  'departments.json',
  'employees.json',
  'roles.json',
  'locations.json',
  'systems.json',
];
const MASTER_FILES = [
  'suppliers.json',
  'customers.json',
  'products.json',
  'warehouses.json',
  'inventory.json',
  'cost-centers.json',
];
const POLICY_IDS = [
  'HR-POL-001',
  'HR-POL-002',
  'FIN-POL-001',
  'FIN-POL-002',
  'PROC-POL-001',
  'PROC-POL-002',
  'SALES-POL-001',
  'INV-POL-001',
  'WH-POL-001',
  'IT-POL-001',
  'IT-POL-002',
  'COMP-POL-001',
  'COMP-POL-002',
  'OPS-POL-001',
  'GEN-POL-001',
];
const POLICY_FILES = POLICY_IDS.map((id) => `${id}.md`);

const CANONICAL_RULES = {
  annualLeaveDays: 24,
  leaveNoticeDays: 5,
  procurementFinanceThresholdKes: 500_000,
  approvalMatrix: [50_000, 500_000, 2_000_000, 10_000_000],
  incidentSeverities: ['P1 Critical', 'P2 High', 'P3 Medium', 'P4 Low'],
} as const;

type Severity = 'ERROR' | 'WARNING' | 'INFO';
interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
  entityType?: string;
  entityId?: string;
  file?: string;
}
interface Report {
  status: 'PASS' | 'FAIL';
  generatedAt: string;
  summary: { errors: number; warnings: number; info: number };
  counts: Record<string, number>;
  issues: ValidationIssue[];
}
type RecordValue = Record<string, unknown>;
type Dataset = Record<string, RecordValue[]>;

const issues: ValidationIssue[] = [];
const add = (
  severity: Severity,
  code: string,
  message: string,
  details: Partial<ValidationIssue> = {},
): void => {
  issues.push({ severity, code, message, ...details });
};
const error = (
  code: string,
  message: string,
  details?: Partial<ValidationIssue>,
): void => add('ERROR', code, message, details);
const warning = (
  code: string,
  message: string,
  details?: Partial<ValidationIssue>,
): void => add('WARNING', code, message, details);
const info = (
  code: string,
  message: string,
  details?: Partial<ValidationIssue>,
): void => add('INFO', code, message, details);

const asRecords = (value: unknown, file: string): RecordValue[] => {
  if (!Array.isArray(value)) {
    error('JSON_SCHEMA', `${file} must contain a top-level array`, { file });
    return [];
  }
  return value.filter(
    (item): item is RecordValue =>
      item !== null && typeof item === 'object' && !Array.isArray(item),
  );
};

async function loadJson(
  file: string,
  directory: string,
): Promise<RecordValue[]> {
  try {
    const value: unknown = JSON.parse(
      await readFile(resolve(directory, file), 'utf8'),
    );
    const records = asRecords(value, file);
    if (records.length === 0)
      error('JSON_SCHEMA', `${file} contains no records`, { file });
    return records;
  } catch (cause) {
    error(
      'JSON_PARSE',
      `${file} could not be parsed: ${cause instanceof Error ? cause.message : String(cause)}`,
      { file },
    );
    return [];
  }
}

async function loadCompany(): Promise<RecordValue[]> {
  try {
    const value: unknown = JSON.parse(
      await readFile(resolve(ENTERPRISE_DIR, 'company.json'), 'utf8'),
    );
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      error('JSON_SCHEMA', 'company.json must contain a top-level object', {
        file: 'company.json',
      });
      return [];
    }
    return [value as RecordValue];
  } catch (cause) {
    error(
      'JSON_PARSE',
      `company.json could not be parsed: ${cause instanceof Error ? cause.message : String(cause)}`,
      { file: 'company.json' },
    );
    return [];
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

function value(record: RecordValue, key: string): unknown {
  return record[key];
}
function text(record: RecordValue, key: string): string | undefined {
  return typeof value(record, key) === 'string'
    ? (value(record, key) as string)
    : undefined;
}
function idOf(record: RecordValue, keys: string[]): string | undefined {
  for (const key of keys) {
    const found = text(record, key);
    if (found) return found;
  }
  return undefined;
}
function ids(
  records: RecordValue[],
  keys: string[],
  file: string,
): Set<string> {
  const result = new Set<string>();
  const seen = new Set<string>();
  for (const record of records) {
    const id = idOf(record, keys);
    if (!id) {
      error('MISSING_REQUIRED_FIELD', `${file} record has no identifier`, {
        file,
      });
      continue;
    }
    if (seen.has(id))
      error('DUPLICATE_ID', `${file} contains duplicate ID ${id}`, {
        file,
        entityId: id,
      });
    seen.add(id);
    result.add(id);
  }
  return result;
}
function references(
  records: RecordValue[],
  field: string,
  valid: Set<string>,
  entityType: string,
  file: string,
): void {
  for (const record of records) {
    const raw = value(record, field);
    const candidates = Array.isArray(raw) ? raw : [raw];
    for (const candidate of candidates)
      if (typeof candidate === 'string' && !valid.has(candidate))
        error(
          'INVALID_REFERENCE',
          `${entityType} ${idOf(record, ['id', `${entityType.toLowerCase()}Id`]) ?? 'unknown'} references missing ${candidate}`,
          { entityType, entityId: candidate, file },
        );
  }
}
function normalized(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, ' ');
}
function numberField(
  record: RecordValue,
  field: string,
  file: string,
  entityId?: string,
): number | undefined {
  const raw = value(record, field);
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    error(
      'JSON_SCHEMA',
      `${file} ${entityId ?? 'record'} requires numeric ${field}`,
      { file, entityId },
    );
    return undefined;
  }
  return raw;
}

function requiredFields(
  records: RecordValue[],
  fields: string[],
  file: string,
): void {
  for (const record of records) {
    const entityId = idOf(record, [
      'companyId',
      'departmentId',
      'roleId',
      'employeeId',
      'locationId',
      'systemId',
      'supplierId',
      'customerId',
      'productId',
      'warehouseId',
      'inventoryId',
      'costCenterId',
    ]);
    for (const field of fields) {
      const current = value(record, field);
      if (current === undefined || current === null || current === '')
        error(
          'MISSING_REQUIRED_FIELD',
          `${file} ${entityId ?? 'record'} is missing ${field}`,
          { file, entityId },
        );
    }
  }
}

async function loadAll(): Promise<{
  enterprise: Dataset;
  master: Dataset;
  policies: Map<string, string>;
}> {
  const enterprise: Dataset = {};
  const master: Dataset = {};
  for (const file of ENTERPRISE_FILES)
    enterprise[file.replace('.json', '')] =
      file === 'company.json'
        ? await loadCompany()
        : await loadJson(file, ENTERPRISE_DIR);
  for (const file of MASTER_FILES)
    master[file.replace('.json', '')] = await loadJson(file, MASTER_DIR);
  const policies = new Map<string, string>();
  for (const file of POLICY_FILES) {
    try {
      policies.set(
        file.replace('.md', ''),
        await readFile(resolve(POLICY_DIR, file), 'utf8'),
      );
    } catch {
      error('MISSING_FILE', `Missing policy file ${file}`, { file });
    }
  }
  return { enterprise, master, policies };
}

async function validateFiles(): Promise<void> {
  for (const file of ENTERPRISE_FILES)
    if (!(await fileExists(resolve(ENTERPRISE_DIR, file))))
      error('MISSING_FILE', `Missing enterprise file ${file}`, { file });
  for (const file of MASTER_FILES)
    if (!(await fileExists(resolve(MASTER_DIR, file))))
      error('MISSING_FILE', `Missing master-data file ${file}`, { file });
  for (const file of POLICY_FILES)
    if (!(await fileExists(resolve(POLICY_DIR, file))))
      error('MISSING_FILE', `Missing policy file ${file}`, { file });
}

function validateOrganization(data: {
  enterprise: Dataset;
  master: Dataset;
}): void {
  const departments = data.enterprise.departments;
  const employees = data.enterprise.employees;
  const roles = data.enterprise.roles;
  const locations = data.enterprise.locations;
  const departmentIds = ids(departments, ['departmentId'], 'departments.json');
  const roleIds = ids(roles, ['roleId'], 'roles.json');
  const employeeIds = ids(employees, ['employeeId'], 'employees.json');
  const locationIds = ids(locations, ['locationId'], 'locations.json');
  requiredFields(
    departments,
    ['departmentId', 'name', 'departmentHeadRoleId', 'costCenterCode'],
    'departments.json',
  );
  requiredFields(roles, ['roleId', 'title', 'departmentId'], 'roles.json');
  requiredFields(
    employees,
    ['employeeId', 'roleId', 'departmentId', 'locationId'],
    'employees.json',
  );
  requiredFields(locations, ['locationId', 'name'], 'locations.json');
  const departmentHeads = new Map(
    departments.map((item) => [
      text(item, 'departmentId'),
      text(item, 'departmentHeadRoleId'),
    ]),
  );
  references(
    employees,
    'departmentId',
    departmentIds,
    'Employee',
    'employees.json',
  );
  references(employees, 'roleId', roleIds, 'Employee', 'employees.json');
  references(
    employees,
    'locationId',
    locationIds,
    'Employee',
    'employees.json',
  );
  references(roles, 'departmentId', departmentIds, 'Role', 'roles.json');
  references(
    departments,
    'departmentHeadRoleId',
    roleIds,
    'Department',
    'departments.json',
  );
  for (const employee of employees) {
    const employeeId = text(employee, 'employeeId');
    const manager = value(employee, 'managerEmployeeId');
    if (typeof manager === 'string') {
      if (!employeeIds.has(manager))
        error(
          'INVALID_REFERENCE',
          `Employee ${employeeId} references missing manager ${manager}`,
          {
            entityType: 'Employee',
            entityId: employeeId,
            file: 'employees.json',
          },
        );
      if (manager === employeeId)
        error(
          'SELF_REPORTING',
          `Employee ${employeeId} reports to themselves`,
          {
            entityType: 'Employee',
            entityId: employeeId,
            file: 'employees.json',
          },
        );
    }
  }
  for (const department of departments) {
    const departmentId = text(department, 'departmentId');
    const headRole = text(department, 'departmentHeadRoleId');
    const head = employees.find(
      (employee) => text(employee, 'roleId') === headRole,
    );
    if (!head)
      error(
        'DEPARTMENT_HEAD_MISSING',
        `${departmentId} has no employee holding head role ${headRole}`,
        {
          entityType: 'Department',
          entityId: departmentId,
          file: 'departments.json',
        },
      );
    else if (text(head, 'departmentId') !== departmentId)
      error(
        'DEPARTMENT_HEAD_MISMATCH',
        `${departmentId} head role ${headRole} is held by an employee in ${text(head, 'departmentId')}`,
        {
          entityType: 'Department',
          entityId: departmentId,
          file: 'departments.json',
        },
      );
    if (!departmentHeads.has(departmentId))
      warning(
        'ORPHAN_DEPARTMENT',
        `Department ${departmentId} has no head-role link`,
        { entityType: 'Department', entityId: departmentId },
      );
  }
  const managerById = new Map(
    employees.map((employee) => [
      text(employee, 'employeeId'),
      text(employee, 'managerEmployeeId') ?? null,
    ]),
  );
  for (const employeeId of employeeIds) {
    const path: string[] = [];
    let current: string | null | undefined = employeeId;
    while (current) {
      if (path.includes(current)) {
        const cycle = [...path.slice(path.indexOf(current)), current];
        error(
          'REPORTING_CYCLE',
          `Employee reporting hierarchy contains a cycle: ${cycle.join(' -> ')}`,
          {
            entityType: 'Employee',
            entityId: employeeId,
            file: 'employees.json',
          },
        );
        break;
      }
      path.push(current);
      current = managerById.get(current);
    }
  }
}

function validateMasterData(data: {
  enterprise: Dataset;
  master: Dataset;
}): void {
  const departments = ids(
    data.enterprise.departments,
    ['departmentId'],
    'departments.json',
  );
  const employees = ids(
    data.enterprise.employees,
    ['employeeId'],
    'employees.json',
  );
  const locations = ids(
    data.enterprise.locations,
    ['locationId'],
    'locations.json',
  );
  const suppliers = ids(
    data.master.suppliers,
    ['supplierId'],
    'suppliers.json',
  );
  const customers = ids(
    data.master.customers,
    ['customerId'],
    'customers.json',
  );
  const products = ids(data.master.products, ['productId'], 'products.json');
  const warehouses = ids(
    data.master.warehouses,
    ['warehouseId'],
    'warehouses.json',
  );
  const inventory = ids(
    data.master.inventory,
    ['inventoryId'],
    'inventory.json',
  );
  const costCenters = ids(
    data.master['cost-centers'],
    ['costCenterId'],
    'cost-centers.json',
  );
  requiredFields(
    data.master['cost-centers'],
    ['costCenterId', 'code', 'departmentId', 'managerEmployeeId', 'locationId'],
    'cost-centers.json',
  );
  requiredFields(
    data.master.warehouses,
    ['warehouseId', 'name', 'locationId', 'managerEmployeeId'],
    'warehouses.json',
  );
  requiredFields(
    data.master.suppliers,
    [
      'supplierId',
      'legalName',
      'approvalStatus',
      'relationshipOwnerEmployeeId',
    ],
    'suppliers.json',
  );
  requiredFields(
    data.master.customers,
    ['customerId', 'legalName', 'accountManagerEmployeeId'],
    'customers.json',
  );
  requiredFields(
    data.master.products,
    ['productId', 'name', 'category', 'unitOfMeasure', 'supplierIds'],
    'products.json',
  );
  requiredFields(
    data.master.inventory,
    ['inventoryId', 'productId', 'warehouseId', 'inventoryStatus'],
    'inventory.json',
  );
  const costCenterCodes = new Map<string, string>();
  for (const record of data.master['cost-centers']) {
    const code = text(record, 'code');
    const id = text(record, 'costCenterId');
    if (code && costCenterCodes.has(code))
      warning(
        'DUPLICATE_CODE',
        `cost-centers.json contains duplicate code ${code} (${costCenterCodes.get(code)}, ${id})`,
        { file: 'cost-centers.json' },
      );
    if (code) costCenterCodes.set(code, id ?? 'unknown');
  }
  references(
    data.master['cost-centers'],
    'departmentId',
    departments,
    'CostCenter',
    'cost-centers.json',
  );
  references(
    data.master['cost-centers'],
    'managerEmployeeId',
    employees,
    'CostCenter',
    'cost-centers.json',
  );
  references(
    data.master['cost-centers'],
    'locationId',
    locations,
    'CostCenter',
    'cost-centers.json',
  );
  references(
    data.master.warehouses,
    'locationId',
    locations,
    'Warehouse',
    'warehouses.json',
  );
  references(
    data.master.warehouses,
    'managerEmployeeId',
    employees,
    'Warehouse',
    'warehouses.json',
  );
  references(
    data.master.suppliers,
    'relationshipOwnerEmployeeId',
    employees,
    'Supplier',
    'suppliers.json',
  );
  references(
    data.master.suppliers,
    'suppliedProductIds',
    products,
    'Supplier',
    'suppliers.json',
  );
  references(
    data.master.products,
    'supplierIds',
    suppliers,
    'Product',
    'products.json',
  );
  references(
    data.master.customers,
    'accountManagerEmployeeId',
    employees,
    'Customer',
    'customers.json',
  );
  references(
    data.master.inventory,
    'productId',
    products,
    'Inventory',
    'inventory.json',
  );
  references(
    data.master.inventory,
    'warehouseId',
    warehouses,
    'Inventory',
    'inventory.json',
  );
  for (const customer of data.master.customers) {
    const manager = data.enterprise.employees.find(
      (employee) =>
        text(employee, 'employeeId') ===
        text(customer, 'accountManagerEmployeeId'),
    );
    if (manager && text(manager, 'departmentId') !== 'DEPT-SALES')
      warning(
        'CUSTOMER_MANAGER_DEPARTMENT',
        `Customer ${text(customer, 'customerId')} account manager ${text(manager, 'employeeId')} is not in Sales`,
        { file: 'customers.json' },
      );
  }
  for (const product of data.master.products) {
    const unitCost = numberField(
      product,
      'unitCost',
      'products.json',
      text(product, 'productId'),
    );
    const sellingPrice = numberField(
      product,
      'sellingPrice',
      'products.json',
      text(product, 'productId'),
    );
    if (
      (unitCost !== undefined && unitCost < 0) ||
      (sellingPrice !== undefined && sellingPrice < 0)
    )
      error(
        'NEGATIVE_VALUE',
        `Product ${text(product, 'productId')} has a negative price`,
        { file: 'products.json' },
      );
  }
  validateInventory(data, products, warehouses, inventory);
  validateOrphans(
    data,
    costCenters,
    suppliers,
    products,
    warehouses,
    departments,
  );
}

function validateInventory(
  data: { master: Dataset },
  productIds: Set<string>,
  warehouseIds: Set<string>,
  inventoryIds: Set<string>,
): void {
  const productLinks = new Set<string>();
  const warehouseLinks = new Set<string>();
  for (const record of data.master.inventory) {
    const id = text(record, 'inventoryId');
    const onHand = numberField(record, 'quantityOnHand', 'inventory.json', id);
    const reserved = numberField(
      record,
      'quantityReserved',
      'inventory.json',
      id,
    );
    const available = numberField(
      record,
      'quantityAvailable',
      'inventory.json',
      id,
    );
    const reorderLevel = numberField(
      record,
      'reorderLevel',
      'inventory.json',
      id,
    );
    const reorderQuantity = numberField(
      record,
      'reorderQuantity',
      'inventory.json',
      id,
    );
    const product = text(record, 'productId');
    const warehouse = text(record, 'warehouseId');
    if (product) productLinks.add(product);
    if (warehouse) warehouseLinks.add(warehouse);
    if (product && !productIds.has(product))
      error(
        'INVALID_REFERENCE',
        `Inventory ${id} references missing product ${product}`,
        { file: 'inventory.json' },
      );
    if (warehouse && !warehouseIds.has(warehouse))
      error(
        'INVALID_REFERENCE',
        `Inventory ${id} references missing warehouse ${warehouse}`,
        { file: 'inventory.json' },
      );
    for (const [field, numeric] of [
      ['quantityOnHand', onHand],
      ['quantityReserved', reserved],
      ['quantityAvailable', available],
      ['reorderLevel', reorderLevel],
      ['reorderQuantity', reorderQuantity],
    ] as const)
      if (numeric !== undefined && numeric < 0)
        error('NEGATIVE_VALUE', `Inventory ${id} has negative ${field}`, {
          file: 'inventory.json',
        });
    if (
      onHand !== undefined &&
      reserved !== undefined &&
      available !== undefined &&
      available !== onHand - reserved
    )
      error(
        'INVENTORY_CALCULATION',
        `Inventory ${id} has quantityAvailable ${available}; expected ${onHand - reserved}`,
        { file: 'inventory.json', entityId: id },
      );
    const status = text(record, 'inventoryStatus');
    if (available !== undefined && reorderLevel !== undefined) {
      if (status === 'OUT_OF_STOCK' && available !== 0)
        error(
          'INVENTORY_STATUS_CONTRADICTION',
          `Inventory ${id} is OUT_OF_STOCK with quantityAvailable ${available}`,
          { file: 'inventory.json' },
        );
      if (
        status === 'REORDER_REQUIRED' &&
        !(available > 0 && available <= reorderLevel)
      )
        error(
          'INVENTORY_STATUS_CONTRADICTION',
          `Inventory ${id} is REORDER_REQUIRED with quantityAvailable ${available} and reorderLevel ${reorderLevel}`,
          { file: 'inventory.json' },
        );
      if (status === 'IN_STOCK' && available <= reorderLevel)
        error(
          'INVENTORY_STATUS_CONTRADICTION',
          `Inventory ${id} is IN_STOCK at or below reorderLevel`,
          { file: 'inventory.json' },
        );
      if (available < reorderLevel && status === 'IN_STOCK')
        error(
          'REORDER_INCONSISTENCY',
          `Inventory ${id} is below reorder level but not marked for replenishment`,
          { file: 'inventory.json' },
        );
    }
  }
  for (const product of productIds)
    if (
      !data.master.inventory.some(
        (record) => text(record, 'productId') === product,
      )
    )
      warning('ORPHAN_PRODUCT', `Product ${product} has no inventory record`, {
        entityType: 'Product',
        entityId: product,
      });
  for (const warehouse of warehouseIds)
    if (
      !data.master.inventory.some(
        (record) => text(record, 'warehouseId') === warehouse,
      )
    )
      warning(
        'ORPHAN_WAREHOUSE',
        `Warehouse ${warehouse} has no inventory records`,
        { entityType: 'Warehouse', entityId: warehouse },
      );
  if (productLinks.size > 0 && warehouseLinks.size > 0)
    info(
      'INVENTORY_GRAPH',
      `Inventory connects ${productLinks.size} products across ${warehouseLinks.size} warehouses`,
    );
}

function validateOrphans(
  data: { enterprise: Dataset; master: Dataset },
  costCenters: Set<string>,
  suppliers: Set<string>,
  products: Set<string>,
  warehouses: Set<string>,
  departments: Set<string>,
): void {
  const supplied = new Set(
    data.master.products
      .flatMap((product) =>
        Array.isArray(value(product, 'supplierIds'))
          ? (value(product, 'supplierIds') as unknown[])
          : [],
      )
      .filter((item): item is string => typeof item === 'string'),
  );
  for (const supplier of suppliers)
    if (
      !data.master.suppliers.some(
        (record) =>
          text(record, 'supplierId') === supplier &&
          Array.isArray(value(record, 'suppliedProductIds')) &&
          (value(record, 'suppliedProductIds') as unknown[]).length > 0,
      ) &&
      !supplied.has(supplier)
    )
      warning(
        'ORPHAN_SUPPLIER',
        `Supplier ${supplier} has no product relationships`,
        { entityType: 'Supplier', entityId: supplier },
      );
  const costDepartmentIds = new Set(
    data.master['cost-centers']
      .map((record) => text(record, 'departmentId'))
      .filter((item): item is string => Boolean(item)),
  );
  for (const department of departments)
    if (!costDepartmentIds.has(department))
      warning(
        'ORPHAN_DEPARTMENT',
        `Department ${department} has no cost center`,
        { entityType: 'Department', entityId: department },
      );
  for (const costCenter of costCenters)
    if (
      !data.master['cost-centers'].some(
        (record) => text(record, 'costCenterId') === costCenter,
      )
    )
      warning(
        'ORPHAN_COST_CENTER',
        `Cost center ${costCenter} is not connected`,
        { entityType: 'CostCenter', entityId: costCenter },
      );
}

function validateDuplicates(data: {
  enterprise: Dataset;
  master: Dataset;
}): void {
  for (const [file, records, field] of [
    ['suppliers.json', data.master.suppliers, 'legalName'],
    ['customers.json', data.master.customers, 'legalName'],
    ['products.json', data.master.products, 'name'],
    ['warehouses.json', data.master.warehouses, 'name'],
  ] as const) {
    const seen = new Map<string, string>();
    for (const record of records) {
      const name = text(record, field);
      if (!name) continue;
      const key = normalized(name);
      const id =
        idOf(record, [
          'supplierId',
          'customerId',
          'productId',
          'warehouseId',
        ]) ?? 'unknown';
      if (seen.has(key))
        warning(
          'DUPLICATE_BUSINESS_ENTITY',
          `${file} contains duplicate normalized ${field}: ${name} (${seen.get(key)}, ${id})`,
          { file },
        );
      else seen.set(key, id);
    }
  }
}

function metadataValue(markdown: string, key: string): string | undefined {
  return markdown
    .match(new RegExp(`\\|\\s*${key}\\s*\\|\\s*([^|\\n]+)`, 'i'))?.[1]
    ?.trim();
}
function validatePolicies(data: {
  enterprise: Dataset;
  policies: Map<string, string>;
}): void {
  const policySet = new Set(data.policies.keys());
  if (data.policies.size !== POLICY_IDS.length)
    error(
      'POLICY_SET',
      `Expected ${POLICY_IDS.length} policies, found ${data.policies.size}`,
    );
  for (const id of POLICY_IDS) {
    const markdown = data.policies.get(id);
    if (!markdown) continue;
    const declaredId = metadataValue(markdown, 'Document ID');
    if (declaredId !== id)
      error(
        'POLICY_ID_MISMATCH',
        `${id}.md declares Document ID ${declaredId ?? 'missing'}`,
        { file: `${id}.md` },
      );
    for (const field of [
      'Title',
      'Version',
      'Effective Date',
      'Review Date',
      'Owner',
      'Department',
      'Status',
      'Classification',
      'Country',
      'Business Unit',
      'System',
      'Document Type',
    ])
      if (!metadataValue(markdown, field))
        error(
          'POLICY_METADATA',
          `${id}.md is missing metadata field ${field}`,
          { file: `${id}.md` },
        );
    const requiredSections = [
      'purpose',
      'scope',
      'definitions',
      'policy principles',
      'procedures',
      'approvals and authority',
      'exceptions',
      'roles and responsibilities',
      'records and documentation',
      'systems and process integration',
      'compliance and monitoring',
      'related policies',
      'review and version control',
    ];
    for (const section of requiredSections)
      if (
        !new RegExp(
          `^#+\\s*(?:\\d+\\.\\s*)?${section.replace('procedures', 'procedures(?: /| and)')}.*$`,
          'im',
        ).test(markdown)
      )
        warning(
          'POLICY_SECTION',
          `${id}.md may be missing section ${section}`,
          { file: `${id}.md` },
        );
    if (markdown.length < 8_000 || markdown.split(/\s+/).length < 1_300)
      warning(
        'CORPUS_QUALITY',
        `${id}.md is shorter than the preferred policy corpus target`,
        { file: `${id}.md` },
      );
    if (
      /\[INSERT|TODO|TBD|PLACEHOLDER|<PLACEHOLDER>|\{\{[^}]*\}\}/i.test(
        markdown,
      )
    )
      error(
        'UNRESOLVED_PLACEHOLDER',
        `${id}.md contains unresolved placeholder text`,
        { file: `${id}.md` },
      );
    const related =
      markdown.match(
        /\b(?:HR|FIN|PROC|SALES|INV|WH|IT|COMP|OPS|GEN)-POL-\d{3}\b/g,
      ) ?? [];
    for (const relatedId of new Set(related))
      if (!policySet.has(relatedId))
        error(
          'INVALID_POLICY_REFERENCE',
          `${id}.md references missing policy ${relatedId}`,
          { file: `${id}.md` },
        );
    const declaredSystem = metadataValue(markdown, 'System') ?? '';
    const systemNames = data.enterprise.systems
      .map((system) => text(system, 'name'))
      .filter((name): name is string => Boolean(name));
    for (const system of declaredSystem
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean))
      if (!systemNames.includes(system))
        error(
          'INVALID_SYSTEM_REFERENCE',
          `${id}.md metadata references unknown system ${system}`,
          { file: `${id}.md` },
        );
  }
}

function validateEntityReferences(data: {
  enterprise: Dataset;
  master: Dataset;
  policies: Map<string, string>;
}): void {
  const sets: Array<[RegExp, Set<string>, string]> = [
    [
      /\bEMP-\d{4}\b/g,
      ids(data.enterprise.employees, ['employeeId'], 'employees.json'),
      'employee',
    ],
    [
      /(?<![A-Z0-9-])DEPT-[A-Z]+\b/g,
      ids(data.enterprise.departments, ['departmentId'], 'departments.json'),
      'department',
    ],
    [
      /\bROLE-[A-Z0-9-]+\b/g,
      ids(data.enterprise.roles, ['roleId'], 'roles.json'),
      'role',
    ],
    [
      /\bSYS-[A-Z0-9-]+\b/g,
      ids(data.enterprise.systems, ['systemId'], 'systems.json'),
      'system',
    ],
    [
      /\bSUP-\d{3}\b/g,
      ids(data.master.suppliers, ['supplierId'], 'suppliers.json'),
      'supplier',
    ],
    [
      /\bCUS-\d{3}\b/g,
      ids(data.master.customers, ['customerId'], 'customers.json'),
      'customer',
    ],
    [
      /\bPRD-\d{3}\b/g,
      ids(data.master.products, ['productId'], 'products.json'),
      'product',
    ],
    [
      /(?<![A-Z0-9-])WH-[A-Z]+-\d{3}\b/g,
      ids(data.master.warehouses, ['warehouseId'], 'warehouses.json'),
      'warehouse',
    ],
  ];
  for (const [pattern, valid, entityType] of sets)
    for (const [file, markdown] of data.policies)
      for (const reference of new Set(markdown.match(pattern) ?? [])) {
        if (data.policies.has(reference)) continue;
        if (!valid.has(reference))
          error(
            'INVALID_ENTITY_REFERENCE',
            `${file}.md references missing ${entityType} ${reference}`,
            { file: `${file}.md`, entityType, entityId: reference },
          );
      }
}

function validateRules(data: { policies: Map<string, string> }): void {
  const all = [...data.policies.entries()];
  const leave = data.policies.get('HR-POL-001') ?? '';
  if (
    !leave.includes(`${CANONICAL_RULES.annualLeaveDays} working days`) ||
    !leave.includes(`${CANONICAL_RULES.leaveNoticeDays} working days`)
  )
    error(
      'RULE_CONTRADICTION',
      'HR-POL-001 does not state the canonical annual leave and notice rules',
      { file: 'HR-POL-001.md' },
    );
  for (const [file, markdown] of all) {
    if (
      /annual leave/i.test(markdown) &&
      !markdown.includes(`${CANONICAL_RULES.annualLeaveDays} working days`)
    )
      error(
        'RULE_CONTRADICTION',
        `${file}.md mentions annual leave without the canonical ${CANONICAL_RULES.annualLeaveDays}-day rule`,
        { file: `${file}.md` },
      );
    if (
      /leave.{0,80}notice|notice.{0,80}leave/i.test(markdown) &&
      !markdown.includes(`${CANONICAL_RULES.leaveNoticeDays} working days`)
    )
      warning(
        'RULE_REVIEW',
        `${file}.md mentions leave notice but does not state the canonical notice value`,
        { file: `${file}.md` },
      );
  }
  for (const file of [
    'FIN-POL-002',
    'PROC-POL-001',
    'FIN-POL-001',
    'OPS-POL-001',
  ])
    if (
      data.policies.has(file) &&
      !(data.policies.get(file) ?? '').includes('KES 500,000')
    )
      warning(
        'RULE_REVIEW',
        `${file}.md does not state the shared KES 500,000 finance threshold`,
        { file: `${file}.md` },
      );
  const finance = data.policies.get('FIN-POL-002') ?? '';
  for (const amount of CANONICAL_RULES.approvalMatrix)
    if (!finance.includes(amount.toLocaleString()))
      error(
        'APPROVAL_MATRIX',
        `FIN-POL-002 is missing ${amount.toLocaleString()} from the canonical approval matrix`,
        { file: 'FIN-POL-002.md' },
      );
  const incident = data.policies.get('IT-POL-002') ?? '';
  for (const severity of CANONICAL_RULES.incidentSeverities)
    if (!incident.includes(severity))
      error('INCIDENT_SEVERITY', `IT-POL-002 is missing ${severity}`, {
        file: 'IT-POL-002.md',
      });
  if (
    new Set(CANONICAL_RULES.approvalMatrix).size !==
    CANONICAL_RULES.approvalMatrix.length
  )
    error(
      'APPROVAL_MATRIX',
      'Canonical approval thresholds contain duplicates',
    );
  info(
    'RULE_REGISTRY',
    'Canonical leave, approval, procurement and incident rules were checked',
  );
}

function validateCrossDomain(data: {
  enterprise: Dataset;
  master: Dataset;
  policies: Map<string, string>;
}): void {
  const has = (
    records: RecordValue[],
    field: string,
    expected: string,
  ): boolean =>
    records.some((record) =>
      Array.isArray(value(record, field))
        ? (value(record, field) as unknown[]).includes(expected)
        : value(record, field) === expected,
    );
  if (
    data.master['cost-centers'].length &&
    data.master.suppliers.length &&
    data.master.products.length &&
    data.master.warehouses.length &&
    data.master.inventory.length
  )
    info(
      'CROSS_DOMAIN_CHAIN',
      'Procurement chain has Department, Cost Center, Supplier, Product, Warehouse and Inventory layers',
    );
  else
    warning(
      'CROSS_DOMAIN_CHAIN',
      'Procurement chain is incomplete in available master data',
    );
  if (
    data.master.customers.some(
      (customer) =>
        typeof value(customer, 'accountManagerEmployeeId') === 'string',
    ) &&
    data.master.inventory.length &&
    data.policies.has('SALES-POL-001')
  )
    info(
      'CROSS_DOMAIN_CHAIN',
      'Sales chain connects Customer, Sales Employee, Product, Inventory and policy layers',
    );
  else
    warning(
      'CROSS_DOMAIN_CHAIN',
      'Sales chain is incomplete in available data',
    );
  if (
    data.enterprise.employees.length &&
    data.enterprise.roles.length &&
    data.policies.has('IT-POL-001') &&
    data.enterprise.systems.length
  )
    info(
      'CROSS_DOMAIN_CHAIN',
      'Employee onboarding chain connects Employee, Role, IT policy and Systems',
    );
  else warning('CROSS_DOMAIN_CHAIN', 'Employee onboarding chain is incomplete');
  if (
    data.enterprise.employees.length &&
    data.enterprise.systems.length &&
    data.policies.has('IT-POL-002') &&
    data.policies.has('COMP-POL-001')
  )
    info(
      'CROSS_DOMAIN_CHAIN',
      'Incident chain connects Employee, System, Incident policy, Service Desk and Data Protection',
    );
  else warning('CROSS_DOMAIN_CHAIN', 'Incident chain is incomplete');
}

function counts(data: {
  enterprise: Dataset;
  master: Dataset;
  policies: Map<string, string>;
}): Record<string, number> {
  return {
    companies: data.enterprise.company?.length ?? 0,
    departments: data.enterprise.departments.length,
    roles: data.enterprise.roles.length,
    employees: data.enterprise.employees.length,
    locations: data.enterprise.locations.length,
    systems: data.enterprise.systems.length,
    suppliers: data.master.suppliers.length,
    customers: data.master.customers.length,
    products: data.master.products.length,
    warehouses: data.master.warehouses.length,
    inventoryRecords: data.master.inventory.length,
    costCenters: data.master['cost-centers'].length,
    policies: data.policies.size,
  };
}

function printSection(title: string): void {
  console.log(`\n${'-'.repeat(50)}\n${title}\n${'-'.repeat(50)}`);
}
async function main(): Promise<void> {
  console.log(
    '==================================================\nSVGA ENTERPRISE CONSISTENCY VALIDATION\n==================================================',
  );
  await validateFiles();
  const data = await loadAll();
  validateOrganization(data);
  validateMasterData(data);
  validateDuplicates(data);
  validatePolicies(data);
  validateEntityReferences(data);
  validateRules(data);
  validateCrossDomain(data);
  const summary = {
    errors: issues.filter((item) => item.severity === 'ERROR').length,
    warnings: issues.filter((item) => item.severity === 'WARNING').length,
    info: issues.filter((item) => item.severity === 'INFO').length,
  };
  const report: Report = {
    status: summary.errors === 0 ? 'PASS' : 'FAIL',
    generatedAt: new Date().toISOString(),
    summary,
    counts: counts(data),
    issues,
  };
  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(
    resolve(REPORT_DIR, 'consistency-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  printSection('RESULT');
  console.log(
    `Errors:   ${summary.errors}\nWarnings: ${summary.warnings}\nInfo:     ${summary.info}\n\nSTATUS: ${report.status}\n==================================================`,
  );
  if (issues.length) {
    printSection('FINDINGS');
    for (const item of issues)
      console.log(
        `${item.severity} [${item.code}] ${item.message}${item.file ? ` (${item.file})` : ''}`,
      );
  }
  process.exitCode = summary.errors > 0 ? 1 : 0;
}

main().catch((cause: unknown) => {
  console.error('Consistency validation failed unexpectedly.');
  console.error(
    cause instanceof Error ? (cause.stack ?? cause.message) : cause,
  );
  process.exitCode = 1;
});
