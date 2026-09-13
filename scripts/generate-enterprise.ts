/**
 * generate-enterprise.ts
 *
 * Generates the canonical enterprise foundation dataset for the fictional
 * Kenyan company "SVGA Enterprise Ltd".
 *
 * This script is the SOURCE OF TRUTH for enterprise identity. Every later
 * generator (master data, policies, scenarios, test questions) must read
 * the JSON files produced here and reference the same company, locations,
 * departments, roles, employees and systems rather than invent their own.
 *
 * Output:
 *   data/enterprise/company.json
 *   data/enterprise/locations.json
 *   data/enterprise/departments.json
 *   data/enterprise/roles.json
 *   data/enterprise/employees.json
 *   data/enterprise/systems.json
 *
 * Usage:
 *   npx tsx scripts/generate-enterprise.ts
 *   npm run generate:enterprise
 *
 * The dataset is fully hard-coded (no randomness), so running this script
 * repeatedly produces byte-identical output every time.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths (resolved relative to the project root, not the CWD)
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'data', 'enterprise');

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

type ActiveStatus = 'ACTIVE' | 'INACTIVE';
type LocationType = 'HEADQUARTERS' | 'BRANCH' | 'WAREHOUSE';
type RoleLevel = 'EXECUTIVE' | 'MANAGEMENT' | 'OPERATIONAL' | 'EMPLOYEE';
type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
type EmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'PROBATION' | 'TERMINATED';
type SystemCriticality = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type SystemEnvironment = 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
type SystemStatus = 'ACTIVE' | 'INACTIVE' | 'DEPRECATED';

interface Company {
  companyId: string;
  legalName: string;
  tradingName: string;
  industry: string;
  description: string;
  registrationNumber: string;
  kraPin: string;
  country: string;
  headquarters: {
    locationId: string;
    address: string;
  };
  employeeCount: number;
  employeeDatasetNote: string;
  yearEstablished: number;
  website: string;
  contact: {
    email: string;
    phone: string;
    postalAddress: string;
  };
  currency: string;
  timezone: string;
  fiscalYear: {
    startMonth: string;
    endMonth: string;
    label: string;
  };
  status: ActiveStatus;
}

interface Location {
  locationId: string;
  name: string;
  type: LocationType;
  city: string;
  county: string;
  country: string;
  address: string;
  status: ActiveStatus;
}

interface Department {
  departmentId: string;
  name: string;
  description: string;
  departmentHeadRoleId: string;
  costCenterCode: string;
  status: ActiveStatus;
}

interface RoleApprovalAuthority {
  description: string;
  approvalLimitKes: number | null;
}

interface Role {
  roleId: string;
  title: string;
  departmentId: string;
  level: RoleLevel;
  description: string;
  responsibilities: string[];
  approvalAuthority: RoleApprovalAuthority | null;
  systemAccessProfile: string[];
}

interface Employee {
  employeeId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleId: string;
  departmentId: string;
  managerEmployeeId: string | null;
  locationId: string;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  hireDate: string;
  businessProcesses: string[];
}

interface EnterpriseSystem {
  systemId: string;
  name: string;
  vendor: string;
  category: string;
  description: string;
  owningDepartmentId: string;
  criticality: SystemCriticality;
  environment: SystemEnvironment;
  status: SystemStatus;
}

interface EnterpriseData {
  company: Company;
  locations: Location[];
  departments: Department[];
  roles: Role[];
  employees: Employee[];
  systems: EnterpriseSystem[];
}

// Internal seed shape used only to build employees.json. `key` is a stable
// local handle used to wire up manager relationships; it never leaves this
// file.
interface EmployeeSeed {
  key: string;
  firstName: string;
  lastName: string;
  roleId: string;
  departmentId: string;
  managerKey: string | null;
  locationId: string;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  hireDate: string;
  businessProcesses: string[];
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

function generateCompany(): Company {
  return {
    companyId: 'COMP-SVGA',
    legalName: 'SVGA Enterprise Limited',
    tradingName: 'SVGA Enterprise',
    industry: 'FMCG Distribution, Supply Chain & Retail Trade',
    description:
      'SVGA Enterprise Ltd is a Kenyan-owned distribution and supply chain company that sources, ' +
      'warehouses and distributes fast-moving consumer goods (FMCG) and general trade supplies to ' +
      'retailers, wholesalers and institutional customers across Kenya and the wider East African region.',
    registrationNumber: 'PVT-2004-118273',
    kraPin: 'P051234567X',
    country: 'Kenya',
    headquarters: {
      locationId: 'LOC-NRB-HQ',
      address: 'SVGA Plaza, 3rd Floor, Mombasa Road, Nairobi, Kenya',
    },
    employeeCount: 428,
    employeeDatasetNote:
      'employees.json contains a representative sample of 39 employees spanning the full management ' +
      'hierarchy and key business processes. It is a curated subset, not an exhaustive list of all 428 ' +
      'employees at SVGA Enterprise Ltd.',
    yearEstablished: 2004,
    website: 'https://www.svga-enterprise.co.ke',
    contact: {
      email: 'info@svga-enterprise.co.ke',
      phone: '+254-20-2712345',
      postalAddress: 'P.O. Box 45210-00100, Nairobi, Kenya',
    },
    currency: 'KES',
    timezone: 'Africa/Nairobi',
    fiscalYear: {
      startMonth: 'January',
      endMonth: 'December',
      label: 'FY (January - December)',
    },
    status: 'ACTIVE',
  };
}

function generateLocations(): Location[] {
  return [
    {
      locationId: 'LOC-NRB-HQ',
      name: 'SVGA Enterprise Head Office',
      type: 'HEADQUARTERS',
      city: 'Nairobi',
      county: 'Nairobi',
      country: 'Kenya',
      address: 'SVGA Plaza, 3rd Floor, Mombasa Road, Nairobi',
      status: 'ACTIVE',
    },
    {
      locationId: 'LOC-NRB-WH',
      name: 'Nairobi Distribution Warehouse',
      type: 'WAREHOUSE',
      city: 'Nairobi',
      county: 'Nairobi',
      country: 'Kenya',
      address: 'Plot 14, Lunga Lunga Road, Industrial Area, Nairobi',
      status: 'ACTIVE',
    },
    {
      locationId: 'LOC-MSA-01',
      name: 'Mombasa Regional Office',
      type: 'BRANCH',
      city: 'Mombasa',
      county: 'Mombasa',
      country: 'Kenya',
      address: 'Nyerere Avenue, Mombasa',
      status: 'ACTIVE',
    },
    {
      locationId: 'LOC-KSM-01',
      name: 'Kisumu Regional Office',
      type: 'BRANCH',
      city: 'Kisumu',
      county: 'Kisumu',
      country: 'Kenya',
      address: 'Oginga Odinga Street, Kisumu',
      status: 'ACTIVE',
    },
    {
      locationId: 'LOC-NKR-01',
      name: 'Nakuru Regional Office',
      type: 'BRANCH',
      city: 'Nakuru',
      county: 'Nakuru',
      country: 'Kenya',
      address: 'Kenyatta Avenue, Nakuru',
      status: 'ACTIVE',
    },
  ];
}

function generateDepartments(): Department[] {
  return [
    {
      departmentId: 'DEPT-EXEC',
      name: 'Executive Office',
      description: 'Office of the Chief Executive Officer; sets company strategy and holds ultimate accountability.',
      departmentHeadRoleId: 'ROLE-CEO',
      costCenterCode: 'CC-EXEC',
      status: 'ACTIVE',
    },
    {
      departmentId: 'DEPT-FIN',
      name: 'Finance',
      description: 'Manages financial planning, accounting, treasury, payments and statutory reporting.',
      departmentHeadRoleId: 'ROLE-CFO',
      costCenterCode: 'CC-FIN',
      status: 'ACTIVE',
    },
    {
      departmentId: 'DEPT-HR',
      name: 'Human Resources',
      description: 'Manages recruitment, onboarding, employee relations, payroll administration and performance management.',
      departmentHeadRoleId: 'ROLE-HR-MGR',
      costCenterCode: 'CC-HR',
      status: 'ACTIVE',
    },
    {
      departmentId: 'DEPT-PROC',
      name: 'Procurement',
      description: 'Manages supplier sourcing, purchase requisitions, purchase orders and vendor contracts.',
      departmentHeadRoleId: 'ROLE-PROC-MGR',
      costCenterCode: 'CC-PROC',
      status: 'ACTIVE',
    },
    {
      departmentId: 'DEPT-SALES',
      name: 'Sales',
      description: 'Manages customer accounts, sales orders, pricing and revenue generation.',
      departmentHeadRoleId: 'ROLE-SALES-MGR',
      costCenterCode: 'CC-SALES',
      status: 'ACTIVE',
    },
    {
      departmentId: 'DEPT-INV',
      name: 'Inventory',
      description: 'Manages stock levels, stock counts, replenishment planning and inventory accuracy.',
      departmentHeadRoleId: 'ROLE-INV-MGR',
      costCenterCode: 'CC-INV',
      status: 'ACTIVE',
    },
    {
      departmentId: 'DEPT-WH',
      name: 'Warehouse',
      description: 'Manages goods receiving, storage, order picking, packing and dispatch across all sites.',
      departmentHeadRoleId: 'ROLE-WH-MGR',
      costCenterCode: 'CC-WH',
      status: 'ACTIVE',
    },
    {
      departmentId: 'DEPT-IT',
      name: 'Information Technology',
      description: 'Manages enterprise systems, infrastructure, identity and access, and end-user IT support.',
      departmentHeadRoleId: 'ROLE-IT-MGR',
      costCenterCode: 'CC-IT',
      status: 'ACTIVE',
    },
    {
      departmentId: 'DEPT-COMP',
      name: 'Compliance',
      description: 'Manages regulatory compliance, internal policy adherence, audits and risk reviews.',
      departmentHeadRoleId: 'ROLE-COMP-MGR',
      costCenterCode: 'CC-COMP',
      status: 'ACTIVE',
    },
    {
      departmentId: 'DEPT-OPS',
      name: 'Operations',
      description: 'Oversees cross-functional supply chain operations, coordinating Inventory and Warehouse activity.',
      departmentHeadRoleId: 'ROLE-OPS-MGR',
      costCenterCode: 'CC-OPS',
      status: 'ACTIVE',
    },
    {
      departmentId: 'DEPT-LEGAL',
      name: 'Legal',
      description: 'Manages contracts, corporate legal matters, dispute resolution and regulatory filings.',
      departmentHeadRoleId: 'ROLE-LEGAL-MGR',
      costCenterCode: 'CC-LEGAL',
      status: 'ACTIVE',
    },
    {
      departmentId: 'DEPT-CS',
      name: 'Customer Service',
      description: 'Manages customer inquiries, complaints, order support and after-sales service.',
      departmentHeadRoleId: 'ROLE-CS-MGR',
      costCenterCode: 'CC-CS',
      status: 'ACTIVE',
    },
    {
      departmentId: 'DEPT-ADMIN',
      name: 'Administration',
      description: 'Manages facilities, office administration, records and general support services.',
      departmentHeadRoleId: 'ROLE-DEPT-MGR',
      costCenterCode: 'CC-ADMIN',
      status: 'ACTIVE',
    },
  ];
}

function generateRoles(): Role[] {
  return [
    {
      roleId: 'ROLE-CEO',
      title: 'Chief Executive Officer',
      departmentId: 'DEPT-EXEC',
      level: 'EXECUTIVE',
      description: 'Accountable for overall company strategy, performance and governance.',
      responsibilities: [
        'Set and drive company-wide strategy and annual business objectives',
        'Chair executive leadership meetings and oversee department heads',
        'Represent the company to the board, regulators and key stakeholders',
      ],
      approvalAuthority: {
        description: 'Final approver for expenditure, contracts and policy exceptions beyond all other approval limits.',
        approvalLimitKes: null,
      },
      systemAccessProfile: [
        'SYS-D365-FIN: Executive view - financial dashboards and reporting',
        'SYS-D365-SALES: Executive view - sales performance',
        'SYS-D365-SCM: Executive view - supply chain KPIs',
        'SYS-HR: Executive view - workforce reports',
        'SYS-DMS: Full access - corporate records',
      ],
    },
    {
      roleId: 'ROLE-CFO',
      title: 'Chief Financial Officer',
      departmentId: 'DEPT-FIN',
      level: 'EXECUTIVE',
      description: 'Leads the Finance department and is accountable for the company financial strategy and controls.',
      responsibilities: [
        'Own company-wide financial strategy, budgeting and treasury management',
        'Approve high-value financial commitments and capital expenditure',
        'Ensure statutory, tax and regulatory financial compliance',
      ],
      approvalAuthority: {
        description: 'Approves financial commitments, budgets and payments above the Finance Manager threshold.',
        approvalLimitKes: 5_000_000,
      },
      systemAccessProfile: [
        'SYS-D365-FIN: Full access - GL, AP, AR, budgeting, financial reporting',
        'SYS-DMS: Full access - financial contracts and records',
      ],
    },
    {
      roleId: 'ROLE-HR-MGR',
      title: 'HR Manager',
      departmentId: 'DEPT-HR',
      level: 'MANAGEMENT',
      description: 'Leads the Human Resources department and its recruitment, onboarding and employee relations functions.',
      responsibilities: [
        'Oversee recruitment, onboarding and offboarding processes',
        'Manage employee relations, leave administration and performance reviews',
        'Maintain HR policy compliance and payroll data accuracy',
      ],
      approvalAuthority: {
        description: 'Approves recruitment requisitions, leave requests and payroll change requests.',
        approvalLimitKes: 300_000,
      },
      systemAccessProfile: [
        'SYS-HR: Full access - employee records, payroll data, leave, recruitment',
        'SYS-DMS: Read/write - HR policies and employee files',
      ],
    },
    {
      roleId: 'ROLE-HR-OFF',
      title: 'HR Officer',
      departmentId: 'DEPT-HR',
      level: 'OPERATIONAL',
      description: 'Supports day-to-day HR operations including onboarding and employee record maintenance.',
      responsibilities: [
        'Process new-hire onboarding paperwork and system account requests',
        'Maintain employee records and leave balances',
        'Respond to first-line employee HR queries',
      ],
      approvalAuthority: null,
      systemAccessProfile: ['SYS-HR: Create/edit - employee records, leave requests, onboarding tasks'],
    },
    {
      roleId: 'ROLE-FIN-MGR',
      title: 'Finance Manager',
      departmentId: 'DEPT-FIN',
      level: 'MANAGEMENT',
      description: 'Runs day-to-day finance operations reporting to the CFO, including accounting and payments.',
      responsibilities: [
        'Oversee general ledger postings, reconciliations and month-end close',
        'Review and approve routine payments, expense claims and journal entries',
        'Prepare management accounts and financial reports for the CFO',
      ],
      approvalAuthority: {
        description: 'Approves journal entries, expense claims and payments up to the departmental threshold.',
        approvalLimitKes: 1_000_000,
      },
      systemAccessProfile: ['SYS-D365-FIN: Full access - journal entries, payments, reconciliations, reporting'],
    },
    {
      roleId: 'ROLE-FIN-ANALYST',
      title: 'Finance Analyst',
      departmentId: 'DEPT-FIN',
      level: 'OPERATIONAL',
      description: 'Performs transactional accounting, reconciliations and financial reporting support.',
      responsibilities: [
        'Process accounts payable and accounts receivable transactions',
        'Perform bank and supplier account reconciliations',
        'Support budget tracking and variance analysis',
      ],
      approvalAuthority: null,
      systemAccessProfile: ['SYS-D365-FIN: Read/write - transactions, reconciliations, reports'],
    },
    {
      roleId: 'ROLE-PROC-MGR',
      title: 'Procurement Manager',
      departmentId: 'DEPT-PROC',
      level: 'MANAGEMENT',
      description: 'Leads the Procurement department, supplier relationships and purchasing operations.',
      responsibilities: [
        'Oversee supplier sourcing, evaluation and contract negotiation',
        'Approve purchase orders and manage procurement budgets',
        'Ensure procurement policy and compliance adherence',
      ],
      approvalAuthority: {
        description: 'Approves purchase orders and supplier contracts up to the departmental threshold.',
        approvalLimitKes: 2_000_000,
      },
      systemAccessProfile: [
        'SYS-D365-SCM: Full access - procurement module, purchase orders, vendor management',
        'SYS-D365-FIN: Read - budget and spend visibility',
      ],
    },
    {
      roleId: 'ROLE-PROC-OFF',
      title: 'Procurement Officer',
      departmentId: 'DEPT-PROC',
      level: 'OPERATIONAL',
      description: 'Executes day-to-day purchasing activity including requisitions and purchase orders.',
      responsibilities: [
        'Raise purchase requisitions and purchase orders',
        'Follow up on supplier deliveries and order status',
        'Maintain supplier records and pricing data',
      ],
      approvalAuthority: null,
      systemAccessProfile: ['SYS-D365-SCM: Create/edit - purchase requisitions and purchase orders'],
    },
    {
      roleId: 'ROLE-SALES-MGR',
      title: 'Sales Manager',
      departmentId: 'DEPT-SALES',
      level: 'MANAGEMENT',
      description: 'Leads the Sales department, customer accounts and revenue targets.',
      responsibilities: [
        'Set sales targets and manage the sales representative team',
        'Approve customer credit limits and discount terms',
        'Review pipeline, forecasts and account performance',
      ],
      approvalAuthority: {
        description: 'Approves customer credit limits and discounts up to the departmental threshold.',
        approvalLimitKes: 1_000_000,
      },
      systemAccessProfile: ['SYS-D365-SALES: Full access - accounts, opportunities, quotations, sales orders, pricing'],
    },
    {
      roleId: 'ROLE-SALES-REP',
      title: 'Sales Representative',
      departmentId: 'DEPT-SALES',
      level: 'OPERATIONAL',
      description: 'Manages a portfolio of customer accounts and processes sales orders.',
      responsibilities: [
        'Manage assigned customer accounts and relationships',
        'Create quotations and sales orders',
        'Follow up on customer payments and order fulfilment',
      ],
      approvalAuthority: null,
      systemAccessProfile: ['SYS-D365-SALES: Create/edit - own leads, opportunities and sales orders'],
    },
    {
      roleId: 'ROLE-INV-MGR',
      title: 'Inventory Manager',
      departmentId: 'DEPT-INV',
      level: 'MANAGEMENT',
      description: 'Leads the Inventory department, stock accuracy and replenishment planning.',
      responsibilities: [
        'Oversee stock counts, cycle counts and inventory reconciliation',
        'Approve stock adjustments and write-offs',
        'Coordinate replenishment planning with Procurement and Warehouse',
      ],
      approvalAuthority: {
        description: 'Approves stock adjustments and inventory write-offs up to the departmental threshold.',
        approvalLimitKes: 500_000,
      },
      systemAccessProfile: ['SYS-D365-SCM: Full access - inventory management module, stock counts, adjustments'],
    },
    {
      roleId: 'ROLE-WH-MGR',
      title: 'Warehouse Manager',
      departmentId: 'DEPT-WH',
      level: 'MANAGEMENT',
      description: 'Leads warehouse operations across all sites, including receiving and dispatch.',
      responsibilities: [
        'Oversee goods receiving, put-away, picking and dispatch operations',
        'Approve goods receipt discrepancies and dispatch overrides',
        'Manage warehouse staffing and safety standards across sites',
      ],
      approvalAuthority: {
        description: 'Approves goods receipt discrepancies and dispatch overrides up to the departmental threshold.',
        approvalLimitKes: 300_000,
      },
      systemAccessProfile: ['SYS-D365-SCM: Full access - warehouse management module, receiving, put-away, dispatch'],
    },
    {
      roleId: 'ROLE-WH-OFF',
      title: 'Warehouse Officer',
      departmentId: 'DEPT-WH',
      level: 'OPERATIONAL',
      description: 'Performs day-to-day warehouse operations at an assigned site.',
      responsibilities: [
        'Receive, put away and pick stock at the assigned site',
        'Pack and dispatch outbound customer orders',
        'Record stock movements accurately in the warehouse system',
      ],
      approvalAuthority: null,
      systemAccessProfile: ['SYS-D365-SCM: Operate - warehouse transactions, goods receipt, picking, dispatch'],
    },
    {
      roleId: 'ROLE-IT-MGR',
      title: 'IT Manager',
      departmentId: 'DEPT-IT',
      level: 'MANAGEMENT',
      description: 'Leads the IT department, enterprise systems, infrastructure and support services.',
      responsibilities: [
        'Own enterprise systems administration, uptime and security',
        'Approve system access requests and IT procurement',
        'Manage the IT support team and service desk performance',
      ],
      approvalAuthority: {
        description: 'Approves system access requests and IT procurement up to the departmental threshold.',
        approvalLimitKes: 1_000_000,
      },
      systemAccessProfile: [
        'SYS-IAM: Administrator - identity and access provisioning',
        'SYS-SD: Administrator - service desk configuration',
        'SYS-DMS: Administrator - document platform administration',
      ],
    },
    {
      roleId: 'ROLE-IT-SUPPORT',
      title: 'IT Support Officer',
      departmentId: 'DEPT-IT',
      level: 'OPERATIONAL',
      description: 'Provides first- and second-line IT support to employees.',
      responsibilities: [
        'Resolve IT service desk tickets and incidents',
        'Perform password resets and account unlocks',
        'Support onboarding of new employee IT equipment and access',
      ],
      approvalAuthority: null,
      systemAccessProfile: [
        'SYS-SD: Agent - ticket resolution and incident handling',
        'SYS-IAM: Support access - password resets, account unlocks',
      ],
    },
    {
      roleId: 'ROLE-COMP-MGR',
      title: 'Compliance Manager',
      departmentId: 'DEPT-COMP',
      level: 'MANAGEMENT',
      description: 'Leads the Compliance department and regulatory and policy adherence programme.',
      responsibilities: [
        'Oversee regulatory compliance and internal policy adherence',
        'Approve compliance exceptions and policy waivers',
        'Coordinate internal audits and risk reviews',
      ],
      approvalAuthority: {
        description: 'Approves compliance exceptions and policy waivers up to the departmental threshold.',
        approvalLimitKes: 500_000,
      },
      systemAccessProfile: ['SYS-DMS: Full access - policy and compliance records', 'SYS-IAM: Read - access and audit logs'],
    },
    {
      roleId: 'ROLE-COMP-OFF',
      title: 'Compliance Officer',
      departmentId: 'DEPT-COMP',
      level: 'OPERATIONAL',
      description: 'Performs compliance reviews, audits and documentation of findings.',
      responsibilities: [
        'Conduct compliance reviews and control testing',
        'Document audit findings and track remediation actions',
        'Support regulatory reporting requirements',
      ],
      approvalAuthority: null,
      systemAccessProfile: ['SYS-DMS: Read/write - compliance reviews and audit documentation'],
    },
    {
      roleId: 'ROLE-OPS-MGR',
      title: 'Operations Manager',
      departmentId: 'DEPT-OPS',
      level: 'MANAGEMENT',
      description: 'Leads the Operations department, coordinating Inventory and Warehouse functions.',
      responsibilities: [
        'Coordinate cross-functional supply chain operations',
        'Oversee the Inventory Manager and Warehouse Manager',
        'Approve operational exceptions spanning inventory and warehouse activity',
      ],
      approvalAuthority: {
        description: 'Approves cross-functional operational exceptions up to the departmental threshold.',
        approvalLimitKes: 2_000_000,
      },
      systemAccessProfile: [
        'SYS-D365-SCM: Oversight access - inventory and warehouse operations',
        'SYS-D365-FIN: Read - operational cost reporting',
      ],
    },
    {
      roleId: 'ROLE-LEGAL-MGR',
      title: 'Legal Manager',
      departmentId: 'DEPT-LEGAL',
      level: 'MANAGEMENT',
      description: 'Leads the Legal department, contracts and corporate legal matters.',
      responsibilities: [
        'Review and approve contracts and legal agreements',
        'Advise the business on regulatory and legal risk',
        'Manage dispute resolution and external legal counsel',
      ],
      approvalAuthority: {
        description: 'Approves contracts and legal agreements up to the departmental threshold.',
        approvalLimitKes: 3_000_000,
      },
      systemAccessProfile: ['SYS-DMS: Full access - contracts, legal agreements and corporate records'],
    },
    {
      roleId: 'ROLE-CS-MGR',
      title: 'Customer Service Manager',
      departmentId: 'DEPT-CS',
      level: 'MANAGEMENT',
      description: 'Leads the Customer Service department and after-sales support quality.',
      responsibilities: [
        'Oversee handling of customer inquiries and complaints',
        'Approve customer refunds and goodwill credits',
        'Monitor customer satisfaction and service response times',
      ],
      approvalAuthority: {
        description: 'Approves customer refunds and goodwill credits up to the departmental threshold.',
        approvalLimitKes: 100_000,
      },
      systemAccessProfile: [
        'SYS-D365-SALES: Read/write - customer service cases and accounts',
        'SYS-SD: Read - related IT service tickets',
      ],
    },
    {
      roleId: 'ROLE-DEPT-MGR',
      title: 'Department Manager',
      departmentId: 'DEPT-ADMIN',
      level: 'MANAGEMENT',
      description: 'Generic department-head role used for the Administration department, covering facilities and general support services.',
      responsibilities: [
        'Manage office administration, facilities and records',
        'Approve routine administrative expenditure',
        'Supervise general support staff',
      ],
      approvalAuthority: {
        description: 'Approves routine administrative expenditure up to the departmental threshold.',
        approvalLimitKes: 200_000,
      },
      systemAccessProfile: ['SYS-DMS: Read/write - administrative records and facilities documentation'],
    },
    {
      roleId: 'ROLE-EMPLOYEE',
      title: 'Employee',
      departmentId: 'DEPT-ADMIN',
      level: 'EMPLOYEE',
      description: 'Generic base role used for general staff across departments who do not hold a specialist title.',
      responsibilities: [
        'Perform assigned departmental duties',
        'Follow company policies and procedures',
        'Raise IT, HR or facilities requests through the appropriate system',
      ],
      approvalAuthority: null,
      systemAccessProfile: [
        'SYS-SD: Self-service - raise and track IT support tickets',
        'SYS-HR: Self-service - payslips, leave applications, personal records',
      ],
    },
  ];
}

function generateSystems(): EnterpriseSystem[] {
  return [
    {
      systemId: 'SYS-D365-FIN',
      name: 'Microsoft Dynamics 365 Finance',
      vendor: 'Microsoft',
      category: 'ERP - Finance',
      description:
        'Core financial management system used for general ledger, accounts payable, accounts receivable, ' +
        'budgeting, fixed assets and financial reporting.',
      owningDepartmentId: 'DEPT-FIN',
      criticality: 'CRITICAL',
      environment: 'PRODUCTION',
      status: 'ACTIVE',
    },
    {
      systemId: 'SYS-D365-SALES',
      name: 'Microsoft Dynamics 365 Sales',
      vendor: 'Microsoft',
      category: 'CRM - Sales',
      description:
        'Customer relationship management platform used to manage leads, opportunities, customer accounts, ' +
        'quotations and sales orders.',
      owningDepartmentId: 'DEPT-SALES',
      criticality: 'HIGH',
      environment: 'PRODUCTION',
      status: 'ACTIVE',
    },
    {
      systemId: 'SYS-D365-SCM',
      name: 'Microsoft Dynamics 365 Supply Chain Management',
      vendor: 'Microsoft',
      category: 'ERP - Supply Chain',
      description:
        'Supply chain platform covering procurement, inventory management, warehouse operations, demand ' +
        'planning and logistics.',
      owningDepartmentId: 'DEPT-OPS',
      criticality: 'CRITICAL',
      environment: 'PRODUCTION',
      status: 'ACTIVE',
    },
    {
      systemId: 'SYS-HR',
      name: 'Employee Management System',
      vendor: 'SVGA Enterprise IT (hosted HRIS)',
      category: 'Human Resources Information System',
      description:
        'Human resource information system used for employee records, leave management, payroll data, ' +
        'performance management and onboarding workflows.',
      owningDepartmentId: 'DEPT-HR',
      criticality: 'HIGH',
      environment: 'PRODUCTION',
      status: 'ACTIVE',
    },
    {
      systemId: 'SYS-IAM',
      name: 'Identity and Access Management System',
      vendor: 'Microsoft Entra ID',
      category: 'Security - Identity & Access Management',
      description:
        'Centralized identity provider used for user authentication, single sign-on, multi-factor ' +
        'authentication and access provisioning across enterprise systems.',
      owningDepartmentId: 'DEPT-IT',
      criticality: 'CRITICAL',
      environment: 'PRODUCTION',
      status: 'ACTIVE',
    },
    {
      systemId: 'SYS-SD',
      name: 'IT Service Desk',
      vendor: 'Freshworks (Freshservice)',
      category: 'IT Service Management',
      description:
        'IT service management platform used to log, track and resolve employee IT support tickets, ' +
        'incidents and service requests.',
      owningDepartmentId: 'DEPT-IT',
      criticality: 'MEDIUM',
      environment: 'PRODUCTION',
      status: 'ACTIVE',
    },
    {
      systemId: 'SYS-DMS',
      name: 'Enterprise Document Management System',
      vendor: 'Microsoft SharePoint (Microsoft 365)',
      category: 'Document & Records Management',
      description:
        'Central repository for corporate policies, contracts, compliance records and departmental ' +
        'documentation with version control and access permissions.',
      owningDepartmentId: 'DEPT-IT',
      criticality: 'MEDIUM',
      environment: 'PRODUCTION',
      status: 'ACTIVE',
    },
  ];
}

/**
 * Employee seed data, ordered top-down by the management hierarchy. `key`
 * values are local handles resolved into stable EMP-XXXX ids and manager
 * references by `generateEmployees`.
 */
