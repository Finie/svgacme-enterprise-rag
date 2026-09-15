/** Read-only checks of the JSON/Markdown source contract; no ingestion or database. */
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Raw source records, not a second set of domain models.
type Row = Record<string, any>;
export interface Corpus {
  records: Record<string, Row[]>;
  policies: Record<string, string>;
  questionCopies: Record<string, Row[]>;
}
export interface Issue {
  group: string;
  message: string;
}
export const collections = {
  company: ['enterprise/company', 'companyId'],
  department: ['enterprise/departments', 'departmentId'],
  role: ['enterprise/roles', 'roleId'],
  employee: ['enterprise/employees', 'employeeId'],
  location: ['enterprise/locations', 'locationId'],
  system: ['enterprise/systems', 'systemId'],
  costCenter: ['master-data/cost-centers', 'costCenterId'],
  warehouse: ['master-data/warehouses', 'warehouseId'],
  supplier: ['master-data/suppliers', 'supplierId'],
  product: ['master-data/products', 'productId'],
  customer: ['master-data/customers', 'customerId'],
  inventory: ['master-data/inventory', 'inventoryId'],
} as const;
export async function loadCorpus(root = ROOT): Promise<Corpus> {
  const json = async (path: string) =>
    JSON.parse(await readFile(resolve(root, 'data', path), 'utf8'));
  const records: Corpus['records'] = {};
  for (const [type, [path]] of Object.entries(collections)) {
    const value = await json(`${path}.json`);
    records[type] = Array.isArray(value) ? value : [value];
  }
  const policies: Corpus['policies'] = {};
  for (const file of (await readdir(resolve(root, 'data/policies'))).sort())
    if (file.endsWith('.md'))
      policies[file.slice(0, -3)] = await readFile(
        resolve(root, 'data/policies', file),
        'utf8',
      );
  records.scenario = [];
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await readdir(resolve(root, 'data', directory), {
      withFileTypes: true,
    })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.json') && entry.name !== 'index.json')
        records.scenario.push(await json(path));
    }
  };
  await walk('scenarios');
  records.question = await json('test-questions/questions.json');
  const questionCopies: Corpus['questionCopies'] = {};
  for (const name of await readdir(
    resolve(root, 'data/test-questions/categories'),
  ))
    if (name.endsWith('.json'))
      questionCopies[name.slice(0, -5)] = await json(
        `test-questions/categories/${name}`,
      );
  return { records, policies, questionCopies };
}
export function metadata(markdown: string, key: string): string | undefined {
  return markdown.match(new RegExp(`^\\| ${key} \\| (.*?) \\|$`, 'm'))?.[1];
}
export function parseAccess(
  value: string,
): { systemId: string; accessProfile: string } | undefined {
  const match = /^(SYS-[A-Z0-9-]+): (.+)$/.exec(value);
  return match ? { systemId: match[1], accessProfile: match[2] } : undefined;
}
export function policySections(markdown: string) {
  return [...markdown.matchAll(/^## (\d+)\. (.+)\r?$/gm)].map(
    (match, i, all) => ({
      ordinal: Number(match[1]),
      heading: match[2],
      body: markdown.slice(
        match.index! + match[0].length,
        all[i + 1]?.index ?? markdown.length,
      ),
    }),
  );
}
/** Null limit on an existing authority means unbounded; an absent authority is not unlimited. */
export function effectiveAuthority(
  ceiling: number | null,
  authority: Row | null,
): number | null | undefined {
  if (authority === null) return undefined;
  const limit = authority.approvalLimitKes as number | null;
  return ceiling === null
    ? limit
    : limit === null
      ? ceiling
      : Math.min(ceiling, limit);
}
export function validateDataModel(corpus: Corpus): Issue[] {
  const issues: Issue[] = [];
  const fail = (group: string, message: string) =>
    issues.push({ group, message });
  const r = corpus.records;
  const maps: Record<string, Map<string, Row>> = {};
  for (const [type, rows] of Object.entries(r)) {
    const key =
      type in collections
        ? collections[type as keyof typeof collections][1]
        : 'id';
    maps[type] = new Map();
    for (const row of rows) {
      const id = row[key];
      if (typeof id !== 'string' || !id || maps[type].has(id))
        fail('keys', `${type}: missing/duplicate ${key} ${id}`);
      maps[type].set(id, row);
    }
  }
  maps.policy = new Map(Object.keys(corpus.policies).map((id) => [id, {}]));
  maps['cost-center'] = maps.costCenter;
  const ref = (
    group: string,
    context: string,
    type: string,
    id: unknown,
    optional = false,
  ) => {
    if (optional && id === null) return;
    if (typeof id !== 'string' || !maps[type]?.has(id))
      fail(group, `${context}: unresolved ${type} reference ${String(id)}`);
  };
  const fields = (
    type: string,
    links: [string, string, boolean?][],
    group: string,
  ) => {
    for (const row of r[type])
      for (const [field, target, optional] of links)
        ref(
          group,
          `${type} ${row[collections[type as keyof typeof collections][1]]}.${field}`,
          target,
          row[field],
          optional,
        );
  };
  fields(
    'department',
    [
      ['departmentHeadRoleId', 'role'],
      ['costCenterCode', 'costCenter'],
    ],
    'organization',
  );
  fields('role', [['departmentId', 'department']], 'organization');
  fields(
    'employee',
    [
      ['roleId', 'role'],
      ['departmentId', 'department'],
      ['locationId', 'location'],
    ],
    'organization',
  );
  fields('employee', [['managerEmployeeId', 'employee', true]], 'managers');
  for (const employee of r.employee) {
    const seen = new Set<string>();
    let current: Row | undefined = employee;
    while (current) {
      if (seen.has(current.employeeId)) {
        fail(
          'managers',
          `${employee.employeeId}: manager cycle at ${current.employeeId}`,
        );
        break;
      }
      seen.add(current.employeeId);
      current = maps.employee.get(current.managerEmployeeId);
    }
  }
  for (const company of r.company)
    ref(
      'organization',
      company.companyId,
      'location',
      company.headquarters?.locationId,
    );
  fields('system', [['owningDepartmentId', 'department']], 'organization');
  fields(
    'costCenter',
    [
      ['departmentId', 'department'],
      ['managerEmployeeId', 'employee'],
      ['locationId', 'location'],
    ],
    'master',
  );
  fields(
    'warehouse',
    [
      ['managerEmployeeId', 'employee'],
      ['locationId', 'location'],
    ],
    'master',
  );
  fields('supplier', [['relationshipOwnerEmployeeId', 'employee']], 'master');
  fields('customer', [['accountManagerEmployeeId', 'employee']], 'master');
  for (const department of r.department)
    if (
      maps.costCenter.get(department.costCenterCode)?.departmentId !==
      department.departmentId
    )
      fail(
        'master',
        `${department.departmentId}: default cost center belongs to another department`,
      );
  const unique = (type: string, field: string) => {
    const values = r[type].map((row) => row[field]);
    if (
      values.some((v) => typeof v !== 'string' || !v) ||
      new Set(values).size !== values.length
    )
      fail('keys', `${type}.${field}: missing or duplicate unique value`);
  };
  for (const [type, field] of [
    ['employee', 'employeeNumber'],
    ['employee', 'email'],
    ['product', 'sku'],
    ['supplier', 'supplierCode'],
    ['customer', 'customerCode'],
    ['costCenter', 'code'],
    ['warehouse', 'code'],
    ['department', 'name'],
    ['department', 'costCenterCode'],
    ['question', 'question'],
    ['company', 'registrationNumber'],
    ['company', 'kraPin'],
    ['system', 'name'],
  ])
    unique(type, field);
  const pairs = new Set<string>();
  const inverse = new Set<string>();
  for (const product of r.product) {
    if (!Array.isArray(product.supplierIds)) {
      fail('suppliers', `${product.productId}: supplierIds must be an array`);
      continue;
    }
    for (const id of product.supplierIds) {
      ref('suppliers', product.productId, 'supplier', id);
      const pair = `${product.productId}/${id}`;
      if (pairs.has(pair))
        fail('suppliers', `duplicate product/supplier ${pair}`);
      pairs.add(pair);
    }
  }
  for (const supplier of r.supplier) {
    if (!Array.isArray(supplier.suppliedProductIds)) {
      fail(
        'suppliers',
        `${supplier.supplierId}: suppliedProductIds must be an array`,
      );
      continue;
    }
    for (const id of supplier.suppliedProductIds) {
      ref('suppliers', supplier.supplierId, 'product', id);
      const pair = `${id}/${supplier.supplierId}`;
      if (inverse.has(pair))
        fail('suppliers', `duplicate supplier/product ${pair}`);
      inverse.add(pair);
    }
  }
  for (const pair of new Set([...pairs, ...inverse]))
    if (!pairs.has(pair) || !inverse.has(pair))
      fail('suppliers', `nonreciprocal product/supplier ${pair}`);
  fields(
    'inventory',
    [
      ['productId', 'product'],
      ['warehouseId', 'warehouse'],
    ],
    'inventory',
  );
  const stockKeys = new Set<string>();
  for (const stock of r.inventory) {
    const key = `${stock.productId}/${stock.warehouseId}`;
    if (stockKeys.has(key))
      fail('inventory-uniqueness', `${stock.inventoryId}: duplicate ${key}`);
    stockKeys.add(key);
    for (const field of [
      'quantityOnHand',
      'quantityReserved',
      'quantityAvailable',
      'reorderLevel',
      'reorderQuantity',
    ])
      if (!Number.isFinite(stock[field]) || stock[field] < 0)
        fail('inventory-quantities', `${stock.inventoryId}: invalid ${field}`);
    if (
      stock.quantityAvailable !==
      stock.quantityOnHand - stock.quantityReserved
    )
      fail(
        'inventory-quantities',
        `${stock.inventoryId}: available != on hand - reserved`,
      );
  }
  for (const role of r.role) {
    const seen = new Set<string>();
    if (!Array.isArray(role.systemAccessProfile)) {
      fail('access', `${role.roleId}: systemAccessProfile must be an array`);
      continue;
    }
    for (const access of role.systemAccessProfile ?? []) {
      const parsed =
        typeof access === 'string' ? parseAccess(access) : undefined;
      if (!parsed) {
        fail('access', `${role.roleId}: invalid access profile ${access}`);
        continue;
      }
      ref('access', role.roleId, 'system', parsed.systemId);
      if (seen.has(parsed.systemId))
        fail('access', `${role.roleId}: duplicate system ${parsed.systemId}`);
      seen.add(parsed.systemId);
    }
    const a = role.approvalAuthority;
    if (
      a !== null &&
      (!a ||
        typeof a.description !== 'string' ||
        !a.description ||
        (a.approvalLimitKes !== null &&
          (!Number.isFinite(a.approvalLimitKes) || a.approvalLimitKes < 0)))
    )
      fail('approval', `${role.roleId}: invalid approval authority`);
  }
  const systemId = (value: string) =>
    maps.system.has(value)
      ? value
      : r.system.find((s) => s.name === value)?.systemId;
  for (const [id, markdown] of Object.entries(corpus.policies)) {
    for (const key of [
      'Document ID',
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
      if (!metadata(markdown, key)) fail('policies', `${id}: missing ${key}`);
    if (metadata(markdown, 'Document ID') !== id)
      fail('policies', `${id}: document ID mismatch`);
    ref('policies', id, 'role', metadata(markdown, 'Owner'));
    ref(
      'policies',
      id,
      'department',
      r.department.find((d) => d.name === metadata(markdown, 'Department'))
        ?.departmentId,
    );
    for (const name of (metadata(markdown, 'System') ?? '')
      .split(';')
      .map((s) => s.trim()))
      ref('policies', id, 'system', systemId(name));
    for (const target of new Set(markdown.match(/\b[A-Z]+-POL-\d{3}\b/g) ?? []))
      ref('policies', id, 'policy', target);
    const sections = policySections(markdown);
    const effectiveDate = metadata(markdown, 'Effective Date') ?? '';
    const reviewDate = metadata(markdown, 'Review Date') ?? '';
    const validDate = (value: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value;
    if (
      !validDate(effectiveDate) ||
      !validDate(reviewDate) ||
      reviewDate < effectiveDate
    )
      fail('policies', `${id}: invalid effective/review dates`);
    const related = sections.find((s) => s.heading === 'RELATED POLICIES');
    if (!related)
      fail('policies', `${id}: missing explicit RELATED POLICIES section`);
    for (const [pattern, type] of [
      [/\bEMP-\d{4}\b/g, 'employee'],
      [/\bROLE-[A-Z0-9-]+\b/g, 'role'],
      [/(?<![A-Z0-9-])DEPT-[A-Z]+\b/g, 'department'],
      [/\bSYS-[A-Z0-9-]+\b/g, 'system'],
      [/\bLOC-[A-Z0-9-]+\b/g, 'location'],
      [/\bSUP-\d{3}\b/g, 'supplier'],
      [/\bCUS-\d{3}\b/g, 'customer'],
      [/\bPRD-\d{3}\b/g, 'product'],
      [/\bWH-[A-Z]+-\d{3}\b/g, 'warehouse'],
      [/\bINV-\d{4}\b/g, 'inventory'],
    ] as const) {
      for (const target of new Set(markdown.match(pattern) ?? []))
        if (!maps.policy.has(target)) ref('policies', id, type, target);
    }
    if (
      sections.length !== 13 ||
      sections.some((s, i) => s.ordinal !== i + 1 || !s.body.trim())
    )
      fail('policies', `${id}: expected 13 ordered nonempty numbered sections`);
  }
  const finance = corpus.policies['FIN-POL-002'] ?? '';
  for (const phrase of [
    'up to and including KES 50,000, Department Manager',
    'KES 50,001 to 500,000, Department Head',
    'KES 500,001 to 2,000,000, Finance Manager',
    'KES 2,000,001 to 10,000,000, CFO',
    'above KES 10,000,000, CEO or Executive Committee',
    'A role-specific authority may be lower and the lower limit applies.',
  ])
    if (!finance.includes(phrase))
      fail(
        'approval',
        `FIN-POL-002: approval matrix changed or missing: ${phrase}`,
      );
  const globalRef = (group: string, context: string, id: string) => {
    const targets = [
      ...Object.keys(collections),
      'policy',
      ...(group === 'evaluation' ? ['scenario'] : []),
    ];
    const matches = targets.filter((type) => maps[type].has(id));
    if (matches.length === 0)
      fail(group, `${context}: unresolved entity ${id}`);
    if (matches.length > 1) fail(group, `${context}: ambiguous entity ${id}`);
  };
  for (const scenario of r.scenario) {
    for (const actor of scenario.actors) {
      for (const [field, type] of [
        ['employeeId', 'employee'],
        ['roleId', 'role'],
        ['departmentId', 'department'],
      ])
        ref('actors', scenario.id, type, actor[field]);
      const employee = maps.employee.get(actor.employeeId);
      if (
        employee &&
        (employee.roleId !== actor.roleId ||
          employee.departmentId !== actor.departmentId)
      )
        fail(
          'actors',
          `${scenario.id}: actor ${actor.employeeId} differs from employee role/department`,
        );
    }
    for (const entity of scenario.entities)
      ref('scenarios', scenario.id, entity.type, entity.id);
    for (const edge of scenario.relationships)
      for (const endpoint of ['from', 'to'])
        globalRef('scenarios', scenario.id, edge[endpoint]);
    for (const id of scenario.policies)
      ref('scenarios', scenario.id, 'policy', id);
    for (const value of scenario.systems)
      ref('scenarios', scenario.id, 'system', systemId(value));
    scenario.events.forEach((event: Row, i: number) => {
      if (event.sequence !== i + 1 || typeof event.event !== 'string')
        fail(
          'scenarios',
          `${scenario.id}: invalid event sequence ${event.sequence}`,
        );
    });
  }
  for (const question of r.question) {
    if (
      !['answer', 'abstain', 'reject', 'escalate'].includes(
        question.expectedBehavior,
      )
    )
      fail('evaluation', `${question.id}: invalid behavior`);
    for (const source of question.requiredSources) {
      ref('evaluation', question.id, source.type, source.id);
      // These are semantic locators, not necessarily literal Markdown headings.
      if (
        source.section !== undefined &&
        (source.type !== 'policy' ||
          ![
            'Approval Authority',
            'Procedures and Requirements',
            'Scenario business context',
          ].includes(source.section))
      )
        fail(
          'evaluation',
          `${question.id}: unmapped section locator ${source.section}`,
        );
    }
    for (const id of question.entities)
      globalRef('evaluation', question.id, id);
    for (const id of question.policies)
      ref('evaluation', question.id, 'policy', id);
    for (const id of question.scenarios)
      ref('evaluation', question.id, 'scenario', id);
    for (const value of question.systems)
      ref('evaluation', question.id, 'system', systemId(value));
  }
  for (const [category, copy] of Object.entries(corpus.questionCopies)) {
    if (
      JSON.stringify(copy) !==
      JSON.stringify(r.question.filter((q) => q.category === category))
    )
      fail(
        'evaluation',
        `${category}: category copy differs from questions.json`,
      );
  }
  return issues;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  loadCorpus()
    .then((corpus) => {
      const issues = validateDataModel(corpus);
      for (const issue of issues)
        console.error(`ERROR [${issue.group}] ${issue.message}`);
      console.log(
        `Data model: ${issues.length ? 'FAIL' : 'PASS'} (${issues.length} errors; ${corpus.records.scenario.length} scenarios; ${corpus.records.question.length} questions)`,
      );
      console.log(
        'NOTE: Approval routing merges department tiers; null authority objects mean absent authority. See docs/data-model/business-rules.md.',
      );
      process.exitCode = issues.length ? 1 : 0;
    })
    .catch((error: unknown) => {
      console.error('Data-model validation failed:', error);
      process.exitCode = 1;
    });
}
