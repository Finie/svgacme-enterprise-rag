import type { Prisma } from '@/generated/prisma/client.js';
import { policySections } from '../validate-data-model.js';
import { readJson, readPolicyFiles, readScenarioFiles } from './lib/paths.js';

type TypedField =
  | 'companyId'
  | 'departmentId'
  | 'roleId'
  | 'employeeId'
  | 'locationId'
  | 'systemId'
  | 'costCenterId'
  | 'warehouseId'
  | 'supplierId'
  | 'productId'
  | 'customerId'
  | 'inventoryId'
  | 'policyId'
  | 'scenarioId';

// requiredSources[].type spelling (evaluation-model.md: "Preserve `cost-center`
// as the original type spelling"). Derived reference_kind rows (entities/
// systems/policies/scenarios) reuse this same vocabulary for consistency.
const FIELD_BY_TYPE: Record<string, TypedField> = {
  company: 'companyId',
  department: 'departmentId',
  role: 'roleId',
  employee: 'employeeId',
  location: 'locationId',
  system: 'systemId',
  'cost-center': 'costCenterId',
  warehouse: 'warehouseId',
  supplier: 'supplierId',
  product: 'productId',
  customer: 'customerId',
  inventory: 'inventoryId',
  policy: 'policyId',
  scenario: 'scenarioId',
};

interface ReferenceData {
  companies: Map<string, any>;
  departments: Map<string, any>;
  roles: Map<string, any>;
  employees: Map<string, any>;
  locations: Map<string, any>;
  systems: Map<string, any>;
  costCenters: Map<string, any>;
  warehouses: Map<string, any>;
  suppliers: Map<string, any>;
  products: Map<string, any>;
  customers: Map<string, any>;
  inventory: Map<string, any>;
  policies: Map<string, string>;
  scenarioIds: Set<string>;
}

async function loadReferenceData(): Promise<ReferenceData> {
  const byId = <T extends Record<string, any>>(rows: T[], key: string) =>
    new Map(rows.map((row) => [row[key], row]));
  const scenarios = await readScenarioFiles();
  return {
    companies: byId(await readJson<any>('enterprise/company.json').then((c) => [c]), 'companyId'),
    departments: byId(await readJson<any[]>('enterprise/departments.json'), 'departmentId'),
    roles: byId(await readJson<any[]>('enterprise/roles.json'), 'roleId'),
    employees: byId(await readJson<any[]>('enterprise/employees.json'), 'employeeId'),
    locations: byId(await readJson<any[]>('enterprise/locations.json'), 'locationId'),
    systems: byId(await readJson<any[]>('enterprise/systems.json'), 'systemId'),
    costCenters: byId(await readJson<any[]>('master-data/cost-centers.json'), 'costCenterId'),
    warehouses: byId(await readJson<any[]>('master-data/warehouses.json'), 'warehouseId'),
    suppliers: byId(await readJson<any[]>('master-data/suppliers.json'), 'supplierId'),
    products: byId(await readJson<any[]>('master-data/products.json'), 'productId'),
    customers: byId(await readJson<any[]>('master-data/customers.json'), 'customerId'),
    inventory: byId(await readJson<any[]>('master-data/inventory.json'), 'inventoryId'),
    policies: new Map(Object.entries(await readPolicyFiles())),
    scenarioIds: new Set(Object.values(scenarios).map((s: any) => s.id)),
  };
}

function resolveSystemId(value: string, data: ReferenceData): string {
  if (data.systems.has(value)) return value;
  for (const s of data.systems.values()) if (s.name === value) return s.systemId;
  throw new Error(`Unresolved system reference: ${value}`);
}

/** Mirrors validate-data-model.ts's globalRef, with scenario as a 14th candidate type. */
function resolveGlobalLabel(id: string, data: ReferenceData): string {
  const matches: string[] = [];
  if (data.companies.has(id)) matches.push('company');
  if (data.departments.has(id)) matches.push('department');
  if (data.roles.has(id)) matches.push('role');
  if (data.employees.has(id)) matches.push('employee');
  if (data.locations.has(id)) matches.push('location');
  if (data.systems.has(id)) matches.push('system');
  if (data.costCenters.has(id)) matches.push('cost-center');
  if (data.warehouses.has(id)) matches.push('warehouse');
  if (data.suppliers.has(id)) matches.push('supplier');
  if (data.products.has(id)) matches.push('product');
  if (data.customers.has(id)) matches.push('customer');
  if (data.inventory.has(id)) matches.push('inventory');
  if (data.policies.has(id)) matches.push('policy');
  if (data.scenarioIds.has(id)) matches.push('scenario');
  if (matches.length !== 1)
    throw new Error(
      `Cannot uniquely resolve entity ${id}: ${matches.length === 0 ? 'no match' : `ambiguous (${matches.join(', ')})`}`,
    );
  return matches[0]!;
}

interface SourceRow {
  referenceKind: string;
  sourceOrdinal: number;
  type: string;
  sourceId: string;
  section: string | null;
  field: TypedField;
  targetId: string;
  policySectionOrdinal: number | null;
}