function getEmployeeSeeds(): EmployeeSeed[] {
  return [
    // --- Level 1: Executive ---
    {
      key: 'CEO',
      firstName: 'Samuel',
      lastName: 'Kariuki',
      roleId: 'ROLE-CEO',
      departmentId: 'DEPT-EXEC',
      managerKey: null,
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2004-01-05',
      businessProcesses: ['finance_approvals', 'compliance'],
    },

    // --- Level 2: Department heads reporting to the CEO ---
    {
      key: 'CFO',
      firstName: 'Grace',
      lastName: 'Njeri Mwangi',
      roleId: 'ROLE-CFO',
      departmentId: 'DEPT-FIN',
      managerKey: 'CEO',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2005-03-14',
      businessProcesses: ['finance_approvals'],
    },
    {
      key: 'HR_MGR',
      firstName: 'Peter',
      lastName: 'Otieno Ochieng',
      roleId: 'ROLE-HR-MGR',
      departmentId: 'DEPT-HR',
      managerKey: 'CEO',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2006-06-01',
      businessProcesses: ['onboarding'],
    },
    {
      key: 'PROC_MGR',
      firstName: 'Esther',
      lastName: 'Wanjiku Kamau',
      roleId: 'ROLE-PROC-MGR',
      departmentId: 'DEPT-PROC',
      managerKey: 'CEO',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2007-02-19',
      businessProcesses: ['procurement'],
    },
    {
      key: 'SALES_MGR',
      firstName: 'Brian',
      lastName: 'Wafula Simiyu',
      roleId: 'ROLE-SALES-MGR',
      departmentId: 'DEPT-SALES',
      managerKey: 'CEO',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2008-04-11',
      businessProcesses: ['sales'],
    },
    {
      key: 'OPS_MGR',
      firstName: 'Catherine',
      lastName: 'Achieng Odongo',
      roleId: 'ROLE-OPS-MGR',
      departmentId: 'DEPT-OPS',
      managerKey: 'CEO',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2007-09-03',
      businessProcesses: ['warehouse_operations'],
    },
    {
      key: 'IT_MGR',
      firstName: 'David',
      lastName: 'Kiplagat Rotich',
      roleId: 'ROLE-IT-MGR',
      departmentId: 'DEPT-IT',
      managerKey: 'CEO',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2009-01-20',
      businessProcesses: ['it_support'],
    },
    {
      key: 'COMP_MGR',
      firstName: 'Lucy',
      lastName: 'Chebet Kiprono',
      roleId: 'ROLE-COMP-MGR',
      departmentId: 'DEPT-COMP',
      managerKey: 'CEO',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2010-05-17',
      businessProcesses: ['compliance'],
    },
    {
      key: 'LEGAL_MGR',
      firstName: 'Anthony',
      lastName: 'Njoroge Kariithi',
      roleId: 'ROLE-LEGAL-MGR',
      departmentId: 'DEPT-LEGAL',
      managerKey: 'CEO',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2011-08-08',
      businessProcesses: ['legal'],
    },
    {
      key: 'CS_MGR',
      firstName: 'Mercy',
      lastName: 'Nekesa Wanyama',
      roleId: 'ROLE-CS-MGR',
      departmentId: 'DEPT-CS',
      managerKey: 'CEO',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2012-03-26',
      businessProcesses: ['customer_service'],
    },
    {
      key: 'ADMIN_MGR',
      firstName: 'Joseph',
      lastName: 'Mutiso Kyalo',
      roleId: 'ROLE-DEPT-MGR',
      departmentId: 'DEPT-ADMIN',
      managerKey: 'CEO',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2008-11-14',
      businessProcesses: ['administration'],
    },

    // --- Level 3 ---
    {
      key: 'FIN_MGR',
      firstName: 'Faith',
      lastName: 'Wambui Gitau',
      roleId: 'ROLE-FIN-MGR',
      departmentId: 'DEPT-FIN',
      managerKey: 'CFO',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2009-06-09',
      businessProcesses: ['finance_approvals'],
    },
    {
      key: 'HR_OFF_1',
      firstName: 'Kevin',
      lastName: 'Barasa Wekesa',
      roleId: 'ROLE-HR-OFF',
      departmentId: 'DEPT-HR',
      managerKey: 'HR_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2015-02-02',
      businessProcesses: ['onboarding'],
    },
    {
      key: 'HR_OFF_2',
      firstName: 'Diana',
      lastName: 'Auma Owino',
      roleId: 'ROLE-HR-OFF',
      departmentId: 'DEPT-HR',
      managerKey: 'HR_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2017-07-19',
      businessProcesses: ['onboarding'],
    },
    {
      key: 'PROC_OFF_1',
      firstName: 'Martin',
      lastName: 'Njue Kariuki',
      roleId: 'ROLE-PROC-OFF',
      departmentId: 'DEPT-PROC',
      managerKey: 'PROC_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2013-09-23',
      businessProcesses: ['procurement'],
    },
    {
      key: 'PROC_OFF_2',
      firstName: 'Susan',
      lastName: 'Chepkoech Bett',
      roleId: 'ROLE-PROC-OFF',
      departmentId: 'DEPT-PROC',
      managerKey: 'PROC_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2016-04-05',
      businessProcesses: ['procurement'],
    },
    {
      key: 'SALES_REP_1',
      firstName: 'Dennis',
      lastName: 'Omondi Owuor',
      roleId: 'ROLE-SALES-REP',
      departmentId: 'DEPT-SALES',
      managerKey: 'SALES_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2014-01-13',
      businessProcesses: ['sales'],
    },
    {
      key: 'SALES_REP_2',
      firstName: 'Sharon',
      lastName: 'Atieno Onyango',
      roleId: 'ROLE-SALES-REP',
      departmentId: 'DEPT-SALES',
      managerKey: 'SALES_MGR',
      locationId: 'LOC-MSA-01',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2016-10-17',
      businessProcesses: ['sales'],
    },
    {
      key: 'SALES_REP_3',
      firstName: 'Collins',
      lastName: 'Wekesa Masinde',
      roleId: 'ROLE-SALES-REP',
      departmentId: 'DEPT-SALES',
      managerKey: 'SALES_MGR',
      locationId: 'LOC-KSM-01',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2018-03-21',
      businessProcesses: ['sales'],
    },
    {
      key: 'SALES_REP_4',
      firstName: 'Purity',
      lastName: 'Jepkorir Rono',
      roleId: 'ROLE-SALES-REP',
      departmentId: 'DEPT-SALES',
      managerKey: 'SALES_MGR',
      locationId: 'LOC-NKR-01',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2019-11-04',
      businessProcesses: ['sales'],
    },
    {
      key: 'INV_MGR',
      firstName: 'Michael',
      lastName: 'Odhiambo Owino',
      roleId: 'ROLE-INV-MGR',
      departmentId: 'DEPT-INV',
      managerKey: 'OPS_MGR',
      locationId: 'LOC-NRB-WH',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2010-02-15',
      businessProcesses: ['warehouse_operations'],
    },
    {
      key: 'WH_MGR',
      firstName: 'Nancy',
      lastName: 'Wairimu Ndungu',
      roleId: 'ROLE-WH-MGR',
      departmentId: 'DEPT-WH',
      managerKey: 'OPS_MGR',
      locationId: 'LOC-NRB-WH',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2011-06-28',
      businessProcesses: ['warehouse_operations'],
    },
    {
      key: 'IT_SUP_1',
      firstName: 'Felix',
      lastName: 'Kiptoo Langat',
      roleId: 'ROLE-IT-SUPPORT',
      departmentId: 'DEPT-IT',
      managerKey: 'IT_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2017-01-09',
      businessProcesses: ['it_support'],
    },
    {
      key: 'IT_SUP_2',
      firstName: 'Winnie',
      lastName: 'Adhiambo Ouma',
      roleId: 'ROLE-IT-SUPPORT',
      departmentId: 'DEPT-IT',
      managerKey: 'IT_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2019-05-27',
      businessProcesses: ['it_support'],
    },
    {
      key: 'COMP_OFF_1',
      firstName: 'Stephen',
      lastName: 'Mwangi Ndirangu',
      roleId: 'ROLE-COMP-OFF',
      departmentId: 'DEPT-COMP',
      managerKey: 'COMP_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2014-08-18',
      businessProcesses: ['compliance'],
    },
    {
      key: 'COMP_OFF_2',
      firstName: 'Rael',
      lastName: 'Chepchirchir Kigen',
      roleId: 'ROLE-COMP-OFF',
      departmentId: 'DEPT-COMP',
      managerKey: 'COMP_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2018-09-10',
      businessProcesses: ['compliance'],
    },
    {
      key: 'LEGAL_ASST',
      firstName: 'Brenda',
      lastName: 'Nyokabi Maina',
      roleId: 'ROLE-EMPLOYEE',
      departmentId: 'DEPT-LEGAL',
      managerKey: 'LEGAL_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2019-02-25',
      businessProcesses: ['legal'],
    },
    {
      key: 'CS_REP_1',
      firstName: 'George',
      lastName: 'Otieno Oduor',
      roleId: 'ROLE-EMPLOYEE',
      departmentId: 'DEPT-CS',
      managerKey: 'CS_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2018-06-12',
      businessProcesses: ['customer_service'],
    },
    {
      key: 'CS_REP_2',
      firstName: 'Agnes',
      lastName: 'Wanjiru Thuo',
      roleId: 'ROLE-EMPLOYEE',
      departmentId: 'DEPT-CS',
      managerKey: 'CS_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'PART_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2020-10-05',
      businessProcesses: ['customer_service'],
    },
    {
      key: 'ADMIN_ASST_1',
      firstName: 'Vincent',
      lastName: 'Kiprop Sang',
      roleId: 'ROLE-EMPLOYEE',
      departmentId: 'DEPT-ADMIN',
      managerKey: 'ADMIN_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2015-04-20',
      businessProcesses: ['administration'],
    },
    {
      key: 'ADMIN_ASST_2',
      firstName: 'Josephine',
      lastName: 'Achieng Otieno',
      roleId: 'ROLE-EMPLOYEE',
      departmentId: 'DEPT-ADMIN',
      managerKey: 'ADMIN_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2021-01-11',
      businessProcesses: ['administration'],
    },

    // --- Level 4 ---
    {
      key: 'FIN_AN_1',
      firstName: 'Timothy',
      lastName: 'Mwendwa Musyoka',
      roleId: 'ROLE-FIN-ANALYST',
      departmentId: 'DEPT-FIN',
      managerKey: 'FIN_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2016-09-14',
      businessProcesses: ['finance_approvals'],
    },
    {
      key: 'FIN_AN_2',
      firstName: 'Caroline',
      lastName: 'Nasimiyu Wafula',
      roleId: 'ROLE-FIN-ANALYST',
      departmentId: 'DEPT-FIN',
      managerKey: 'FIN_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2018-11-02',
      businessProcesses: ['finance_approvals'],
    },
    {
      key: 'FIN_AN_3',
      firstName: 'Hassan',
      lastName: 'Abdi Noor',
      roleId: 'ROLE-FIN-ANALYST',
      departmentId: 'DEPT-FIN',
      managerKey: 'FIN_MGR',
      locationId: 'LOC-NRB-HQ',
      employmentType: 'CONTRACT',
      employmentStatus: 'ACTIVE',
      hireDate: '2022-02-07',
      businessProcesses: ['finance_approvals'],
    },
    {
      key: 'WH_OFF_1',
      firstName: 'Paul',
      lastName: 'Kimutai Bett',
      roleId: 'ROLE-WH-OFF',
      departmentId: 'DEPT-WH',
      managerKey: 'WH_MGR',
      locationId: 'LOC-NRB-WH',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2015-07-30',
      businessProcesses: ['warehouse_operations'],
    },
    {
      key: 'WH_OFF_2',
      firstName: 'Mary',
      lastName: 'Akinyi Ochola',
      roleId: 'ROLE-WH-OFF',
      departmentId: 'DEPT-WH',
      managerKey: 'WH_MGR',
      locationId: 'LOC-MSA-01',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2017-03-16',
      businessProcesses: ['warehouse_operations'],
    },
    {
      key: 'WH_OFF_3',
      firstName: 'Erick',
      lastName: 'Kiprotich Maiyo',
      roleId: 'ROLE-WH-OFF',
      departmentId: 'DEPT-WH',
      managerKey: 'WH_MGR',
      locationId: 'LOC-KSM-01',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2019-08-22',
      businessProcesses: ['warehouse_operations'],
    },
    {
      key: 'INV_OFF_1',
      firstName: 'Beatrice',
      lastName: 'Wangari Kamau',
      roleId: 'ROLE-EMPLOYEE',
      departmentId: 'DEPT-INV',
      managerKey: 'INV_MGR',
      locationId: 'LOC-NRB-WH',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      hireDate: '2016-12-05',
      businessProcesses: ['warehouse_operations'],
    },
    {
      key: 'INV_OFF_2',
      firstName: 'Robert',
      lastName: 'Otieno Ochola',
      roleId: 'ROLE-EMPLOYEE',
      departmentId: 'DEPT-INV',
      managerKey: 'INV_MGR',
      locationId: 'LOC-NRB-WH',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ON_LEAVE',
      hireDate: '2020-06-29',
      businessProcesses: ['warehouse_operations'],
    },
  ];
}

