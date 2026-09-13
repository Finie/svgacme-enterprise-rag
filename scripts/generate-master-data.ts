/**
 * generate-master-data.ts
 *
 * Generates interconnected FMCG master data for the fictional company
 * "SVGA Enterprise Ltd", building on top of the canonical enterprise
 * foundation produced by `generate-enterprise.ts`.
 *
 * This script READS `data/enterprise/*.json` (company, departments, roles,
 * employees, locations, systems) and uses the actual IDs found there. It
 * never assumes an ID exists and never duplicates or modifies the
 * enterprise files.
 *
 * Output:
 *   data/master-data/cost-centers.json
 *   data/master-data/warehouses.json
 *   data/master-data/suppliers.json
 *   data/master-data/products.json
 *   data/master-data/customers.json
 *   data/master-data/inventory.json
 *
 * Usage:
 *   npx tsx scripts/generate-master-data.ts
 *   npm run generate:master-data
 *
 * The dataset is fully hard-coded (no randomness), so running this script
 * repeatedly against an unchanged enterprise foundation produces
 * byte-identical output every time.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths (resolved relative to the project root, not the CWD)
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const ENTERPRISE_DIR = resolve(PROJECT_ROOT, 'data', 'enterprise');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'data', 'master-data');

// ---------------------------------------------------------------------------
// Types: enterprise data (read-only inputs produced by generate-enterprise.ts)
// ---------------------------------------------------------------------------

interface EnterpriseDepartment {
  departmentId: string;
  name: string;
  description: string;
  departmentHeadRoleId: string;
  costCenterCode: string;
  status: string;
}

interface EnterpriseRole {
  roleId: string;
  title: string;
  departmentId: string;
  level: string;
}

interface EnterpriseEmployee {
  employeeId: string;
  firstName: string;
  lastName: string;
  roleId: string;
  departmentId: string;
  locationId: string;
  employmentStatus: string;
}

interface EnterpriseLocation {
  locationId: string;
  name: string;
  type: string;
  city: string;
  county: string;
  country: string;
  status: string;
}

interface EnterpriseData {
  departments: EnterpriseDepartment[];
  roles: EnterpriseRole[];
  employees: EnterpriseEmployee[];
  locations: EnterpriseLocation[];
}

// ---------------------------------------------------------------------------
// Types: master data (this script's outputs)
// ---------------------------------------------------------------------------

type ActiveStatus = 'ACTIVE' | 'INACTIVE';
type PaymentTerms = 'NET_15' | 'NET_30' | 'NET_45' | 'NET_60';
type RiskRating = 'LOW' | 'MEDIUM' | 'HIGH';

interface CostCenter {
  costCenterId: string;
  code: string;
  name: string;
  departmentId: string;
  managerEmployeeId: string;
  locationId: string;
  status: ActiveStatus;
}

interface Warehouse {
  warehouseId: string;
  code: string;
  name: string;
  locationId: string;
  city: string;
  warehouseType: 'DISTRIBUTION_CENTER';
  managerEmployeeId: string;
  capacityUnits: number;
  operatingHours: string;
  temperatureControlled: boolean;
  status: ActiveStatus;
}

interface Supplier {
  supplierId: string;
  supplierCode: string;
  legalName: string;
  tradingName: string;
  supplierCategory: string;
  contactEmail: string;
  contactPhone: string;
  country: string;
  city: string;
  paymentTerms: PaymentTerms;
  currency: 'KES' | 'USD';
  taxRegistrationStatus: 'REGISTERED' | 'NOT_REGISTERED';
  approvalStatus: 'APPROVED' | 'PENDING_APPROVAL' | 'SUSPENDED';
  riskRating: RiskRating;
  procurementCategory: string;
  primaryContactName: string;
  relationshipOwnerEmployeeId: string;
  suppliedProductIds: string[];
  active: boolean;
}

interface Product {
  productId: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  unitOfMeasure: 'UNIT';
  unitCost: number;
  sellingPrice: number;
  reorderLevel: number;
  reorderQuantity: number;
  supplierIds: string[];
  taxCategory: 'STANDARD' | 'ZERO_RATED';
  status: 'ACTIVE' | 'DISCONTINUED';
}

interface Customer {
  customerId: string;
  customerCode: string;
  legalName: string;
  tradingName: string;
  customerType: string;
  industry: string;
  city: string;
  county: string;
  country: string;
  creditLimit: number;
  paymentTerms: PaymentTerms;
  accountManagerEmployeeId: string;
  customerStatus: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  riskRating: RiskRating;
}

type InventoryStatus = 'IN_STOCK' | 'REORDER_REQUIRED' | 'OUT_OF_STOCK' | 'DISCONTINUED';

interface InventoryRecord {
  inventoryId: string;
  productId: string;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderLevel: number;
  reorderQuantity: number;
  inventoryStatus: InventoryStatus;
  lastStockCountDate: string;
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
// Loading enterprise data (source of truth)
// ---------------------------------------------------------------------------

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

async function loadEnterpriseData(): Promise<EnterpriseData> {
  const [departments, roles, employees, locations] = await Promise.all([
    readJsonFile<EnterpriseDepartment[]>(resolve(ENTERPRISE_DIR, 'departments.json')),
    readJsonFile<EnterpriseRole[]>(resolve(ENTERPRISE_DIR, 'roles.json')),
    readJsonFile<EnterpriseEmployee[]>(resolve(ENTERPRISE_DIR, 'employees.json')),
    readJsonFile<EnterpriseLocation[]>(resolve(ENTERPRISE_DIR, 'locations.json')),
  ]);

  return { departments, roles, employees, locations };
}

// ---------------------------------------------------------------------------
// Enterprise lookup helpers
// ---------------------------------------------------------------------------

function getDepartmentById(enterprise: EnterpriseData, departmentId: string): EnterpriseDepartment {
  const department = enterprise.departments.find((d) => d.departmentId === departmentId);
  if (!department) {
    throw new Error(`loadEnterpriseData: no department found with id "${departmentId}"`);
  }
  return department;
}

function getEmployeeById(enterprise: EnterpriseData, employeeId: string): EnterpriseEmployee {
  const employee = enterprise.employees.find((e) => e.employeeId === employeeId);
  if (!employee) {
    throw new Error(`loadEnterpriseData: no employee found with id "${employeeId}"`);
  }
  return employee;
}

/** Finds the single employee who holds a department's designated head role. */
function getDepartmentHeadEmployee(enterprise: EnterpriseData, departmentId: string): EnterpriseEmployee {
  const department = getDepartmentById(enterprise, departmentId);
  const headEmployee = enterprise.employees.find((e) => e.roleId === department.departmentHeadRoleId);
  if (!headEmployee) {
    throw new Error(
      `loadEnterpriseData: no employee holds head role "${department.departmentHeadRoleId}" for department "${departmentId}"`,
    );
  }
  return headEmployee;
}

function getLocationById(enterprise: EnterpriseData, locationId: string): EnterpriseLocation {
  const location = enterprise.locations.find((l) => l.locationId === locationId);
  if (!location) {
    throw new Error(`loadEnterpriseData: no location found with id "${locationId}"`);
  }
  return location;
}

// ---------------------------------------------------------------------------
// 1. Cost centers — one per existing department, in departments.json order
// ---------------------------------------------------------------------------

function generateCostCenters(enterprise: EnterpriseData): CostCenter[] {
  return enterprise.departments.map((department, index) => {
    const headEmployee = getDepartmentHeadEmployee(enterprise, department.departmentId);

    return {
      costCenterId: department.costCenterCode,
      code: `CC-${100 + index * 10}`,
      name: department.name,
      departmentId: department.departmentId,
      managerEmployeeId: headEmployee.employeeId,
      locationId: headEmployee.locationId,
      status: 'ACTIVE',
    };
  });
}

// ---------------------------------------------------------------------------
// 2. Warehouses — distribution centres at existing locations
// ---------------------------------------------------------------------------

interface WarehouseSeed {
  warehouseId: string;
  code: string;
  name: string;
  locationId: string;
  capacityUnits: number;
  operatingHours: string;
}

function getWarehouseManager(enterprise: EnterpriseData): EnterpriseEmployee {
  // The Warehouse department's designated head role ("Warehouse Manager")
  // oversees goods receiving, storage and dispatch across every site, so
  // the same employee is the manager of record for every distribution
  // centre. No warehouse-specific employees are invented.
  return getDepartmentHeadEmployee(enterprise, findDepartmentIdByName(enterprise, 'Warehouse'));
}

