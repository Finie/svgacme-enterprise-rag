/** Script 6: deterministic evaluation questions grounded in the canonical corpus. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const ENTERPRISE = resolve(ROOT, 'data', 'enterprise');
const MASTER = resolve(ROOT, 'data', 'master-data');
const POLICIES = resolve(ROOT, 'data', 'policies');
const SCENARIOS = resolve(ROOT, 'data', 'scenarios');
const OUTPUT = resolve(ROOT, 'data', 'test-questions');
const VERSION = '1.0.0';

type Row = Record<string, any>;
type Category =
  | 'factual'
  | 'policy'
  | 'entity'
  | 'reasoning'
  | 'cross-domain'
  | 'negative'
  | 'abstention';
type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
type Behavior = 'answer' | 'abstain' | 'reject' | 'escalate';
interface Source {
  type: string;
  id: string;
  section?: string;
}
interface Question {
  id: string;
  question: string;
  category: Category;
  subcategory: string;
  difficulty: Difficulty;
  answerability: 'answerable' | 'unanswerable';
  expectedAnswer: string;
  acceptableAnswerPoints: string[];
  requiredSources: Source[];
  entities: string[];
  systems: string[];
  policies: string[];
  scenarios: string[];
  reasoningSteps: string[];
  expectedBehavior: Behavior;
  tags: string[];
}

const json = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8')) as T;
const byId = <T extends Row>(items: T[], key: string): Map<string, T> =>
  new Map(items.map((item) => [String(item[key]), item]));
const sorted = (values: string[]): string[] => [...new Set(values)].sort();
const money = (value: number): string => `KES ${value.toLocaleString('en-KE')}`;
const fullName = (employee: Row): string =>
  `${employee.firstName} ${employee.lastName}`;

async function loadCorpus() {
  const [
    company,
    departments,
    employees,
    roles,
    locations,
    systems,
    suppliers,
    customers,
    products,
    warehouses,
    inventory,
    costCenters,
  ] = await Promise.all([
    json<Row>(resolve(ENTERPRISE, 'company.json')),
    json<Row[]>(resolve(ENTERPRISE, 'departments.json')),
    json<Row[]>(resolve(ENTERPRISE, 'employees.json')),
    json<Row[]>(resolve(ENTERPRISE, 'roles.json')),
    json<Row[]>(resolve(ENTERPRISE, 'locations.json')),
    json<Row[]>(resolve(ENTERPRISE, 'systems.json')),
    json<Row[]>(resolve(MASTER, 'suppliers.json')),
    json<Row[]>(resolve(MASTER, 'customers.json')),
    json<Row[]>(resolve(MASTER, 'products.json')),
    json<Row[]>(resolve(MASTER, 'warehouses.json')),
    json<Row[]>(resolve(MASTER, 'inventory.json')),
    json<Row[]>(resolve(MASTER, 'cost-centers.json')),
  ]);
  const policyFiles = (await readdir(POLICIES))
    .filter((file) => file.endsWith('.md'))
    .sort();
  if (policyFiles.length !== 15)
    throw new Error(`Expected 15 policies, found ${policyFiles.length}`);
  const policies = new Map<string, string>();
  for (const file of policyFiles)
    policies.set(
      file.slice(0, -3),
      await readFile(resolve(POLICIES, file), 'utf8'),
    );
  const scenarioFiles: string[] = [];
  const walk = async (directory: string): Promise<void> => {
    for (const entry of (
      await readdir(directory, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.json') && entry.name !== 'index.json')
        scenarioFiles.push(path);
    }
  };
  await walk(SCENARIOS);
  const scenarios = await Promise.all(
    scenarioFiles.map((path) => json<Row>(path)),
  );
  if (scenarios.length !== 65)
    throw new Error(`Expected 65 scenarios, found ${scenarios.length}`);
  return {
    company,
    departments,
    employees,
    roles,
    locations,
    systems,
    suppliers,
    customers,
    products,
    warehouses,
    inventory,
    costCenters,
    policies,
    scenarios,
    employeeById: byId(employees, 'employeeId'),
    departmentById: byId(departments, 'departmentId'),
    roleById: byId(roles, 'roleId'),
    locationById: byId(locations, 'locationId'),
    systemById: byId(systems, 'systemId'),
    supplierById: byId(suppliers, 'supplierId'),
    customerById: byId(customers, 'customerId'),
    productById: byId(products, 'productId'),
    warehouseById: byId(warehouses, 'warehouseId'),
    inventoryById: byId(inventory, 'inventoryId'),
    costCenterById: byId(costCenters, 'costCenterId'),
    scenarioById: byId(scenarios, 'id'),
  };
}

function main() {
  return loadCorpus().then(async (data) => {
    const questions: Question[] = [];
    const add = (q: Omit<Question, 'id'> & { prefix: string }) => {
      const id = `${q.prefix}${String(questions.filter((item) => item.id.startsWith(q.prefix)).length + 1).padStart(3, '0')}`;
      questions.push({ ...q, id });
    };
    const source = (type: string, id: string, section?: string): Source =>
      section ? { type, id, section } : { type, id };
    const base = (
      category: Category,
      subcategory: string,
      difficulty: Difficulty,
      expectedAnswer: string,
      sources: Source[],
      options: Partial<Question> = {},
    ) => ({
      category,
      subcategory,
      difficulty,
      answerability: options.answerability ?? 'answerable',
      expectedAnswer,
      acceptableAnswerPoints: options.acceptableAnswerPoints ?? [],
      requiredSources: options.requiredSources ?? sources,
      entities: options.entities ?? [],
      systems: options.systems ?? [],
      policies:
        options.policies ??
        sources.filter((item) => item.type === 'policy').map((item) => item.id),
      scenarios: options.scenarios ?? [],
      reasoningSteps: options.reasoningSteps ?? [],
      expectedBehavior: options.expectedBehavior ?? 'answer',
      tags: options.tags ?? [],
    });
    const product = data.products[0];
    const customer = data.customers[0];

    add({
      prefix: 'Q-FACT-',
      question: "What is SVGA Enterprise's legal name?",
      ...base(
        'factual',
        'company',
        'easy',
        data.company.legalName,
        [source('company', data.company.companyId)],
        {
          acceptableAnswerPoints: [data.company.legalName],
          entities: [data.company.companyId],
          tags: ['company'],
        },
      ),
    });
    add({
      prefix: 'Q-FACT-',
      question: 'How many employees does the canonical company profile report?',
      ...base(
        'factual',
        'company',
        'easy',
        `${data.company.employeeCount} employees are reported; employees.json is a representative sample.`,
        [source('company', data.company.companyId)],
        {
          acceptableAnswerPoints: [String(data.company.employeeCount)],
          tags: ['company'],
        },
      ),
    });
    for (const system of data.systems)
      add({
        prefix: 'Q-FACT-',
        question: `What is the status of ${system.name}?`,
        ...base(
          'factual',
          'system-status',
          'easy',
          `${system.name} is ${system.status}.`,
          [source('system', system.systemId)],
          {
            acceptableAnswerPoints: [system.status],
            entities: [system.systemId],
            systems: [system.systemId],
            tags: ['it', 'system'],
          },
        ),
      });
    for (const item of data.warehouses)
      add({
        prefix: 'Q-FACT-',
        question: `Which city is ${item.name} in?`,
        ...base(
          'factual',
          'warehouse-location',
          'easy',
          `${item.name} is in ${item.city}.`,
          [source('warehouse', item.warehouseId)],
          {
            acceptableAnswerPoints: [item.city],
            entities: [item.warehouseId],
            tags: ['warehouse'],
          },
        ),
      });
    for (const item of data.inventory.slice(0, 6)) {
      const p = data.productById.get(item.productId)!;
      const w = data.warehouseById.get(item.warehouseId)!;
      add({
        prefix: 'Q-FACT-',
        question: `How much available stock of ${p.name} is recorded at ${w.name}?`,
        ...base(
          'factual',
          'inventory-availability',
          'easy',
          `${item.quantityAvailable} units are available.`,
          [
            source('inventory', item.inventoryId),
            source('product', p.productId),
            source('warehouse', w.warehouseId),
          ],
          {
            acceptableAnswerPoints: [String(item.quantityAvailable)],
            entities: [item.inventoryId, p.productId, w.warehouseId],
            tags: ['inventory', 'inventory-availability'],
          },
        ),
      });
    }
    add({
      prefix: 'Q-FACT-',
      question: `Which supplier provides ${product.name}?`,
      ...base(
        'factual',
        'supplier-product',
        'medium',
        data.suppliers
          .filter((s) => s.suppliedProductIds.includes(product.productId))
          .map((s) => s.tradingName)
          .join(', '),
        [source('product', product.productId)],
        {
          acceptableAnswerPoints: data.suppliers
            .filter((s) => s.suppliedProductIds.includes(product.productId))
            .map((s) => s.tradingName),
          entities: [product.productId],
          tags: ['supplier', 'product'],
        },
      ),
    });
    add({
      prefix: 'Q-FACT-',
      question: `Who is the account manager for ${customer.tradingName}?`,
      ...base(
        'factual',
        'customer-account-manager',
        'medium',
        fullName(data.employeeById.get(customer.accountManagerEmployeeId)!),
        [
          source('customer', customer.customerId),
          source('employee', customer.accountManagerEmployeeId),
        ],
        {
          acceptableAnswerPoints: [
            fullName(data.employeeById.get(customer.accountManagerEmployeeId)!),
          ],
          entities: [customer.customerId, customer.accountManagerEmployeeId],
          tags: ['customer', 'sales'],
        },
      ),
    });

    const policyQuestions: Array<
      [string, string, Difficulty, string, string[], string[]]
    > = [
      [
        'How many working days of annual leave are employees entitled to?',
        'leave',
        'easy',
        'Employees accrue 24 working days of annual leave for each completed leave year.',
        ['HR-POL-001'],
        ['24 working days', 'annual leave'],
      ],
      [
        'How much notice should normally be given for annual leave?',
        'leave',
        'easy',
        'Annual leave should normally be requested at least 5 working days before the first day away.',
        ['HR-POL-001'],
        ['5 working days'],
      ],
      [
        'What is the receipt threshold for an expense claim?',
        'expenses',
        'easy',
        'A receipt is required for each expense of KES 2,000 or more.',
        ['FIN-POL-001'],
        ['KES 2,000', 'receipt'],
      ],
      [
        'What is the meal reimbursement limit?',
        'expenses',
        'easy',
        'Meal claims are capped at KES 3,000 per person per meal unless an approved exception exists.',
        ['FIN-POL-001'],
        ['KES 3,000'],
      ],
      [
        'What is the accommodation reimbursement limit?',
        'travel',
        'easy',
        'Accommodation is reimbursed up to KES 12,000 per night unless an approved exception exists.',
        ['OPS-POL-001', 'FIN-POL-001'],
        ['KES 12,000'],
      ],
      [
        'What is the approved mileage rate for a personal vehicle?',
        'travel',
        'easy',
        'Approved personal-vehicle mileage is reimbursed at KES 45 per kilometre with route evidence.',
        ['FIN-POL-001', 'OPS-POL-001'],
        ['KES 45 per kilometre'],
      ],
      [
        'What documents are needed for an expense reimbursement?',
        'expenses',
        'medium',
        'The claim needs its cost centre, business purpose and supporting attachments; receipts are required at or above KES 2,000.',
        ['FIN-POL-001'],
        ['cost centre', 'business purpose', 'receipts'],
      ],
      [
        'What happens after a purchase request is approved?',
        'procurement',
        'medium',
        'The lifecycle proceeds through supplier selection, quotation, purchase order, delivery, goods receipt, invoice and Finance payment.',
        ['PROC-POL-001'],
        ['supplier selection', 'purchase order', 'goods receipt'],
      ],
      [
        'What happens when received goods do not match the purchase order?',
        'receiving',
        'medium',
        'Shortages, damage and price differences are held for resolution; the warehouse records the discrepancy and Finance uses the goods receipt for matching.',
        ['WH-POL-001', 'PROC-POL-001'],
        ['held for resolution', 'goods receipt'],
      ],
      [
        'How is a new supplier approved?',
        'supplier-management',
        'medium',
        'Procurement must complete onboarding and due diligence before using a supplier, and the supplier must be approved.',
        ['PROC-POL-002'],
        ['onboarding', 'due diligence'],
      ],
      [
        'What happens when a supplier fails due diligence?',
        'supplier-management',
        'medium',
        'The supplier relationship must not proceed until the issue is resolved or an authorised exception is recorded.',
        ['PROC-POL-002'],
        ['due diligence', 'authorised exception'],
      ],
      [
        'What should an employee do if they cannot access Microsoft Dynamics 365 Finance?',
        'access',
        'medium',
        'The employee should raise a ticket in the IT Service Desk; the service desk verifies onboarding and routes an access correction.',
        ['HR-POL-002', 'IT-POL-001'],
        ['IT Service Desk', 'access correction'],
      ],
      [
        'What should happen when an employee leaves and still has system access?',
        'access',
        'medium',
        'HR notifies IT and IT disables, changes or recertifies access promptly through the Identity and Access Management System.',
        ['HR-POL-002', 'IT-POL-001'],
        ['disable access', 'Identity and Access Management System'],
      ],
      [
        'How quickly should a P1 incident be acknowledged?',
        'incident',
        'easy',
        'A P1 incident should be acknowledged within 15 minutes and escalated immediately.',
        ['IT-POL-002'],
        ['P1', '15 minutes'],
      ],
      [
        'What information must be included when reporting an incident?',
        'incident',
        'medium',
        'The ticket should include the affected system, symptoms, time, location, business impact and contact details.',
        ['IT-POL-002'],
        ['affected system', 'business impact'],
      ],
      [
        'What information about customers must be protected?',
        'privacy',
        'medium',
        'Customer contacts and account history are personal data and must be protected in Microsoft Dynamics 365 Sales with least-privilege access.',
        ['COMP-POL-001', 'IT-POL-001'],
        ['customer contacts', 'least privilege'],
      ],
      [
        'What is the process for reporting a conflict of interest?',
        'compliance',
        'medium',
        'The concern should be disclosed and handled under the Anti-Bribery & Conflict of Interest Policy before the affected transaction proceeds.',
        ['COMP-POL-002'],
        ['conflict of interest', 'disclosure'],
      ],
      [
        'How should business travel expenses be documented?',
        'travel',
        'medium',
        'Travel requires documented purpose, traveller, destination, dates and estimated cost; claims require receipts or a documented receipt exception.',
        ['OPS-POL-001', 'FIN-POL-001'],
        ['travel authorisation', 'receipts'],
      ],
      [
        'How are company records retained and disposed of?',
        'records',
        'medium',
        'Records follow the approved schedule, normally have a 7-year review point for corporate control records, and are securely disposed of only when no hold applies.',
        ['GEN-POL-001'],
        ['7 years', 'legal hold'],
      ],
      [
        'What are the four incident severity levels and response targets?',
        'incident',
        'medium',
        'The levels are P1 15 minutes, P2 60 minutes, P3 240 minutes and P4 1,440 minutes.',
        ['IT-POL-002'],
        ['P1', 'P2', 'P3', 'P4'],
      ],
    ];
    for (const [
      question,
      subcategory,
      difficulty,
      answer,
      policies,
      points,
    ] of policyQuestions)
      add({
        prefix: 'Q-POL-',
        question,
        ...base(
          'policy',
          subcategory,
          difficulty,
          answer,
          policies.map((id) =>
            source('policy', id, 'Procedures and Requirements'),
          ),
          {
            acceptableAnswerPoints: points,
            policies,
            tags: ['policy', subcategory],
          },
        ),
      });

    for (const item of data.employees.slice(0, 15)) {
      const department = data.departmentById.get(item.departmentId)!;
      const role = data.roleById.get(item.roleId)!;
      add({
        prefix: 'Q-ENT-',
        question: `Which department and role are recorded for ${fullName(item)} (${item.employeeId})?`,
        ...base(
          'entity',
          'employee-resolution',
          'medium',
          `${fullName(item)} belongs to ${department.name} and holds the ${role.title} role.`,
          [
            source('employee', item.employeeId),
            source('department', department.departmentId),
            source('role', role.roleId),
          ],
          {
            acceptableAnswerPoints: [department.name, role.title],
            entities: [item.employeeId, department.departmentId, role.roleId],
            tags: ['hr', 'entity-resolution'],
          },
        ),
      });
    }
    for (const item of data.costCenters.slice(0, 3)) {
      const department = data.departmentById.get(item.departmentId)!;
      add({
        prefix: 'Q-ENT-',
        question: `Which cost center belongs to ${department.name}?`,
        ...base(
          'entity',
          'cost-center',
          'medium',
          `${item.code} (${item.costCenterId}) belongs to ${department.name}.`,
          [
            source('cost-center', item.costCenterId),
            source('department', department.departmentId),
          ],
          {
            acceptableAnswerPoints: [item.code, item.costCenterId],
            entities: [item.costCenterId, department.departmentId],
            tags: ['finance', 'cost-center'],
          },
        ),
      });
    }

    const limits = [
      50_000, 50_001, 500_000, 500_001, 2_000_000, 2_000_001, 10_000_000,
      10_000_001, 750_000, 1_500_000,
    ];
    for (const amount of limits) {
      const band =
        amount <= 50_000
          ? ['Department Manager', 'ROLE-DEPT-MGR']
          : amount <= 500_000
            ? ['Department Head', 'ROLE-DEPT-MGR']
            : amount <= 2_000_000
              ? ['Finance Manager', 'ROLE-FIN-MGR']
              : amount <= 10_000_000
                ? ['CFO', 'ROLE-CFO']
                : ['CEO or Executive Committee', 'ROLE-CEO'];
      const nominal = data.roleById.get(band[1])!;
      const limit = nominal?.approvalAuthority?.approvalLimitKes ?? 0;
      const sufficient = limit >= amount;
      const outcome = sufficient
        ? `${band[0]} is the nominal approval tier; the resolved ${nominal.title} role has ${limit === 0 ? 'no recorded limit' : money(limit)} authority, which covers the ${money(amount)} request.`
        : `${band[0]} is the nominal tier, but the resolved ${nominal.title} role has ${limit === 0 ? 'no recorded limit' : money(limit)} authority, which is insufficient; the request must escalate.`;
      add({
        prefix: 'Q-REASON-',
        question: `A department wants to make a purchase of ${money(amount)}. Which approval path applies, and is the nominal approver's actual authority sufficient?`,
        ...base(
          'reasoning',
          'approval-boundary',
          amount === 750_000 || amount === 1_500_000 ? 'expert' : 'hard',
          outcome,
          [
            source('policy', 'FIN-POL-002', 'Approval Authority'),
            source('role', nominal!.roleId),
          ],
          {
            acceptableAnswerPoints: [
              band[0],
              nominal.title,
              limit === 0 ? 'no recorded limit' : money(limit),
              sufficient ? 'sufficient' : 'escalate',
            ],
            entities: [nominal!.roleId],
            policies: ['FIN-POL-002'],
            reasoningSteps: [
              'Identify the amount.',
              'Locate the approval band in FIN-POL-002.',
              'Resolve the representative canonical role and its approval limit.',
              'Compare the actual limit with the requested amount.',
            ],
            tags: ['finance', 'approval', 'boundary', 'multi-hop'],
          },
        ),
      });
    }
    for (const item of data.inventory.slice(0, 10)) {
      const p = data.productById.get(item.productId)!;
      const w = data.warehouseById.get(item.warehouseId)!;
      const below = item.quantityAvailable < item.reorderLevel;
      add({
        prefix: 'Q-REASON-',
        question: `Should ${p.name} at ${w.name} be reviewed for replenishment, given ${item.quantityAvailable} available units and a reorder level of ${item.reorderLevel}?`,
        ...base(
          'reasoning',
          'inventory-threshold',
          'hard',
          `${item.quantityAvailable} available units are ${below ? 'below' : 'above or equal to'} the reorder level, so ${below ? 'replenishment review is required' : 'replenishment is not triggered by the recorded threshold'}. The reorder quantity is ${item.reorderQuantity}.`,
          [
            source('inventory', item.inventoryId),
            source('product', p.productId),
            source('warehouse', w.warehouseId),
            source('policy', 'INV-POL-001', 'Procedures and Requirements'),
          ],
          {
            acceptableAnswerPoints: [
              String(item.quantityAvailable),
              String(item.reorderLevel),
              below ? 'replenishment review' : 'not triggered',
            ],
            entities: [item.inventoryId, p.productId, w.warehouseId],
            policies: ['INV-POL-001'],
            reasoningSteps: [
              'Read quantityAvailable and reorderLevel.',
              'Compare available stock with the threshold.',
              'Apply the inventory replenishment rule.',
              'Read the canonical reorder quantity.',
            ],
            tags: ['inventory', 'inventory-availability', 'boundary'],
          },
        ),
      });
    }

    for (const scenario of data.scenarios.sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      const cross = scenario.category === 'cross-domain';
      const category: Category = cross ? 'cross-domain' : 'reasoning';
      const entities = (scenario.entities ?? [])
        .filter((item: Row) => item.id)
        .map((item: Row) => item.id);
      const sources = [
        source('scenario', scenario.id),
        ...(scenario.policies ?? [])
          .sort()
          .map((id: string) =>
            source('policy', id, 'Scenario business context'),
          ),
      ];
      add({
        prefix: cross ? 'Q-XD-' : 'Q-REASON-',
        question: `What should happen in ${scenario.id}: ${scenario.title}?`,
        ...base(
          category,
          'scenario-workflow',
          scenario.difficulty as Difficulty,
          scenario.expectedOutcome,
          sources,
          {
            acceptableAnswerPoints: [scenario.expectedOutcome],
            entities,
            systems: scenario.systems ?? [],
            policies: scenario.policies ?? [],
            scenarios: [scenario.id],
            reasoningSteps: scenario.requiredReasoning ?? [],
            tags: sorted([
              ...(scenario.tags ?? []),
              'scenario',
              cross ? 'multi-hop' : 'workflow',
            ]),
          },
        ),
      });
    }

    const terminatedEmployee =
      data.employees.find((item) => item.employmentStatus === 'TERMINATED') ??
      data.employees[0];
    const crossTemplates: Array<
      [string, string, string, Source[], string[], string[], string[]]
    > = [
      [
        `A new employee in ${data.departmentById.get(data.employees[0].departmentId)!.name} cannot access ${data.systems[0].name}. What should happen?`,
        'HR should confirm the onboarding record and approved role; IT should correct access through the service desk and identity controls.',
        'onboarding-access',
        [
          source('employee', data.employees[0].employeeId),
          source('department', data.employees[0].departmentId),
          source('system', data.systems[0].systemId),
          source('policy', 'HR-POL-002'),
          source('policy', 'IT-POL-001'),
        ],
        [
          data.employees[0].employeeId,
          data.employees[0].departmentId,
          data.systems[0].systemId,
        ],
        ['HR-POL-002', 'IT-POL-001'],
        ['hr', 'it', 'cross-domain'],
      ],
      [
        `A customer requests ${data.inventory[0].quantityAvailable + 1} units of ${data.productById.get(data.inventory[0].productId)!.name}. Can the order be fulfilled from ${data.warehouseById.get(data.inventory[0].warehouseId)!.name}?`,
        `No. Only ${data.inventory[0].quantityAvailable} units are available after reservations, so the request exceeds available stock.`,
        'sales-inventory',
        [
          source('customer', customer.customerId),
          source('product', data.inventory[0].productId),
          source('inventory', data.inventory[0].inventoryId),
          source('warehouse', data.inventory[0].warehouseId),
          source('policy', 'SALES-POL-001'),
          source('policy', 'INV-POL-001'),
        ],
        [
          customer.customerId,
          data.inventory[0].productId,
          data.inventory[0].inventoryId,
          data.inventory[0].warehouseId,
        ],
        ['SALES-POL-001', 'INV-POL-001'],
        ['sales', 'inventory', 'cross-domain'],
      ],
      [
        `${data.productById.get(data.inventory[2].productId)!.name} is below its reorder level. What process should begin?`,
        'Inventory should review demand, open orders, stock at other warehouses and lead time, then initiate a purchase request or transfer under procurement and financial approval controls; the signal is not an automatic purchase.',
        'inventory-procurement',
        [
          source('product', data.inventory[2].productId),
          source('inventory', data.inventory[2].inventoryId),
          source('policy', 'INV-POL-001'),
          source('policy', 'PROC-POL-001'),
          source('policy', 'FIN-POL-002'),
        ],
        [data.inventory[2].productId, data.inventory[2].inventoryId],
        ['INV-POL-001', 'PROC-POL-001', 'FIN-POL-002'],
        ['inventory', 'procurement', 'finance', 'cross-domain'],
      ],
      [
        `A proposed supplier for ${product.name} has a conflict-of-interest concern. What must happen before it is used?`,
        'The concern must be disclosed and investigated; supplier onboarding and due diligence must be complete before procurement uses the supplier.',
        'supplier-compliance',
        [
          source('supplier', data.suppliers[0].supplierId),
          source('product', product.productId),
          source('policy', 'PROC-POL-002'),
          source('policy', 'COMP-POL-002'),
        ],
        [data.suppliers[0].supplierId, product.productId],
        ['PROC-POL-002', 'COMP-POL-002'],
        ['supplier', 'compliance', 'cross-domain'],
      ],
      [
        `${fullName(terminatedEmployee)} has left the company but still has system access. Which controls apply?`,
        'HR must notify IT, and IT must promptly disable, change or recertify access through the identity system while preserving required records.',
        'termination-access',
        [
          source('employee', terminatedEmployee.employeeId),
          source('policy', 'HR-POL-002'),
          source('policy', 'IT-POL-001'),
          source('policy', 'GEN-POL-001'),
        ],
        [terminatedEmployee.employeeId],
        ['HR-POL-002', 'IT-POL-001', 'GEN-POL-001'],
        ['hr', 'it', 'access-control', 'cross-domain'],
      ],
      [
        `A warehouse receives ${data.productById.get(data.inventory[3].productId)!.name} with a quantity different from the purchase order. What should the warehouse and Finance do?`,
        'The warehouse should record the discrepancy; Finance should hold matching until the purchase order, goods receipt and invoice are resolved.',
        'receiving-finance',
        [
          source('product', data.inventory[3].productId),
          source('warehouse', data.inventory[3].warehouseId),
          source('policy', 'WH-POL-001'),
          source('policy', 'PROC-POL-001'),
        ],
        [data.inventory[3].productId, data.inventory[3].warehouseId],
        ['WH-POL-001', 'PROC-POL-001'],
        ['warehouse', 'procurement', 'finance', 'cross-domain'],
      ],
      [
        `A traveller incurs a KES 3,500 meal while visiting ${data.locations[0].city}. What evidence and rule determine reimbursement?`,
        'The claim needs business purpose and supporting evidence; the normal meal cap is KES 3,000 per person, so the excess requires an approved exception.',
        'travel-expense',
        [
          source('location', data.locations[0].locationId),
          source('policy', 'OPS-POL-001'),
          source('policy', 'FIN-POL-001'),
        ],
        [data.locations[0].locationId],
        ['OPS-POL-001', 'FIN-POL-001'],
        ['travel', 'finance', 'boundary', 'cross-domain'],
      ],
      [
        `A P1 incident affects ${data.systems[0].name} and may expose customer data. How should it be handled?`,
        'The service desk should acknowledge within 15 minutes and escalate immediately; Compliance should assess the possible data incident while evidence is preserved.',
        'incident-privacy',
        [
          source('system', data.systems[0].systemId),
          source('policy', 'IT-POL-002'),
          source('policy', 'COMP-POL-001'),
        ],
        [data.systems[0].systemId],
        ['IT-POL-002', 'COMP-POL-001'],
        ['it', 'incident', 'privacy', 'cross-domain'],
      ],
      [
        `A customer order cannot be fulfilled because ${data.productById.get(data.inventory[2].productId)!.name} is below available stock. When can procurement become involved?`,
        'Sales should not confirm more than available stock; Inventory reviews replenishment or transfer options, and any purchase request follows Procurement and Finance approval.',
        'sales-procurement',
        [
          source('customer', customer.customerId),
          source('product', data.inventory[2].productId),
          source('inventory', data.inventory[2].inventoryId),
          source('policy', 'SALES-POL-001'),
          source('policy', 'INV-POL-001'),
          source('policy', 'PROC-POL-001'),
        ],
        [
          customer.customerId,
          data.inventory[2].productId,
          data.inventory[2].inventoryId,
        ],
        ['SALES-POL-001', 'INV-POL-001', 'PROC-POL-001'],
        ['sales', 'inventory', 'procurement', 'cross-domain'],
      ],
    ];
    for (const [
      question,
      answer,
      subcategory,
      sources,
      entities,
      policies,
      tags,
    ] of crossTemplates)
      add({
        prefix: 'Q-XD-',
        question,
        ...base('cross-domain', subcategory, 'expert', answer, sources, {
          acceptableAnswerPoints: tags.slice(0, 3),
          entities,
          policies,
          reasoningSteps: [
            'Identify the entities and operational trigger.',
            'Retrieve the relevant policy controls.',
            'Connect the records across the affected domains.',
            'State the permitted next action and any required escalation.',
          ],
          tags,
        }),
      });

    const negative: Array<[string, string, string[], Behavior]> = [
      [
        'Can a suspended customer place a normal order?',
        'A suspended customer must not place a normal order until the suspension is resolved and the customer is approved for ordering.',
        ['SALES-POL-001'],
        'reject',
      ],
      [
        'Can a pending supplier be treated as an approved supplier?',
        'No. Procurement must not use the supplier until onboarding and due diligence are complete and approval is recorded.',
        ['PROC-POL-002'],
        'reject',
      ],
      [
        'Can a department manager approve a purchase above their actual approval limit?',
        'No. The request requires additional approval or escalation when the actual authority is insufficient.',
        ['FIN-POL-002'],
        'escalate',
      ],
      [
        'Can an employee approve their own expense claim?',
        'No. A claimant must never approve their own claim.',
        ['FIN-POL-001'],
        'reject',
      ],
      [
        'Can inventory be increased without an authorised stock adjustment?',
        'No. An unexplained inventory adjustment is not permitted; independent review and authorisation are required.',
        ['INV-POL-001', 'WH-POL-001'],
        'reject',
      ],
      [
        'Can a purchase bypass the normal procurement process without emergency criteria?',
        'No. Emergency procurement requires material risk, a recorded reason and retrospective approvals.',
        ['PROC-POL-001'],
        'reject',
      ],
      [
        'Can a user receive system access because a colleague asks informally?',
        'No. Access requires an authorised request and least-privilege role mapping.',
        ['IT-POL-001'],
        'reject',
      ],
      [
        'Can damaged goods be moved directly into available stock?',
        'No. Damaged or questionable goods must be segregated and reported before disposition.',
        ['WH-POL-001', 'INV-POL-001'],
        'reject',
      ],
      [
        'Can a travel advance remain unreconciled when another advance is requested?',
        'No. The previous advance must be reconciled and any unused balance returned first.',
        ['FIN-POL-001', 'OPS-POL-001'],
        'reject',
      ],
      [
        'Can an approved record be overwritten to hide its history?',
        'No. A revised record must preserve version history and must not conceal the earlier record.',
        ['GEN-POL-001'],
        'reject',
      ],
    ];
    for (const [question, answer, policies, behavior] of negative)
      add({
        prefix: 'Q-NEG-',
        question,
        ...base(
          'negative',
          'control-rejection',
          'hard',
          answer,
          policies.map((id) =>
            source('policy', id, 'Procedures and Requirements'),
          ),
          {
            acceptableAnswerPoints: [behavior, 'not permitted'],
            policies,
            expectedBehavior: behavior,
            reasoningSteps: [
              'Identify the requested action.',
              'Retrieve the relevant control.',
              'Determine whether the action is permitted, rejected or escalated.',
            ],
            tags: ['negative', behavior, 'control'],
          },
        ),
      });

    const abstentions = [
      "What is the CEO's personal mobile number?",
      'What is the private home address of the Finance Manager?',
      "What is the employee's personal bank account number?",
      'What password does an employee use for Dynamics 365?',
      "What was the CEO's salary last month?",
      'Which private WhatsApp number belongs to the Finance Manager?',
      "What is the customer's personal identification number?",
      "What is an employee's medical diagnosis?",
      'What is the private email password of the Sales Manager?',
      'What political party does the CFO support?',
    ];
    for (const question of abstentions)
      add({
        prefix: 'Q-ABS-',
        question,
        ...base(
          'abstention',
          'missing-sensitive-fact',
          'easy',
          'This cannot be established from the available enterprise knowledge base; the system should abstain rather than invent sensitive personal information.',
          [],
          {
            acceptableAnswerPoints: ['cannot be established', 'abstain'],
            answerability: 'unanswerable',
            requiredSources: [],
            expectedBehavior: 'abstain',
            tags: ['abstention', 'privacy'],
          },
        ),
      });

    validate(questions, data);
    questions.sort((a, b) => a.id.localeCompare(b.id));
    const categories = Object.fromEntries(
      (
        [
          'factual',
          'policy',
          'entity',
          'reasoning',
          'cross-domain',
          'negative',
          'abstention',
        ] as Category[]
      ).map((category) => [
        category,
        questions.filter((q) => q.category === category),
      ]),
    );
    await mkdir(resolve(OUTPUT, 'categories'), { recursive: true });
    await writeFile(
      resolve(OUTPUT, 'questions.json'),
      `${JSON.stringify(questions, null, 2)}\n`,
    );
    for (const [category, values] of Object.entries(categories))
      await writeFile(
        resolve(OUTPUT, 'categories', `${category}.json`),
        `${JSON.stringify(values, null, 2)}\n`,
      );
    const count = (key: keyof Question) =>
      Object.fromEntries(
        [...new Set(questions.map((q) => String(q[key])))]
          .sort()
          .map((value) => [
            value,
            questions.filter((q) => String(q[key]) === value).length,
          ]),
      );
    await writeFile(
      resolve(OUTPUT, 'index.json'),
      `${JSON.stringify({ totalQuestions: questions.length, categories: Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, value.length])), difficulty: count('difficulty'), answerability: count('answerability'), generatedAt: '2026-01-01', generatorVersion: VERSION, sourceCounts: { employees: data.employees.length, departments: data.departments.length, roles: data.roles.length, locations: data.locations.length, systems: data.systems.length, suppliers: data.suppliers.length, customers: data.customers.length, products: data.products.length, warehouses: data.warehouses.length, inventory: data.inventory.length, costCenters: data.costCenters.length, policies: data.policies.size, scenarios: data.scenarios.length } }, null, 2)}\n`,
    );
    console.log('Generated test questions successfully.');
    console.log(`Total: ${questions.length}`);
    for (const category of [
      'factual',
      'policy',
      'entity',
      'reasoning',
      'cross-domain',
      'negative',
      'abstention',
    ])
      console.log(
        `${category[0].toUpperCase()}${category.slice(1)}: ${categories[category].length}`,
      );
    for (const difficulty of ['easy', 'medium', 'hard', 'expert'])
      console.log(
        `${difficulty[0].toUpperCase()}${difficulty.slice(1)}: ${questions.filter((q) => q.difficulty === difficulty).length}`,
      );
    console.log(
      `Answerable: ${questions.filter((q) => q.answerability === 'answerable').length}`,
    );
    console.log(
      `Unanswerable: ${questions.filter((q) => q.answerability === 'unanswerable').length}`,
    );
    console.log('Validation: PASSED');
  });
}

function validate(
  questions: Question[],
  data: Awaited<ReturnType<typeof loadCorpus>>,
) {
  const ids = new Set<string>();
  const texts = new Set<string>();
  const collections: Record<string, Map<string, Row>> = {
    employee: data.employeeById,
    department: data.departmentById,
    role: data.roleById,
    location: data.locationById,
    system: data.systemById,
    supplier: data.supplierById,
    customer: data.customerById,
    product: data.productById,
    warehouse: data.warehouseById,
    inventory: data.inventoryById,
    'cost-center': data.costCenterById,
    scenario: data.scenarioById,
  };
  for (const question of questions) {
    if (ids.has(question.id) || texts.has(question.question))
      throw new Error(`Duplicate question: ${question.id}`);
    ids.add(question.id);
    texts.add(question.question);
    if (
      !question.question ||
      (!question.expectedAnswer && question.answerability === 'answerable')
    )
      throw new Error(`Incomplete question: ${question.id}`);
    if (
      question.answerability === 'answerable' &&
      question.requiredSources.length === 0
    )
      throw new Error(`Answerable question has no sources: ${question.id}`);
    if (
      question.answerability === 'unanswerable' &&
      question.expectedBehavior !== 'abstain'
    )
      throw new Error(`Invalid abstention behavior: ${question.id}`);
    for (const policy of question.policies)
      if (!data.policies.has(policy))
        throw new Error(`Missing policy ${policy} in ${question.id}`);
    for (const item of question.requiredSources) {
      if (item.type === 'policy' && !data.policies.has(item.id))
        throw new Error(`Missing policy source ${item.id}`);
      if (item.type === 'company' && item.id !== data.company.companyId)
        throw new Error(`Missing company source ${item.id}`);
      if (item.type === 'scenario' && !data.scenarioById.has(item.id))
        throw new Error(`Missing scenario source ${item.id}`);
      if (collections[item.type] && !collections[item.type].has(item.id))
        throw new Error(`Missing ${item.type} source ${item.id}`);
    }
    for (const scenario of question.scenarios)
      if (!data.scenarioById.has(scenario))
        throw new Error(`Missing scenario reference ${scenario}`);
  }
  const minimums: Partial<Record<Category, number>> = {
    factual: 20,
    policy: 20,
    entity: 15,
    reasoning: 20,
    'cross-domain': 20,
    negative: 10,
    abstention: 10,
  };
  for (const [category, minimum] of Object.entries(minimums))
    if (questions.filter((q) => q.category === category).length < minimum!)
      throw new Error(`Category ${category} is below minimum ${minimum}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