function generateEmployees(): Employee[] {
  const seeds = getEmployeeSeeds();

  const idByKey = new Map<string, string>();
  seeds.forEach((seed, index) => {
    idByKey.set(seed.key, `EMP-${String(index + 1).padStart(4, '0')}`);
  });

  return seeds.map((seed, index) => {
    const employeeId = idByKey.get(seed.key);
    if (!employeeId) {
      throw new Error(`Internal error: no id assigned for employee seed key "${seed.key}"`);
    }

    const managerEmployeeId = seed.managerKey ? (idByKey.get(seed.managerKey) ?? null) : null;
    const emailLocal = `${seed.firstName}.${seed.lastName}`.toLowerCase().replace(/[^a-z.]/g, '');

    return {
      employeeId,
      employeeNumber: `SVGA-PN-${String(index + 1).padStart(4, '0')}`,
      firstName: seed.firstName,
      lastName: seed.lastName,
      email: `${emailLocal}@svga-enterprise.co.ke`,
      phone: `+254-700-000-${String(index + 1).padStart(3, '0')}`,
      roleId: seed.roleId,
      departmentId: seed.departmentId,
      managerEmployeeId,
      locationId: seed.locationId,
      employmentType: seed.employmentType,
      employmentStatus: seed.employmentStatus,
      hireDate: seed.hireDate,
      businessProcesses: seed.businessProcesses,
    };
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

class EnterpriseValidationError extends Error {
  constructor(issues: string[]) {
    super(`Enterprise data validation failed with ${issues.length} issue(s):\n- ${issues.join('\n- ')}`);
    this.name = 'EnterpriseValidationError';
  }
}

function findDuplicateIds(ids: string[]): string[] {
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

/**
 * Walks each employee's manager chain looking for cycles. Returns the ids
 * of every employee that participates in a cycle (empty if none exist).
 */
function findManagementCycles(employees: Employee[]): string[] {
  const managerById = new Map<string, string | null>(employees.map((e) => [e.employeeId, e.managerEmployeeId]));
  const cyclic = new Set<string>();

  for (const employee of employees) {
    const visited: string[] = [];
    let currentId: string | null = employee.employeeId;

    while (currentId !== null) {
      if (visited.includes(currentId)) {
        visited.forEach((id) => cyclic.add(id));
        break;
      }
      visited.push(currentId);

      if (!managerById.has(currentId)) {
        // Dangling manager reference; reported separately by the
        // "manager references are valid" check.
        break;
      }
      currentId = managerById.get(currentId) ?? null;
    }
  }

  return Array.from(cyclic);
}

function validateEnterpriseData(data: EnterpriseData): void {
  const { company, locations, departments, roles, employees, systems } = data;
  const issues: string[] = [];

  // 1. Company exists.
  if (!company || !company.companyId) {
    issues.push('Company record is missing or missing a companyId.');
  }

  // 2-6. Uniqueness of IDs within each collection.
  const departmentDupes = findDuplicateIds(departments.map((d) => d.departmentId));
  if (departmentDupes.length > 0) {
    issues.push(`Duplicate department IDs found: ${departmentDupes.join(', ')}`);
  }

  const roleDupes = findDuplicateIds(roles.map((r) => r.roleId));
  if (roleDupes.length > 0) {
    issues.push(`Duplicate role IDs found: ${roleDupes.join(', ')}`);
  }

  const employeeDupes = findDuplicateIds(employees.map((e) => e.employeeId));
  if (employeeDupes.length > 0) {
    issues.push(`Duplicate employee IDs found: ${employeeDupes.join(', ')}`);
  }

  const locationDupes = findDuplicateIds(locations.map((l) => l.locationId));
  if (locationDupes.length > 0) {
    issues.push(`Duplicate location IDs found: ${locationDupes.join(', ')}`);
  }

  const systemDupes = findDuplicateIds(systems.map((s) => s.systemId));
  if (systemDupes.length > 0) {
    issues.push(`Duplicate system IDs found: ${systemDupes.join(', ')}`);
  }

  const departmentIds = new Set(departments.map((d) => d.departmentId));
  const roleIds = new Set(roles.map((r) => r.roleId));
  const employeeIds = new Set(employees.map((e) => e.employeeId));
  const locationIds = new Set(locations.map((l) => l.locationId));

  // 7. Role department references are valid.
  for (const role of roles) {
    if (!departmentIds.has(role.departmentId)) {
      issues.push(`Role ${role.roleId} references unknown department ${role.departmentId}`);
    }
  }

  // Department head role references are valid (supports #7 by ensuring the
  // reverse link is also sound).
  for (const department of departments) {
    if (!roleIds.has(department.departmentHeadRoleId)) {
      issues.push(`Department ${department.departmentId} references unknown head role ${department.departmentHeadRoleId}`);
    }
  }

  // 8. Employee role references are valid.
  // 9. Employee department references are valid.
  // 10. Employee location references are valid.
  for (const employee of employees) {
    if (!roleIds.has(employee.roleId)) {
      issues.push(`Employee ${employee.employeeId} references unknown role ${employee.roleId}`);
    }
    if (!departmentIds.has(employee.departmentId)) {
      issues.push(`Employee ${employee.employeeId} references unknown department ${employee.departmentId}`);
    }
    if (!locationIds.has(employee.locationId)) {
      issues.push(`Employee ${employee.employeeId} references unknown location ${employee.locationId}`);
    }
  }

  // 11. Manager references are valid unless the employee is the CEO (no manager).
  for (const employee of employees) {
    if (employee.managerEmployeeId !== null && !employeeIds.has(employee.managerEmployeeId)) {
      issues.push(`Employee ${employee.employeeId} references unknown manager ${employee.managerEmployeeId}`);
    }
  }

  // 12. No employee manages themselves.
  for (const employee of employees) {
    if (employee.managerEmployeeId === employee.employeeId) {
      issues.push(`Employee ${employee.employeeId} lists themselves as their own manager`);
    }
  }

  // 13. No circular management hierarchy.
  const cyclicEmployees = findManagementCycles(employees);
  if (cyclicEmployees.length > 0) {
    issues.push(`Circular management hierarchy detected involving: ${cyclicEmployees.join(', ')}`);
  }

  // The org chart must have exactly one top-of-hierarchy employee (the CEO).
  const roots = employees.filter((e) => e.managerEmployeeId === null);
  if (roots.length === 0) {
    issues.push('No root employee found: at least one employee (the CEO) must have no manager.');
  } else if (roots.length > 1) {
    issues.push(`Multiple root employees found without a manager: ${roots.map((r) => r.employeeId).join(', ')}`);
  }

  // 14. System ownership references are valid.
  for (const system of systems) {
    if (!departmentIds.has(system.owningDepartmentId)) {
      issues.push(`System ${system.systemId} references unknown owning department ${system.owningDepartmentId}`);
    }
  }

  if (issues.length > 0) {
    throw new EnterpriseValidationError(issues);
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const company = generateCompany();
  const locations = generateLocations();
  const departments = generateDepartments();
  const roles = generateRoles();
  const employees = generateEmployees();
  const systems = generateSystems();

  const enterpriseData: EnterpriseData = { company, locations, departments, roles, employees, systems };

  // Validate before writing anything: fail loudly rather than emit
  // inconsistent data.
  validateEnterpriseData(enterpriseData);

  await ensureOutputDir();

  await Promise.all([
    writeJson('company.json', company),
    writeJson('locations.json', locations),
    writeJson('departments.json', departments),
    writeJson('roles.json', roles),
    writeJson('employees.json', employees),
    writeJson('systems.json', systems),
  ]);

  console.log('Enterprise foundation generated successfully.\n');
  console.log(`Output directory: ${relative(PROJECT_ROOT, OUTPUT_DIR)}`);
  console.log('Files created:');
  console.log('  - company.json');
  console.log('  - locations.json');
  console.log('  - departments.json');
  console.log('  - roles.json');
  console.log('  - employees.json');
  console.log('  - systems.json');
  console.log('\nRecord counts:');
  console.log(`  Departments: ${departments.length}`);
  console.log(`  Roles:       ${roles.length}`);
  console.log(`  Employees:   ${employees.length}`);
  console.log(`  Locations:   ${locations.length}`);
  console.log(`  Systems:     ${systems.length}`);
  console.log('\nValidation: PASSED (all referential integrity checks succeeded)');
}

main().catch((error: unknown) => {
  console.error('Enterprise data generation FAILED.\n');
  if (error instanceof EnterpriseValidationError) {
    console.error(error.message);
  } else if (error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