function resolvePolicySectionOrdinal(
  type: string,
  policyId: string,
  section: string | undefined,
  policies: Map<string, string>,
): number | null {
  // Only "Procedures and Requirements" is an exact heading locator
  // (evaluation-model.md); the other two section locators are semantic
  // labels preserved as text with no section FK.
  if (type !== 'policy' || section !== 'Procedures and Requirements') return null;
  const markdown = policies.get(policyId);
  if (!markdown) return null;
  const match = policySections(markdown).find(
    (s) => s.heading.trim().toUpperCase() === 'PROCEDURES AND REQUIREMENTS',
  );
  return match?.ordinal ?? null;
}

function buildSourceRows(question: any, data: ReferenceData): SourceRow[] {
  const rows: SourceRow[] = [];

  question.requiredSources.forEach((source: { type: string; id: string; section?: string }, i: number) => {
    const field = FIELD_BY_TYPE[source.type];
    if (!field) throw new Error(`${question.id}: unknown source type ${source.type}`);
    rows.push({
      referenceKind: 'required',
      sourceOrdinal: i + 1,
      type: source.type,
      sourceId: source.id,
      section: source.section ?? null,
      field,
      targetId: source.id,
      policySectionOrdinal: resolvePolicySectionOrdinal(source.type, source.id, source.section, data.policies),
    });
  });

  (question.entities as string[]).forEach((id, i) => {
    const label = resolveGlobalLabel(id, data);
    rows.push({
      referenceKind: 'entities',
      sourceOrdinal: i + 1,
      type: label,
      sourceId: id,
      section: null,
      field: FIELD_BY_TYPE[label]!,
      targetId: id,
      policySectionOrdinal: null,
    });
  });

  (question.systems as string[]).forEach((value, i) => {
    const systemId = resolveSystemId(value, data);
    rows.push({
      referenceKind: 'systems',
      sourceOrdinal: i + 1,
      type: 'system',
      sourceId: value,
      section: null,
      field: 'systemId',
      targetId: systemId,
      policySectionOrdinal: null,
    });
  });

  (question.policies as string[]).forEach((id, i) => {
    rows.push({
      referenceKind: 'policies',
      sourceOrdinal: i + 1,
      type: 'policy',
      sourceId: id,
      section: null,
      field: 'policyId',
      targetId: id,
      policySectionOrdinal: null,
    });
  });

  (question.scenarios as string[]).forEach((id, i) => {
    rows.push({
      referenceKind: 'scenarios',
      sourceOrdinal: i + 1,
      type: 'scenario',
      sourceId: id,
      section: null,
      field: 'scenarioId',
      targetId: id,
      policySectionOrdinal: null,
    });
  });

  return rows;
}

interface QuestionRow {
  id: string;
  prefix: string;
  question: string;
  category: string;
  subcategory: string;
  difficulty: string;
  answerability: string;
  expectedAnswer: string;
  expectedBehavior: string;
  acceptableAnswerPoints: string[];
  reasoningSteps: string[];
  tags: string[];
  requiredSources: { type: string; id: string; section?: string }[];
  entities: string[];
  systems: string[];
  policies: string[];
  scenarios: string[];
}

/**
 * Seeds evaluation_questions and evaluation_question_sources from the
 * canonical questions.json only; data/test-questions/categories/*.json are
 * materialized duplicate subsets, never re-ingested (evaluation-model.md).
 */
export async function seedEvaluation(tx: Prisma.TransactionClient): Promise<void> {
  const data = await loadReferenceData();
  const questions = await readJson<QuestionRow[]>('test-questions/questions.json');

  for (const q of questions) {
    await tx.evaluationQuestion.upsert({
      where: { questionId: q.id },
      create: {
        questionId: q.id,
        prefix: q.prefix,
        question: q.question,
        category: q.category,
        subcategory: q.subcategory,
        difficulty: q.difficulty,
        answerability: q.answerability,
        expectedAnswer: q.expectedAnswer,
        expectedBehavior: q.expectedBehavior,
        acceptableAnswerPoints: q.acceptableAnswerPoints,
        reasoningSteps: q.reasoningSteps,
        tags: q.tags,
      },
      update: {
        prefix: q.prefix,
        question: q.question,
        category: q.category,
        subcategory: q.subcategory,
        difficulty: q.difficulty,
        answerability: q.answerability,
        expectedAnswer: q.expectedAnswer,
        expectedBehavior: q.expectedBehavior,
        acceptableAnswerPoints: q.acceptableAnswerPoints,
        reasoningSteps: q.reasoningSteps,
        tags: q.tags,
      },
    });

    for (const row of buildSourceRows(q, data)) {
      await tx.evaluationQuestionSource.upsert({
        where: {
          questionId_referenceKind_sourceOrdinal: {
            questionId: q.id,
            referenceKind: row.referenceKind,
            sourceOrdinal: row.sourceOrdinal,
          },
        },
        create: {
          questionId: q.id,
          referenceKind: row.referenceKind,
          sourceOrdinal: row.sourceOrdinal,
          type: row.type,
          sourceId: row.sourceId,
          section: row.section,
          policySectionOrdinal: row.policySectionOrdinal,
          [row.field]: row.targetId,
        },
        update: {
          type: row.type,
          sourceId: row.sourceId,
          section: row.section,
          policySectionOrdinal: row.policySectionOrdinal,
          [row.field]: row.targetId,
        },
      });
    }
  }
}