function findDepartmentIdByName(enterprise: EnterpriseData, name: string): string {
  const department = enterprise.departments.find((d) => d.name === name);
  if (!department) {
    throw new Error(`loadEnterpriseData: no department found with name "${name}"`);
  }
  return department.departmentId;
}

function generateWarehouses(enterprise: EnterpriseData): Warehouse[] {
  const manager = getWarehouseManager(enterprise);

  const seeds: WarehouseSeed[] = [
    {
      warehouseId: 'WH-NRB-001',
      code: 'NRB-DC',
      name: 'Nairobi Distribution Centre',
      locationId: 'LOC-NRB-WH',
      capacityUnits: 120_000,
      operatingHours: 'Monday - Saturday, 06:00 - 20:00',
    },
    {
      warehouseId: 'WH-MSA-001',
      code: 'MSA-DC',
      name: 'Mombasa Distribution Centre',
      locationId: 'LOC-MSA-01',
      capacityUnits: 60_000,
      operatingHours: 'Monday - Saturday, 07:00 - 18:00',
    },
    {
      warehouseId: 'WH-KSM-001',
      code: 'KSM-DC',
      name: 'Kisumu Distribution Centre',
      locationId: 'LOC-KSM-01',
      capacityUnits: 40_000,
      operatingHours: 'Monday - Saturday, 07:00 - 18:00',
    },
    {
      warehouseId: 'WH-NKR-001',
      code: 'NKR-DC',
      name: 'Nakuru Distribution Centre',
      locationId: 'LOC-NKR-01',
      capacityUnits: 30_000,
      operatingHours: 'Monday - Saturday, 07:00 - 18:00',
    },
  ];

  return seeds.map((seed) => {
    const location = getLocationById(enterprise, seed.locationId);

    return {
      warehouseId: seed.warehouseId,
      code: seed.code,
      name: seed.name,
      locationId: seed.locationId,
      city: location.city,
      warehouseType: 'DISTRIBUTION_CENTER',
      managerEmployeeId: manager.employeeId,
      capacityUnits: seed.capacityUnits,
      operatingHours: seed.operatingHours,
      temperatureControlled: false,
      status: 'ACTIVE',
    };
  });
}

// ---------------------------------------------------------------------------
// 3. Suppliers
// ---------------------------------------------------------------------------

const ALLOWED_SUPPLIER_CATEGORIES = [
  'Food Products',
  'Beverages',
  'Household Goods',
  'Personal Care',
  'Packaging',
  'Office Supplies',
  'IT Equipment',
  'Logistics',
  'Cleaning Services',
  'Facilities Services',
] as const;

interface SupplierSeed {
  supplierId: string;
  legalName: string;
  tradingName: string;
  supplierCategory: (typeof ALLOWED_SUPPLIER_CATEGORIES)[number];
  procurementCategory: string;
  city: string;
  currency: 'KES' | 'USD';
  paymentTerms: PaymentTerms;
  riskRating: RiskRating;
  approvalStatus: 'APPROVED' | 'PENDING_APPROVAL' | 'SUSPENDED';
  primaryContactName: string;
  /** Employee (Procurement dept) who owns this vendor relationship. */
  relationshipOwnerEmployeeId: string;
}

function generateSuppliers(): Supplier[] {
  const seeds: SupplierSeed[] = [
    {
      supplierId: 'SUP-001',
      legalName: 'East Africa Food Distribution Ltd',
      tradingName: 'East Africa Foods',
      supplierCategory: 'Food Products',
      procurementCategory: 'FOOD',
      city: 'Nairobi',
      currency: 'KES',
      paymentTerms: 'NET_30',
      riskRating: 'LOW',
      approvalStatus: 'APPROVED',
      primaryContactName: 'Daniel Mburu',
      relationshipOwnerEmployeeId: 'EMP-0004',
    },
    {
      supplierId: 'SUP-002',
      legalName: 'Rift Valley Grain Millers Ltd',
      tradingName: 'Rift Valley Millers',
      supplierCategory: 'Food Products',
      procurementCategory: 'FOOD',
      city: 'Nakuru',
      currency: 'KES',
      paymentTerms: 'NET_30',
      riskRating: 'LOW',
      approvalStatus: 'APPROVED',
      primaryContactName: 'Alice Cherono',
      relationshipOwnerEmployeeId: 'EMP-0004',
    },
    {
      supplierId: 'SUP-003',
      legalName: 'Coastal Beverages Manufacturing Ltd',
      tradingName: 'Coastal Beverages',
      supplierCategory: 'Beverages',
      procurementCategory: 'BEVERAGES',
      city: 'Mombasa',
      currency: 'KES',
      paymentTerms: 'NET_30',
      riskRating: 'LOW',
      approvalStatus: 'APPROVED',
      primaryContactName: 'James Mwakio',
      relationshipOwnerEmployeeId: 'EMP-0004',
    },
    {
      supplierId: 'SUP-004',
      legalName: 'Highland Bottlers Company Ltd',
      tradingName: 'Highland Bottlers',
      supplierCategory: 'Beverages',
      procurementCategory: 'BEVERAGES',
      city: 'Nairobi',
      currency: 'KES',
      paymentTerms: 'NET_45',
      riskRating: 'MEDIUM',
      approvalStatus: 'APPROVED',
      primaryContactName: 'Irene Nafula',
      relationshipOwnerEmployeeId: 'EMP-0015',
    },
    {
      supplierId: 'SUP-005',
      legalName: 'Savannah Home Care Manufacturers Ltd',
      tradingName: 'Savannah Home Care',
      supplierCategory: 'Household Goods',
      procurementCategory: 'HOUSEHOLD',
      city: 'Nairobi',
      currency: 'KES',
      paymentTerms: 'NET_30',
      riskRating: 'LOW',
      approvalStatus: 'APPROVED',
      primaryContactName: 'Patrick Kilonzo',
      relationshipOwnerEmployeeId: 'EMP-0004',
    },
    {
      supplierId: 'SUP-006',
      legalName: 'Lakeside Detergents & Chemicals Ltd',
      tradingName: 'Lakeside Chemicals',
      supplierCategory: 'Household Goods',
      procurementCategory: 'HOUSEHOLD',
      city: 'Kisumu',
      currency: 'KES',
      paymentTerms: 'NET_30',
      riskRating: 'MEDIUM',
      approvalStatus: 'APPROVED',
      primaryContactName: 'Emily Adhiambo',
      relationshipOwnerEmployeeId: 'EMP-0016',
    },
    {
      supplierId: 'SUP-007',
      legalName: 'Amani Personal Care Manufacturing Ltd',
      tradingName: 'Amani Personal Care',
      supplierCategory: 'Personal Care',
      procurementCategory: 'PERSONAL_CARE',
      city: 'Nairobi',
      currency: 'KES',
      paymentTerms: 'NET_30',
      riskRating: 'LOW',
      approvalStatus: 'APPROVED',
      primaryContactName: 'Nicholas Wamalwa',
      relationshipOwnerEmployeeId: 'EMP-0004',
    },
    {
      supplierId: 'SUP-008',
      legalName: 'Nyati Consumer Products Ltd',
      tradingName: 'Nyati Consumer Products',
      supplierCategory: 'Personal Care',
      procurementCategory: 'PERSONAL_CARE',
      city: 'Nairobi',
      currency: 'KES',
      paymentTerms: 'NET_30',
      riskRating: 'MEDIUM',
      approvalStatus: 'APPROVED',
      primaryContactName: 'Beatrice Nyambura',
      relationshipOwnerEmployeeId: 'EMP-0015',
    },
    {
      supplierId: 'SUP-009',
      legalName: 'Value Foods Kenya Ltd',
      tradingName: 'Value Foods Kenya',
      supplierCategory: 'Food Products',
      procurementCategory: 'FOOD',
      city: 'Nairobi',
      currency: 'KES',
      paymentTerms: 'NET_15',
      riskRating: 'MEDIUM',
      approvalStatus: 'APPROVED',
      primaryContactName: 'Robert Kiptum',
      relationshipOwnerEmployeeId: 'EMP-0016',
    },
    {
      supplierId: 'SUP-010',
      legalName: 'Prime Pack Industries Ltd',
      tradingName: 'Prime Pack',
      supplierCategory: 'Packaging',
      procurementCategory: 'PACKAGING',
      city: 'Nairobi',
      currency: 'KES',
      paymentTerms: 'NET_30',
      riskRating: 'LOW',
      approvalStatus: 'APPROVED',
      primaryContactName: 'Samuel Mutua',
      relationshipOwnerEmployeeId: 'EMP-0015',
    },
    {
      supplierId: 'SUP-011',
      legalName: 'Nairobi Office Solutions Ltd',
      tradingName: 'Nairobi Office Solutions',
      supplierCategory: 'Office Supplies',
      procurementCategory: 'OFFICE_SUPPLIES',
      city: 'Nairobi',
      currency: 'KES',
      paymentTerms: 'NET_30',
      riskRating: 'LOW',
      approvalStatus: 'APPROVED',
      primaryContactName: 'Grace Moraa',
      relationshipOwnerEmployeeId: 'EMP-0016',
    },
    {
      supplierId: 'SUP-012',
      legalName: 'Techlink Systems Ltd',
      tradingName: 'Techlink Systems',
      supplierCategory: 'IT Equipment',
      procurementCategory: 'IT_EQUIPMENT',
      city: 'Nairobi',
      currency: 'USD',
      paymentTerms: 'NET_45',
      riskRating: 'MEDIUM',
      approvalStatus: 'APPROVED',
      primaryContactName: 'Victor Omondi',
      relationshipOwnerEmployeeId: 'EMP-0004',
    },
    {
      supplierId: 'SUP-013',
      legalName: 'Swift Freight Logistics Ltd',
      tradingName: 'Swift Freight Logistics',
      supplierCategory: 'Logistics',
      procurementCategory: 'LOGISTICS',
      city: 'Mombasa',
      currency: 'KES',
      paymentTerms: 'NET_30',
      riskRating: 'HIGH',
      approvalStatus: 'APPROVED',
      primaryContactName: 'Fatuma Salim',
      relationshipOwnerEmployeeId: 'EMP-0004',
    },
    {
      supplierId: 'SUP-014',
      legalName: 'CleanPro Facility Services Ltd',
      tradingName: 'CleanPro Services',
      supplierCategory: 'Cleaning Services',
      procurementCategory: 'CLEANING_SERVICES',
      city: 'Nairobi',
      currency: 'KES',
      paymentTerms: 'NET_15',
      riskRating: 'LOW',
      approvalStatus: 'APPROVED',
      primaryContactName: 'Josephat Mureithi',
      relationshipOwnerEmployeeId: 'EMP-0016',
    },
    {
      supplierId: 'SUP-015',
      legalName: 'Guardian Facilities Management Ltd',
      tradingName: 'Guardian Facilities',
      supplierCategory: 'Facilities Services',
      procurementCategory: 'FACILITIES_SERVICES',
      city: 'Nairobi',
      currency: 'KES',
      paymentTerms: 'NET_30',
      riskRating: 'LOW',
      approvalStatus: 'APPROVED',
      primaryContactName: 'Consolata Wanjala',
      relationshipOwnerEmployeeId: 'EMP-0015',
    },
    {
      supplierId: 'SUP-016',
      legalName: 'Economy Household Supplies Ltd',
      tradingName: 'Economy Household Supplies',
      supplierCategory: 'Household Goods',
      procurementCategory: 'HOUSEHOLD',
      city: 'Kisumu',
      currency: 'KES',
      paymentTerms: 'NET_30',
      riskRating: 'MEDIUM',
      approvalStatus: 'PENDING_APPROVAL',
      primaryContactName: 'Hosea Ochieng',
      relationshipOwnerEmployeeId: 'EMP-0016',
    },
  ];

  return seeds.map((seed, index) => {
    const supplierNumber = index + 1;
    const domain = `${seed.tradingName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.co.ke`;

    return {
      supplierId: seed.supplierId,
      supplierCode: `SUP-${String(supplierNumber).padStart(4, '0')}`,
      legalName: seed.legalName,
      tradingName: seed.tradingName,
      supplierCategory: seed.supplierCategory,
      contactEmail: `procurement@${domain}`,
      contactPhone: `+254-20-${String(4000000 + supplierNumber).padStart(7, '0')}`,
      country: 'Kenya',
      city: seed.city,
      paymentTerms: seed.paymentTerms,
      currency: seed.currency,
      taxRegistrationStatus: 'REGISTERED',
      approvalStatus: seed.approvalStatus,
      riskRating: seed.riskRating,
      procurementCategory: seed.procurementCategory,
      primaryContactName: seed.primaryContactName,
      relationshipOwnerEmployeeId: seed.relationshipOwnerEmployeeId,
      // Populated after products are generated, by linkProductsToSuppliers().
      suppliedProductIds: [],
      active: seed.approvalStatus !== 'SUSPENDED',
    };
  });
}

// ---------------------------------------------------------------------------
// 4. Products
// ---------------------------------------------------------------------------

interface ProductSeed {
  productId: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  unitCost: number;
  sellingPrice: number;
  reorderLevel: number;
  reorderQuantity: number;
  supplierIds: string[];
  taxCategory: 'STANDARD' | 'ZERO_RATED';
  status: 'ACTIVE' | 'DISCONTINUED';
}

function generateProducts(): Product[] {
  const seeds: ProductSeed[] = [
    // --- Food: Cooking Oil ---
    {
      productId: 'PRD-001',
      sku: 'FOOD-OIL-001',
      name: 'Tumaini Gold Cooking Oil 5L',
      description: 'Fortified vegetable cooking oil, 5 litre bottle, branded line.',
      category: 'Food',
      subcategory: 'Cooking Oil',
      unitCost: 850,
      sellingPrice: 980,
      reorderLevel: 300,
      reorderQuantity: 1000,
      supplierIds: ['SUP-001', 'SUP-009'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-002',
      sku: 'FOOD-OIL-002',
      name: 'SVGA Value Cooking Oil 5L',
      description: 'Fortified vegetable cooking oil, 5 litre bottle, economy private-label line.',
      category: 'Food',
      subcategory: 'Cooking Oil',
      unitCost: 700,
      sellingPrice: 810,
      reorderLevel: 350,
      reorderQuantity: 1200,
      supplierIds: ['SUP-009', 'SUP-001'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    // --- Food: Maize Flour ---
    {
      productId: 'PRD-003',
      sku: 'FOOD-MFLR-001',
      name: 'Tumaini Maize Flour 2Kg',
      description: 'Sifted maize meal, 2 kilogram bag, branded line.',
      category: 'Food',
      subcategory: 'Maize Flour',
      unitCost: 120,
      sellingPrice: 145,
      reorderLevel: 500,
      reorderQuantity: 2000,
      supplierIds: ['SUP-002', 'SUP-001'],
      taxCategory: 'ZERO_RATED',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-004',
      sku: 'FOOD-MFLR-002',
      name: 'SVGA Value Maize Flour 2Kg',
      description: 'Sifted maize meal, 2 kilogram bag, economy private-label line.',
      category: 'Food',
      subcategory: 'Maize Flour',
      unitCost: 95,
      sellingPrice: 115,
      reorderLevel: 600,
      reorderQuantity: 2500,
      supplierIds: ['SUP-002', 'SUP-009'],
      taxCategory: 'ZERO_RATED',
      status: 'ACTIVE',
    },
    // --- Food: Wheat Flour ---
    {
      productId: 'PRD-005',
      sku: 'FOOD-WFLR-001',
      name: 'Tumaini Wheat Flour 2Kg',
      description: 'All-purpose wheat flour, 2 kilogram bag, branded line.',
      category: 'Food',
      subcategory: 'Wheat Flour',
      unitCost: 130,
      sellingPrice: 155,
      reorderLevel: 450,
      reorderQuantity: 1800,
      supplierIds: ['SUP-002', 'SUP-001'],
      taxCategory: 'ZERO_RATED',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-006',
      sku: 'FOOD-WFLR-002',
      name: 'SVGA Value Wheat Flour 2Kg',
      description: 'All-purpose wheat flour, 2 kilogram bag, economy private-label line.',
      category: 'Food',
      subcategory: 'Wheat Flour',
      unitCost: 105,
      sellingPrice: 125,
      reorderLevel: 550,
      reorderQuantity: 2200,
      supplierIds: ['SUP-002', 'SUP-009'],
      taxCategory: 'ZERO_RATED',
      status: 'ACTIVE',
    },
    // --- Food: Rice ---
    {
      productId: 'PRD-007',
      sku: 'FOOD-RICE-001',
      name: 'Tumaini Pishori Rice 5Kg',
      description: 'Aromatic pishori rice, 5 kilogram bag, branded line.',
      category: 'Food',
      subcategory: 'Rice',
      unitCost: 680,
      sellingPrice: 790,
      reorderLevel: 300,
      reorderQuantity: 1000,
      supplierIds: ['SUP-001', 'SUP-002'],
      taxCategory: 'ZERO_RATED',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-008',
      sku: 'FOOD-RICE-002',
      name: 'SVGA Value Rice 5Kg',
      description: 'Long-grain white rice, 5 kilogram bag, economy private-label line.',
      category: 'Food',
      subcategory: 'Rice',
      unitCost: 560,
      sellingPrice: 650,
      reorderLevel: 350,
      reorderQuantity: 1200,
      supplierIds: ['SUP-009', 'SUP-002'],
      taxCategory: 'ZERO_RATED',
      status: 'ACTIVE',
    },
    // --- Food: Sugar ---
    {
      productId: 'PRD-009',
      sku: 'FOOD-SUGR-001',
      name: 'Tumaini White Sugar 2Kg',
      description: 'Refined white sugar, 2 kilogram bag, branded line.',
      category: 'Food',
      subcategory: 'Sugar',
      unitCost: 220,
      sellingPrice: 255,
      reorderLevel: 400,
      reorderQuantity: 1500,
      supplierIds: ['SUP-002', 'SUP-001'],
      taxCategory: 'ZERO_RATED',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-010',
      sku: 'FOOD-SUGR-002',
      name: 'SVGA Value White Sugar 2Kg',
      description: 'Refined white sugar, 2 kilogram bag, economy private-label line.',
      category: 'Food',
      subcategory: 'Sugar',
      unitCost: 200,
      sellingPrice: 230,
      reorderLevel: 450,
      reorderQuantity: 1800,
      supplierIds: ['SUP-002', 'SUP-009'],
      taxCategory: 'ZERO_RATED',
      status: 'ACTIVE',
    },
    // --- Food: Canned Foods ---
    {
      productId: 'PRD-011',
      sku: 'FOOD-CANS-001',
      name: 'Tumaini Baked Beans 400g',
      description: 'Canned baked beans in tomato sauce, 400 gram tin, branded line.',
      category: 'Food',
      subcategory: 'Canned Foods',
      unitCost: 85,
      sellingPrice: 105,
      reorderLevel: 250,
      reorderQuantity: 900,
      supplierIds: ['SUP-001'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-012',
      sku: 'FOOD-CANS-002',
      name: 'SVGA Value Baked Beans 400g',
      description: 'Canned baked beans in tomato sauce, 400 gram tin, economy private-label line.',
      category: 'Food',
      subcategory: 'Canned Foods',
      unitCost: 65,
      sellingPrice: 80,
      reorderLevel: 300,
      reorderQuantity: 1000,
      supplierIds: ['SUP-009', 'SUP-001'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    // --- Beverages: Bottled Water ---
    {
      productId: 'PRD-013',
      sku: 'BEV-WATR-001',
      name: 'Chemchemi Bottled Water 500ml (24-pack)',
      description: 'Purified bottled water, 500ml x 24 pack, branded line.',
      category: 'Beverages',
      subcategory: 'Bottled Water',
      unitCost: 480,
      sellingPrice: 560,
      reorderLevel: 200,
      reorderQuantity: 800,
      supplierIds: ['SUP-003', 'SUP-004'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-014',
      sku: 'BEV-WATR-002',
      name: 'SVGA Value Bottled Water 500ml (24-pack)',
      description: 'Purified bottled water, 500ml x 24 pack, economy private-label line.',
      category: 'Beverages',
      subcategory: 'Bottled Water',
      unitCost: 400,
      sellingPrice: 470,
      reorderLevel: 250,
      reorderQuantity: 1000,
      supplierIds: ['SUP-004'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    // --- Beverages: Soft Drinks ---
    {
      productId: 'PRD-015',
      sku: 'BEV-SOFT-001',
      name: 'Chemchemi Soft Drink 300ml (24-pack)',
      description: 'Carbonated soft drink, 300ml x 24 pack, branded line.',
      category: 'Beverages',
      subcategory: 'Soft Drinks',
      unitCost: 620,
      sellingPrice: 720,
      reorderLevel: 220,
      reorderQuantity: 900,
      supplierIds: ['SUP-003', 'SUP-004'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-016',
      sku: 'BEV-SOFT-002',
      name: 'SVGA Value Soft Drink 300ml (24-pack)',
      description: 'Carbonated soft drink, 300ml x 24 pack, economy private-label line.',
      category: 'Beverages',
      subcategory: 'Soft Drinks',
      unitCost: 540,
      sellingPrice: 630,
      reorderLevel: 260,
      reorderQuantity: 1000,
      supplierIds: ['SUP-004'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    // --- Beverages: Juice ---
    {
      productId: 'PRD-017',
      sku: 'BEV-JUICE-001',
      name: 'Chemchemi Fruit Juice 1L',
      description: 'Mixed-fruit juice blend, 1 litre carton, branded line.',
      category: 'Beverages',
      subcategory: 'Juice',
      unitCost: 150,
      sellingPrice: 180,
      reorderLevel: 300,
      reorderQuantity: 1200,
      supplierIds: ['SUP-003'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-018',
      sku: 'BEV-JUICE-002',
      name: 'SVGA Value Fruit Juice 1L',
      description: 'Mixed-fruit juice blend, 1 litre carton, economy private-label line.',
      category: 'Beverages',
      subcategory: 'Juice',
      unitCost: 120,
      sellingPrice: 145,
      reorderLevel: 350,
      reorderQuantity: 1400,
      supplierIds: ['SUP-004', 'SUP-003'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    // --- Beverages: Energy Drinks ---
    {
      productId: 'PRD-019',
      sku: 'BEV-ENGY-001',
      name: 'Chemchemi Energy Drink 250ml (24-pack)',
      description: 'Caffeinated energy drink, 250ml x 24 pack, branded line.',
      category: 'Beverages',
      subcategory: 'Energy Drinks',
      unitCost: 1450,
      sellingPrice: 1680,
      reorderLevel: 150,
      reorderQuantity: 600,
      supplierIds: ['SUP-003'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-020',
      sku: 'BEV-ENGY-002',
      name: 'SVGA Value Energy Drink 250ml (24-pack)',
      description: 'Caffeinated energy drink, 250ml x 24 pack, economy private-label line.',
      category: 'Beverages',
      subcategory: 'Energy Drinks',
      unitCost: 1200,
      sellingPrice: 1400,
      reorderLevel: 180,
      reorderQuantity: 700,
      supplierIds: ['SUP-004'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    // --- Household: Laundry Detergent ---
    {
      productId: 'PRD-021',
      sku: 'HH-LNDY-001',
      name: 'Safi Laundry Detergent 1Kg',
      description: 'Laundry washing powder, 1 kilogram pack, branded line.',
      category: 'Household',
      subcategory: 'Laundry Detergent',
      unitCost: 220,
      sellingPrice: 260,
      reorderLevel: 300,
      reorderQuantity: 1200,
      supplierIds: ['SUP-005', 'SUP-006'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-022',
      sku: 'HH-LNDY-002',
      name: 'SVGA Value Laundry Detergent 1Kg',
      description: 'Laundry washing powder, 1 kilogram pack, economy private-label line.',
      category: 'Household',
      subcategory: 'Laundry Detergent',
      unitCost: 180,
      sellingPrice: 215,
      reorderLevel: 350,
      reorderQuantity: 1400,
      supplierIds: ['SUP-016', 'SUP-006'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    // --- Household: Dishwashing Liquid ---
    {
      productId: 'PRD-023',
      sku: 'HH-DISH-001',
      name: 'Safi Dishwashing Liquid 750ml',
      description: 'Dishwashing liquid soap, 750ml bottle, branded line.',
      category: 'Household',
      subcategory: 'Dishwashing Liquid',
      unitCost: 140,
      sellingPrice: 170,
      reorderLevel: 280,
      reorderQuantity: 1000,
      supplierIds: ['SUP-005'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-024',
      sku: 'HH-DISH-002',
      name: 'SVGA Value Dishwashing Liquid 750ml',
      description: 'Dishwashing liquid soap, 750ml bottle, economy private-label line.',
      category: 'Household',
      subcategory: 'Dishwashing Liquid',
      unitCost: 115,
      sellingPrice: 140,
      reorderLevel: 320,
      reorderQuantity: 1200,
      supplierIds: ['SUP-016'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    // --- Household: Tissue ---
    {
      productId: 'PRD-025',
      sku: 'HH-TISS-001',
      name: 'Safi Tissue Paper (10-roll pack)',
      description: 'Soft tissue paper, 10-roll pack, branded line.',
      category: 'Household',
      subcategory: 'Tissue',
      unitCost: 320,
      sellingPrice: 380,
      reorderLevel: 250,
      reorderQuantity: 900,
      supplierIds: ['SUP-005', 'SUP-006'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-026',
      sku: 'HH-TISS-002',
      name: 'SVGA Value Tissue Paper (10-roll pack)',
      description: 'Soft tissue paper, 10-roll pack, economy private-label line.',
      category: 'Household',
      subcategory: 'Tissue',
      unitCost: 270,
      sellingPrice: 320,
      reorderLevel: 300,
      reorderQuantity: 1000,
      supplierIds: ['SUP-016'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    // --- Household: Cleaning Products ---
    {
      productId: 'PRD-027',
      sku: 'HH-CLEAN-001',
      name: 'Safi Multi-Surface Cleaner 750ml',
      description: 'Multi-surface household cleaner, 750ml bottle, branded line.',
      category: 'Household',
      subcategory: 'Cleaning Products',
      unitCost: 160,
      sellingPrice: 195,
      reorderLevel: 260,
      reorderQuantity: 950,
      supplierIds: ['SUP-006', 'SUP-005'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-028',
      sku: 'HH-CLEAN-002',
      name: 'SVGA Value Multi-Surface Cleaner 750ml',
      description: 'Multi-surface household cleaner, 750ml bottle, economy private-label line.',
      category: 'Household',
      subcategory: 'Cleaning Products',
      unitCost: 130,
      sellingPrice: 160,
      reorderLevel: 300,
      reorderQuantity: 1100,
      supplierIds: ['SUP-016'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    // --- Personal Care: Soap ---
    {
      productId: 'PRD-029',
      sku: 'PC-SOAP-001',
      name: 'Amani Bathing Soap (3-pack)',
      description: 'Bathing soap bars, 3-pack, branded line.',
      category: 'Personal Care',
      subcategory: 'Soap',
      unitCost: 150,
      sellingPrice: 180,
      reorderLevel: 300,
      reorderQuantity: 1000,
      supplierIds: ['SUP-007', 'SUP-008'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-030',
      sku: 'PC-SOAP-002',
      name: 'SVGA Value Bathing Soap (3-pack)',
      description: 'Bathing soap bars, 3-pack, economy private-label line.',
      category: 'Personal Care',
      subcategory: 'Soap',
      unitCost: 120,
      sellingPrice: 145,
      reorderLevel: 350,
      reorderQuantity: 1200,
      supplierIds: ['SUP-008'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    // --- Personal Care: Shampoo ---
    {
      productId: 'PRD-031',
      sku: 'PC-SHMP-001',
      name: 'Amani Shampoo 400ml',
      description: 'Everyday moisturising shampoo, 400ml bottle, branded line.',
      category: 'Personal Care',
      subcategory: 'Shampoo',
      unitCost: 280,
      sellingPrice: 335,
      reorderLevel: 220,
      reorderQuantity: 800,
      supplierIds: ['SUP-007'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-032',
      sku: 'PC-SHMP-002',
      name: 'SVGA Value Shampoo 400ml',
      description: 'Everyday moisturising shampoo, 400ml bottle, economy private-label line.',
      category: 'Personal Care',
      subcategory: 'Shampoo',
      unitCost: 230,
      sellingPrice: 275,
      reorderLevel: 260,
      reorderQuantity: 900,
      supplierIds: ['SUP-008', 'SUP-007'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    // --- Personal Care: Toothpaste ---
    {
      productId: 'PRD-033',
      sku: 'PC-TPST-001',
      name: 'Amani Toothpaste 150g',
      description: 'Fluoride toothpaste, 150 gram tube, branded line.',
      category: 'Personal Care',
      subcategory: 'Toothpaste',
      unitCost: 130,
      sellingPrice: 158,
      reorderLevel: 300,
      reorderQuantity: 1000,
      supplierIds: ['SUP-007'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-034',
      sku: 'PC-TPST-002',
      name: 'SVGA Value Toothpaste 150g',
      description: 'Fluoride toothpaste, 150 gram tube, economy private-label line.',
      category: 'Personal Care',
      subcategory: 'Toothpaste',
      unitCost: 105,
      sellingPrice: 128,
      reorderLevel: 350,
      reorderQuantity: 1200,
      supplierIds: ['SUP-008'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    // --- Personal Care: Deodorant ---
    {
      productId: 'PRD-035',
      sku: 'PC-DEOD-001',
      name: 'Amani Deodorant Spray 150ml',
      description: 'Body deodorant spray, 150ml can, branded line.',
      category: 'Personal Care',
      subcategory: 'Deodorant',
      unitCost: 210,
      sellingPrice: 252,
      reorderLevel: 220,
      reorderQuantity: 800,
      supplierIds: ['SUP-007', 'SUP-008'],
      taxCategory: 'STANDARD',
      status: 'ACTIVE',
    },
    {
      productId: 'PRD-036',
      sku: 'PC-DEOD-002',
      name: 'SVGA Value Deodorant Spray 150ml',
      description:
        'Body deodorant spray, 150ml can, economy private-label line. Discontinued; superseded by a reformulated pack size.',
      category: 'Personal Care',
      subcategory: 'Deodorant',
      unitCost: 175,
      sellingPrice: 210,
      reorderLevel: 250,
      reorderQuantity: 900,
      supplierIds: ['SUP-008'],
      taxCategory: 'STANDARD',
      status: 'DISCONTINUED',
    },
  ];

  return seeds.map((seed) => ({
    productId: seed.productId,
    sku: seed.sku,
    name: seed.name,
    description: seed.description,
    category: seed.category,
    subcategory: seed.subcategory,
    unitOfMeasure: 'UNIT',
    unitCost: seed.unitCost,
    sellingPrice: seed.sellingPrice,
    reorderLevel: seed.reorderLevel,
    reorderQuantity: seed.reorderQuantity,
    supplierIds: seed.supplierIds,
    taxCategory: seed.taxCategory,
    status: seed.status,
  }));
}

/**
 * Derives each supplier's `suppliedProductIds` from the authoritative
 * `product.supplierIds` links, so the two files can never drift apart.
 */
function linkProductsToSuppliers(products: Product[], suppliers: Supplier[]): Supplier[] {
  const productIdsBySupplier = new Map<string, string[]>();

  for (const product of products) {
    for (const supplierId of product.supplierIds) {
      const existing = productIdsBySupplier.get(supplierId) ?? [];
      existing.push(product.productId);
      productIdsBySupplier.set(supplierId, existing);
    }
  }

  return suppliers.map((supplier) => ({
    ...supplier,
    suppliedProductIds: productIdsBySupplier.get(supplier.supplierId) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// 5. Customers
// ---------------------------------------------------------------------------

interface CustomerSeed {
  customerId: string;
  legalName: string;
  tradingName: string;
  customerType: string;
  industry: string;
  city: string;
  county: string;
  creditLimit: number;
  paymentTerms: PaymentTerms;
  accountManagerEmployeeId: string;
  customerStatus: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  riskRating: RiskRating;
}

function generateCustomers(): Customer[] {
  const seeds: CustomerSeed[] = [
    {
      customerId: 'CUS-001',
      legalName: 'Nairobi Retail Holdings Ltd',
      tradingName: 'Nairobi Retail Holdings',
      customerType: 'RETAIL_CHAIN',
      industry: 'Retail',
      city: 'Nairobi',
      county: 'Nairobi',
      creditLimit: 5_000_000,
      paymentTerms: 'NET_30',
      accountManagerEmployeeId: 'EMP-0017',
      customerStatus: 'ACTIVE',
      riskRating: 'LOW',
    },
    {
      customerId: 'CUS-002',
      legalName: 'Coastal Supermarkets Ltd',
      tradingName: 'Coastal Supermarkets',
      customerType: 'RETAIL_CHAIN',
      industry: 'Retail',
      city: 'Mombasa',
      county: 'Mombasa',
      creditLimit: 4_000_000,
      paymentTerms: 'NET_30',
      accountManagerEmployeeId: 'EMP-0018',
      customerStatus: 'ACTIVE',
      riskRating: 'LOW',
    },
    {
      customerId: 'CUS-003',
      legalName: 'Lakeview Supermarkets Ltd',
      tradingName: 'Lakeview Supermarkets',
      customerType: 'RETAIL_CHAIN',
      industry: 'Retail',
      city: 'Kisumu',
      county: 'Kisumu',
      creditLimit: 3_000_000,
      paymentTerms: 'NET_30',
      accountManagerEmployeeId: 'EMP-0019',
      customerStatus: 'ACTIVE',
      riskRating: 'MEDIUM',
    },
    {
      customerId: 'CUS-004',
      legalName: 'Rift Valley Mart Ltd',
      tradingName: 'Rift Valley Mart',
      customerType: 'RETAIL_CHAIN',
      industry: 'Retail',
      city: 'Nakuru',
      county: 'Nakuru',
      creditLimit: 2_500_000,
      paymentTerms: 'NET_30',
      accountManagerEmployeeId: 'EMP-0020',
      customerStatus: 'ACTIVE',
      riskRating: 'MEDIUM',
    },
    {
      customerId: 'CUS-005',
      legalName: 'Jambo Corner Shop Ltd',
      tradingName: 'Jambo Corner Shop',
      customerType: 'INDEPENDENT_RETAILER',
      industry: 'Retail',
      city: 'Nairobi',
      county: 'Nairobi',
      creditLimit: 300_000,
      paymentTerms: 'NET_15',
      accountManagerEmployeeId: 'EMP-0017',
      customerStatus: 'ACTIVE',
      riskRating: 'MEDIUM',
    },
    {
      customerId: 'CUS-006',
      legalName: 'Baraka General Store Ltd',
      tradingName: 'Baraka General Store',
      customerType: 'INDEPENDENT_RETAILER',
      industry: 'Retail',
      city: 'Mombasa',
      county: 'Mombasa',
      creditLimit: 250_000,
      paymentTerms: 'NET_15',
      accountManagerEmployeeId: 'EMP-0018',
      customerStatus: 'ACTIVE',
      riskRating: 'MEDIUM',
    },
    {
      customerId: 'CUS-007',
      legalName: 'Furaha Provision Store Ltd',
      tradingName: 'Furaha Provision Store',
      customerType: 'INDEPENDENT_RETAILER',
      industry: 'Retail',
      city: 'Kisumu',
      county: 'Kisumu',
      creditLimit: 200_000,
      paymentTerms: 'NET_15',
      accountManagerEmployeeId: 'EMP-0019',
      customerStatus: 'ACTIVE',
      riskRating: 'HIGH',
    },
    {
      customerId: 'CUS-008',
      legalName: 'Serena Highlands Hotel Ltd',
      tradingName: 'Serena Highlands Hotel',
      customerType: 'HOSPITALITY',
      industry: 'Hospitality',
      city: 'Nairobi',
      county: 'Nairobi',
      creditLimit: 2_000_000,
      paymentTerms: 'NET_30',
      accountManagerEmployeeId: 'EMP-0005',
      customerStatus: 'ACTIVE',
      riskRating: 'LOW',
    },
    {
      customerId: 'CUS-009',
      legalName: 'Tembo Beach Resort Ltd',
      tradingName: 'Tembo Beach Resort',
      customerType: 'HOSPITALITY',
      industry: 'Hospitality',
      city: 'Mombasa',
      county: 'Mombasa',
      creditLimit: 1_800_000,
      paymentTerms: 'NET_30',
      accountManagerEmployeeId: 'EMP-0018',
      customerStatus: 'ACTIVE',
      riskRating: 'LOW',
    },
    {
      customerId: 'CUS-010',
      legalName: 'Nyanza Lake Lodge Ltd',
      tradingName: 'Nyanza Lake Lodge',
      customerType: 'HOSPITALITY',
      industry: 'Hospitality',
      city: 'Kisumu',
      county: 'Kisumu',
      creditLimit: 900_000,
      paymentTerms: 'NET_30',
      accountManagerEmployeeId: 'EMP-0019',
      customerStatus: 'ACTIVE',
      riskRating: 'MEDIUM',
    },
    {
      customerId: 'CUS-011',
      legalName: 'Mama Ashante Restaurant Ltd',
      tradingName: 'Mama Ashante Restaurant',
      customerType: 'RESTAURANT',
      industry: 'Food Service',
      city: 'Nairobi',
      county: 'Nairobi',
      creditLimit: 400_000,
      paymentTerms: 'NET_15',
      accountManagerEmployeeId: 'EMP-0017',
      customerStatus: 'ACTIVE',
      riskRating: 'MEDIUM',
    },
    {
      customerId: 'CUS-012',
      legalName: 'Bahari Grill Restaurant Ltd',
      tradingName: 'Bahari Grill',
      customerType: 'RESTAURANT',
      industry: 'Food Service',
      city: 'Mombasa',
      county: 'Mombasa',
      creditLimit: 350_000,
      paymentTerms: 'NET_15',
      accountManagerEmployeeId: 'EMP-0018',
      customerStatus: 'ACTIVE',
      riskRating: 'MEDIUM',
    },
    {
      customerId: 'CUS-013',
      legalName: 'Kilimo Wholesalers Ltd',
      tradingName: 'Kilimo Wholesalers',
      customerType: 'WHOLESALER',
      industry: 'Wholesale Trade',
      city: 'Nairobi',
      county: 'Nairobi',
      creditLimit: 6_000_000,
      paymentTerms: 'NET_45',
      accountManagerEmployeeId: 'EMP-0005',
      customerStatus: 'ACTIVE',
      riskRating: 'LOW',
    },
    {
      customerId: 'CUS-014',
      legalName: 'Pwani Wholesale Traders Ltd',
      tradingName: 'Pwani Wholesale Traders',
      customerType: 'WHOLESALER',
      industry: 'Wholesale Trade',
      city: 'Mombasa',
      county: 'Mombasa',
      creditLimit: 4_500_000,
      paymentTerms: 'NET_45',
      accountManagerEmployeeId: 'EMP-0018',
      customerStatus: 'ACTIVE',
      riskRating: 'MEDIUM',
    },
    {
      customerId: 'CUS-015',
      legalName: 'Western Bulk Traders Ltd',
      tradingName: 'Western Bulk Traders',
      customerType: 'WHOLESALER',
      industry: 'Wholesale Trade',
      city: 'Kisumu',
      county: 'Kisumu',
      creditLimit: 3_500_000,
      paymentTerms: 'NET_45',
      accountManagerEmployeeId: 'EMP-0019',
      customerStatus: 'ACTIVE',
      riskRating: 'MEDIUM',
    },
    {
      customerId: 'CUS-016',
      legalName: 'Uzima Schools Group Ltd',
      tradingName: 'Uzima Schools Group',
      customerType: 'INSTITUTIONAL',
      industry: 'Education',
      city: 'Nairobi',
      county: 'Nairobi',
      creditLimit: 1_200_000,
      paymentTerms: 'NET_30',
      accountManagerEmployeeId: 'EMP-0017',
      customerStatus: 'ACTIVE',
      riskRating: 'LOW',
    },
    {
      customerId: 'CUS-017',
      legalName: 'Amani Girls High School',
      tradingName: 'Amani Girls High School',
      customerType: 'INSTITUTIONAL',
      industry: 'Education',
      city: 'Nakuru',
      county: 'Nakuru',
      creditLimit: 800_000,
      paymentTerms: 'NET_30',
      accountManagerEmployeeId: 'EMP-0020',
      customerStatus: 'ACTIVE',
      riskRating: 'LOW',
    },
    {
      customerId: 'CUS-018',
      legalName: 'Mwangaza Hospital Ltd',
      tradingName: 'Mwangaza Hospital',
      customerType: 'INSTITUTIONAL',
      industry: 'Healthcare',
      city: 'Nairobi',
      county: 'Nairobi',
      creditLimit: 1_500_000,
      paymentTerms: 'NET_30',
      accountManagerEmployeeId: 'EMP-0017',
      customerStatus: 'ACTIVE',
      riskRating: 'LOW',
    },
    {
      customerId: 'CUS-019',
      legalName: 'Coast General Medical Centre Ltd',
      tradingName: 'Coast General Medical Centre',
      customerType: 'INSTITUTIONAL',
      industry: 'Healthcare',
      city: 'Mombasa',
      county: 'Mombasa',
      creditLimit: 1_000_000,
      paymentTerms: 'NET_30',
      accountManagerEmployeeId: 'EMP-0018',
      customerStatus: 'ACTIVE',
      riskRating: 'LOW',
    },
    {
      customerId: 'CUS-020',
      legalName: 'Zawadi Corporate Services Ltd',
      tradingName: 'Zawadi Corporate Services',
      customerType: 'CORPORATE',
      industry: 'Corporate Services',
      city: 'Nairobi',
      county: 'Nairobi',
      creditLimit: 700_000,
      paymentTerms: 'NET_30',
      accountManagerEmployeeId: 'EMP-0005',
      customerStatus: 'SUSPENDED',
      riskRating: 'HIGH',
    },
  ];

  return seeds.map((seed, index) => ({
    customerId: seed.customerId,
    customerCode: `CUST-${String(index + 1).padStart(4, '0')}`,
    legalName: seed.legalName,
    tradingName: seed.tradingName,
    customerType: seed.customerType,
    industry: seed.industry,
    city: seed.city,
    county: seed.county,
    country: 'Kenya',
    creditLimit: seed.creditLimit,
    paymentTerms: seed.paymentTerms,
    accountManagerEmployeeId: seed.accountManagerEmployeeId,
    customerStatus: seed.customerStatus,
    riskRating: seed.riskRating,
  }));
}

// ---------------------------------------------------------------------------
// 6. Inventory — every active product at every warehouse, with deliberately
//    varied stock conditions (healthy / low / below reorder / zero / heavily
//    reserved) so later scenarios and RAG questions have something to ask
//    about. The discontinued product only has a residual record at the
//    Nairobi hub, reflecting that it was withdrawn from regional stocking.
// ---------------------------------------------------------------------------

/** Regional distribution centres carry a fraction of the main hub's depth. */
const WAREHOUSE_STOCK_MULTIPLIER: Record<string, number> = {
  'WH-NRB-001': 1,
  'WH-MSA-001': 0.6,
  'WH-KSM-001': 0.45,
  'WH-NKR-001': 0.35,
};

function roundToTen(value: number, minimum: number): number {
  return Math.max(minimum, Math.round(value / 10) * 10);
}

interface StockLevels {
  quantityOnHand: number;
  quantityReserved: number;
}

/**
 * Cycles through five deterministic stock conditions based on a product and
 * warehouse's position in their (fixed-order) arrays, so the same pair
 * always produces the same condition without any randomness.
 */
function computeStockLevels(reorderLevel: number, conditionIndex: number): StockLevels {
  switch (conditionIndex % 5) {
    case 0: {
      // Healthy stock, small reservation.
      const quantityOnHand = reorderLevel * 4;
      return { quantityOnHand, quantityReserved: Math.round(quantityOnHand * 0.05) };
    }
    case 1: {
      // Low but still above the reorder level.
      const quantityOnHand = Math.round(reorderLevel * 1.3);
      return { quantityOnHand, quantityReserved: Math.round(quantityOnHand * 0.1) };
    }
    case 2: {
      // Below the reorder level: reorder required.
      const quantityOnHand = Math.round(reorderLevel * 0.6);
      return { quantityOnHand, quantityReserved: Math.round(quantityOnHand * 0.15) };
    }
    case 3: {
      // Zero stock.
      return { quantityOnHand: 0, quantityReserved: 0 };
    }
    default: {
      // Healthy on-hand quantity but heavily reserved by pending orders.
      const quantityOnHand = reorderLevel * 3;
      return { quantityOnHand, quantityReserved: Math.round(quantityOnHand * 0.4) };
    }
  }
}

function computeInventoryStatus(
  productStatus: Product['status'],
  quantityOnHand: number,
  quantityAvailable: number,
  reorderLevel: number,
): InventoryStatus {
  if (productStatus === 'DISCONTINUED') {
    return 'DISCONTINUED';
  }
  if (quantityOnHand === 0 || quantityAvailable <= 0) {
    return 'OUT_OF_STOCK';
  }
  if (quantityAvailable < reorderLevel) {
    return 'REORDER_REQUIRED';
  }
  return 'IN_STOCK';
}

/** Deterministic stock-count date derived from a fixed base date and offset. */
function computeStockCountDate(offsetDays: number): string {
  const base = Date.UTC(2026, 7, 1); // 2026-08-01
  const date = new Date(base + offsetDays * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function generateInventory(products: Product[], warehouses: Warehouse[]): InventoryRecord[] {
  const records: InventoryRecord[] = [];
  let sequence = 0;

  const activeProducts = products.filter((p) => p.status !== 'DISCONTINUED');
  const discontinuedProducts = products.filter((p) => p.status === 'DISCONTINUED');

  warehouses.forEach((warehouse, warehouseIndex) => {
    const multiplier = WAREHOUSE_STOCK_MULTIPLIER[warehouse.warehouseId] ?? 1;

    activeProducts.forEach((product, productIndex) => {
      sequence += 1;

      const scaledReorderLevel = roundToTen(product.reorderLevel * multiplier, 10);
      const scaledReorderQuantity = roundToTen(product.reorderQuantity * multiplier, 20);

      const conditionIndex = (productIndex + warehouseIndex) % 5;
      const { quantityOnHand, quantityReserved } = computeStockLevels(scaledReorderLevel, conditionIndex);
      const quantityAvailable = quantityOnHand - quantityReserved;
      const inventoryStatus = computeInventoryStatus(product.status, quantityOnHand, quantityAvailable, scaledReorderLevel);

      records.push({
        inventoryId: `INV-${String(sequence).padStart(4, '0')}`,
        productId: product.productId,
        warehouseId: warehouse.warehouseId,
        quantityOnHand,
        quantityReserved,
        quantityAvailable,
        reorderLevel: scaledReorderLevel,
        reorderQuantity: scaledReorderQuantity,
        inventoryStatus,
        lastStockCountDate: computeStockCountDate(conditionIndex * 3 + warehouseIndex),
      });
    });
  });

  // Residual record for the discontinued product: zero stock, hub only.
  const hub = warehouses.find((w) => w.warehouseId === 'WH-NRB-001');
  if (hub) {
    for (const product of discontinuedProducts) {
      sequence += 1;
      records.push({
        inventoryId: `INV-${String(sequence).padStart(4, '0')}`,
        productId: product.productId,
        warehouseId: hub.warehouseId,
        quantityOnHand: 0,
        quantityReserved: 0,
        quantityAvailable: 0,
        reorderLevel: 0,
        reorderQuantity: 0,
        inventoryStatus: 'DISCONTINUED',
        lastStockCountDate: computeStockCountDate(0),
      });
    }
  }

  return records;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

class MasterDataValidationError extends Error {
  constructor(issues: string[]) {
    super(`Master data validation failed with ${issues.length} issue(s):\n- ${issues.join('\n- ')}`);
    this.name = 'MasterDataValidationError';
  }
}

function findDuplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return Array.from(duplicates);
}

function validateMasterData(enterprise: EnterpriseData, data: MasterData): void {
  const { costCenters, warehouses, suppliers, products, customers, inventory } = data;
  const issues: string[] = [];

  const departmentIds = new Set(enterprise.departments.map((d) => d.departmentId));
  const employeeIds = new Set(enterprise.employees.map((e) => e.employeeId));
  const locationIds = new Set(enterprise.locations.map((l) => l.locationId));
  const employeeById = new Map(enterprise.employees.map((e) => [e.employeeId, e]));
  const roleById = new Map(enterprise.roles.map((r) => [r.roleId, r]));
  const salesDepartmentId = enterprise.departments.find((d) => d.name === 'Sales')?.departmentId;
  const warehouseDepartmentId = enterprise.departments.find((d) => d.name === 'Warehouse')?.departmentId;

  // --- Cost centers ---
  const costCenterDupes = findDuplicates(costCenters.map((c) => c.costCenterId));
  if (costCenterDupes.length > 0) {
    issues.push(`Duplicate cost centre IDs: ${costCenterDupes.join(', ')}`);
  }
  for (const cc of costCenters) {
    if (!departmentIds.has(cc.departmentId)) {
      issues.push(`Cost centre ${cc.costCenterId} references unknown department ${cc.departmentId}`);
    }
    if (!employeeIds.has(cc.managerEmployeeId)) {
      issues.push(`Cost centre ${cc.costCenterId} references unknown manager ${cc.managerEmployeeId}`);
    }
    if (!locationIds.has(cc.locationId)) {
      issues.push(`Cost centre ${cc.costCenterId} references unknown location ${cc.locationId}`);
    }
  }

  // --- Warehouses ---
  const warehouseDupes = findDuplicates(warehouses.map((w) => w.warehouseId));
  if (warehouseDupes.length > 0) {
    issues.push(`Duplicate warehouse IDs: ${warehouseDupes.join(', ')}`);
  }
  for (const wh of warehouses) {
    if (!locationIds.has(wh.locationId)) {
      issues.push(`Warehouse ${wh.warehouseId} references unknown location ${wh.locationId}`);
    }
    const manager = employeeById.get(wh.managerEmployeeId);
    if (!manager) {
      issues.push(`Warehouse ${wh.warehouseId} references unknown manager ${wh.managerEmployeeId}`);
    } else {
      const role = roleById.get(manager.roleId);
      const hasAppropriateRole =
        role !== undefined &&
        role.departmentId === warehouseDepartmentId &&
        (role.level === 'MANAGEMENT' || role.level === 'EXECUTIVE');
      if (!hasAppropriateRole) {
        issues.push(
          `Warehouse ${wh.warehouseId} manager ${wh.managerEmployeeId} does not hold an appropriate warehouse management role`,
        );
      }
    }
  }

  // --- Suppliers ---
  const supplierIdDupes = findDuplicates(suppliers.map((s) => s.supplierId));
  if (supplierIdDupes.length > 0) {
    issues.push(`Duplicate supplier IDs: ${supplierIdDupes.join(', ')}`);
  }
  const supplierCodeDupes = findDuplicates(suppliers.map((s) => s.supplierCode));
  if (supplierCodeDupes.length > 0) {
    issues.push(`Duplicate supplier codes: ${supplierCodeDupes.join(', ')}`);
  }
  for (const supplier of suppliers) {
    if (!(ALLOWED_SUPPLIER_CATEGORIES as readonly string[]).includes(supplier.supplierCategory)) {
      issues.push(`Supplier ${supplier.supplierId} has an invalid supplierCategory "${supplier.supplierCategory}"`);
    }
    if (!employeeIds.has(supplier.relationshipOwnerEmployeeId)) {
      issues.push(`Supplier ${supplier.supplierId} references unknown relationship owner ${supplier.relationshipOwnerEmployeeId}`);
    }
  }
  const supplierIds = new Set(suppliers.map((s) => s.supplierId));

  // --- Products ---
  const productDupes = findDuplicates(products.map((p) => p.productId));
  if (productDupes.length > 0) {
    issues.push(`Duplicate product IDs: ${productDupes.join(', ')}`);
  }
  const skuDupes = findDuplicates(products.map((p) => p.sku));
  if (skuDupes.length > 0) {
    issues.push(`Duplicate product SKUs: ${skuDupes.join(', ')}`);
  }
  for (const product of products) {
    for (const supplierId of product.supplierIds) {
      if (!supplierIds.has(supplierId)) {
        issues.push(`Product ${product.productId} references unknown supplier ${supplierId}`);
      }
    }
    if (product.supplierIds.length === 0) {
      issues.push(`Product ${product.productId} has no suppliers`);
    }
    if (product.unitCost <= 0 || product.sellingPrice <= 0) {
      issues.push(`Product ${product.productId} has a non-positive unitCost or sellingPrice`);
    }
    if (product.sellingPrice <= product.unitCost) {
      issues.push(`Product ${product.productId} has sellingPrice (${product.sellingPrice}) <= unitCost (${product.unitCost})`);
    }
    if (product.reorderLevel < 0 || product.reorderQuantity <= 0) {
      issues.push(`Product ${product.productId} has invalid reorderLevel/reorderQuantity`);
    }
  }
  const productIds = new Set(products.map((p) => p.productId));

  // --- Customers ---
  const customerIdDupes = findDuplicates(customers.map((c) => c.customerId));
  if (customerIdDupes.length > 0) {
    issues.push(`Duplicate customer IDs: ${customerIdDupes.join(', ')}`);
  }
  const customerCodeDupes = findDuplicates(customers.map((c) => c.customerCode));
  if (customerCodeDupes.length > 0) {
    issues.push(`Duplicate customer codes: ${customerCodeDupes.join(', ')}`);
  }
  for (const customer of customers) {
    const accountManager = employeeById.get(customer.accountManagerEmployeeId);
    if (!accountManager) {
      issues.push(`Customer ${customer.customerId} references unknown account manager ${customer.accountManagerEmployeeId}`);
    } else if (accountManager.departmentId !== salesDepartmentId) {
      issues.push(
        `Customer ${customer.customerId} account manager ${customer.accountManagerEmployeeId} is not in the Sales department`,
      );
    }
    if (customer.creditLimit < 0) {
      issues.push(`Customer ${customer.customerId} has a negative credit limit`);
    }
  }

  // --- Inventory ---
  const warehouseIds = new Set(warehouses.map((w) => w.warehouseId));
  const inventoryIdDupes = findDuplicates(inventory.map((i) => i.inventoryId));
  if (inventoryIdDupes.length > 0) {
    issues.push(`Duplicate inventory IDs: ${inventoryIdDupes.join(', ')}`);
  }
  for (const record of inventory) {
    if (!productIds.has(record.productId)) {
      issues.push(`Inventory ${record.inventoryId} references unknown product ${record.productId}`);
      continue;
    }
    if (!warehouseIds.has(record.warehouseId)) {
      issues.push(`Inventory ${record.inventoryId} references unknown warehouse ${record.warehouseId}`);
      continue;
    }
    if (record.quantityOnHand < 0 || record.quantityReserved < 0) {
      issues.push(`Inventory ${record.inventoryId} has negative quantities`);
    }
    if (record.quantityReserved > record.quantityOnHand) {
      issues.push(`Inventory ${record.inventoryId} has quantityReserved (${record.quantityReserved}) > quantityOnHand (${record.quantityOnHand})`);
    }
    if (record.quantityAvailable !== record.quantityOnHand - record.quantityReserved) {
      issues.push(`Inventory ${record.inventoryId} has quantityAvailable inconsistent with on-hand minus reserved`);
    }

    const product = products.find((p) => p.productId === record.productId);
    if (product) {
      const expectedStatus = computeInventoryStatus(
        product.status,
        record.quantityOnHand,
        record.quantityAvailable,
        record.reorderLevel,
      );
      if (expectedStatus !== record.inventoryStatus) {
        issues.push(
          `Inventory ${record.inventoryId} has inventoryStatus "${record.inventoryStatus}" but stock levels imply "${expectedStatus}"`,
        );
      }
    }
  }

  if (issues.length > 0) {
    throw new MasterDataValidationError(issues);
  }
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

async function ensureOutputDir(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
}

async function writeJson(fileName: string, data: unknown): Promise<void> {
  const filePath = resolve(OUTPUT_DIR, fileName);
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

async function writeJsonFiles(data: MasterData): Promise<void> {
  await ensureOutputDir();
  await Promise.all([
    writeJson('cost-centers.json', data.costCenters),
    writeJson('warehouses.json', data.warehouses),
    writeJson('suppliers.json', data.suppliers),
    writeJson('products.json', data.products),
    writeJson('customers.json', data.customers),
    writeJson('inventory.json', data.inventory),
  ]);
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function printReport(data: MasterData): void {
  const { costCenters, warehouses, suppliers, products, customers, inventory } = data;

  const approvedSuppliers = suppliers.filter((s) => s.approvalStatus === 'APPROVED').length;
  const multiSupplierProducts = products.filter((p) => p.supplierIds.length > 1).length;
  const reorderRequiredCount = inventory.filter((i) => i.inventoryStatus === 'REORDER_REQUIRED').length;
  const zeroStockCount = inventory.filter((i) => i.quantityOnHand === 0).length;
  const activeCustomers = customers.filter((c) => c.customerStatus === 'ACTIVE').length;

  console.log('Master data generated successfully.\n');
  console.log(`Output directory: ${relative(PROJECT_ROOT, OUTPUT_DIR)}`);
  console.log('\nCost centers:       ' + costCenters.length);
  console.log('Warehouses:         ' + warehouses.length);
  console.log('Suppliers:          ' + suppliers.length);
  console.log('Products:           ' + products.length);
  console.log('Customers:          ' + customers.length);
  console.log('Inventory records:  ' + inventory.length);
  console.log('\nValidation: PASSED');
  console.log('\nDistribution details:');
  console.log(`  Approved suppliers:            ${approvedSuppliers} / ${suppliers.length}`);
  console.log(`  Products with multiple suppliers: ${multiSupplierProducts} / ${products.length}`);
  console.log(`  Products requiring reorder:     ${reorderRequiredCount} inventory record(s)`);
  console.log(`  Inventory records at zero stock: ${zeroStockCount}`);
  console.log(`  Active customers:               ${activeCustomers} / ${customers.length}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const enterprise = await loadEnterpriseData();

  const costCenters = generateCostCenters(enterprise);
  const warehouses = generateWarehouses(enterprise);
  const suppliersBase = generateSuppliers();
  const products = generateProducts();
  const suppliers = linkProductsToSuppliers(products, suppliersBase);
  const customers = generateCustomers();
  const inventory = generateInventory(products, warehouses);

  const masterData: MasterData = { costCenters, warehouses, suppliers, products, customers, inventory };

  // Validate before writing anything: fail loudly rather than emit
  // inconsistent data.
  validateMasterData(enterprise, masterData);

  await writeJsonFiles(masterData);

  printReport(masterData);
}

main().catch((error: unknown) => {
  console.error('Master data generation FAILED.\n');
  if (error instanceof MasterDataValidationError) {
    console.error(error.message);
  } else if (error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
