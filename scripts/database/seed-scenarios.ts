import type { Prisma } from '@/generated/prisma/client.js';
import { metadata } from '../validate-data-model.js';
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
  | 'policyId';

const TYPE_TO_FIELD: Record<string, TypedField> = {
  company: 'companyId',
  department: 'departmentId',
  role: 'roleId',
  employee: 'employeeId',
  location: 'locationId',
  system: 'systemId',
  costCenter: 'costCenterId',
  warehouse: 'warehouseId',
  supplier: 'supplierId',
  product: 'productId',
  customer: 'customerId',
  inventory: 'inventoryId',
  policy: 'policyId',
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
}

async function loadReferenceData(): Promise<ReferenceData> {
  const byId = <T extends Record<string, any>>(rows: T[], key: string) =>
    new Map(rows.map((row) => [row[key], row]));
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
  };
}

function resolveSystemId(value: string, data: ReferenceData): string {
  if (data.systems.has(value)) return value;
  for (const s of data.systems.values()) if (s.name === value) return s.systemId;
  throw new Error(`Unresolved system reference: ${value}`);
}

/** Mirrors validate-data-model.ts's globalRef: exactly one collection must contain the ID. */
function resolveGlobalType(id: string, data: ReferenceData): string {
  const matches: string[] = [];
  if (data.companies.has(id)) matches.push('company');
  if (data.departments.has(id)) matches.push('department');
  if (data.roles.has(id)) matches.push('role');
  if (data.employees.has(id)) matches.push('employee');
  if (data.locations.has(id)) matches.push('location');
  if (data.systems.has(id)) matches.push('system');
  if (data.costCenters.has(id)) matches.push('costCenter');
  if (data.warehouses.has(id)) matches.push('warehouse');
  if (data.suppliers.has(id)) matches.push('supplier');
  if (data.products.has(id)) matches.push('product');
  if (data.customers.has(id)) matches.push('customer');
  if (data.inventory.has(id)) matches.push('inventory');
  if (data.policies.has(id)) matches.push('policy');
  if (matches.length !== 1)
    throw new Error(
      `Cannot uniquely resolve entity ${id}: ${matches.length === 0 ? 'no match' : `ambiguous (${matches.join(', ')})`}`,
    );
  return matches[0]!;
}

function displayName(type: string, id: string, data: ReferenceData): string {
  switch (type) {
    case 'company':
      return data.companies.get(id)!.tradingName;
    case 'department':
      return data.departments.get(id)!.name;
    case 'role':
      return data.roles.get(id)!.title;
    case 'employee': {
      const e = data.employees.get(id)!;
      return `${e.firstName} ${e.lastName}`;
    }
    case 'location':
      return data.locations.get(id)!.name;
    case 'system':
      return data.systems.get(id)!.name;
    case 'costCenter':
      return data.costCenters.get(id)!.name;
    case 'warehouse':
      return data.warehouses.get(id)!.name;
    case 'supplier': {
      const s = data.suppliers.get(id)!;
      return s.tradingName ?? s.legalName;
    }
    case 'product':
      return data.products.get(id)!.name;
    case 'customer': {
      const c = data.customers.get(id)!;
      return c.tradingName ?? c.legalName;
    }
    case 'inventory': {
      const i = data.inventory.get(id)!;
      return `${i.productId} @ ${i.warehouseId}`;
    }
    case 'policy':
      return metadata(data.policies.get(id)!, 'Title') ?? id;
    default:
      throw new Error(`Unknown entity type: ${type}`);
  }
}

interface EntityRow {
  entityOrdinal: number;
  sourceType: string;
  sourceId: string;
  name: string;
  origin: string;
  sourceOrdinal: number | null;
  field: TypedField;
  targetId: string;
}

/**
 * Builds the deterministic scenario_entities row set for one scenario:
 * original entities[], then policies[] membership, then systems[]
 * membership, then any relationship endpoint not already covered, as a
 * derived `relationship_endpoint` node (docs/data-model/evaluation-model.md).
 */
function buildEntityRows(
  scenario: any,
  data: ReferenceData,
): { rows: EntityRow[]; resolve: (id: string) => number } {
  const rows: EntityRow[] = [];
  let ordinal = 0;
  // Original entity rows take priority; membership rows are a fallback;
  // derived nodes are created only when neither resolves the endpoint.
  const originals = new Map<string, number>();
  const membership = new Map<string, number>();

  for (const [i, e] of scenario.entities.entries()) {
    ordinal += 1;
    const field = TYPE_TO_FIELD[e.type];
    if (!field) throw new Error(`${scenario.id}: unknown entity type ${e.type}`);
    rows.push({
      entityOrdinal: ordinal,
      sourceType: e.type,
      sourceId: e.id,
      name: e.name,
      origin: 'entities',
      sourceOrdinal: i + 1,
      field,
      targetId: e.id,
    });
    if (!originals.has(e.id)) originals.set(e.id, ordinal);
  }

  for (const [i, policyId] of (scenario.policies as string[]).entries()) {
    ordinal += 1;
    rows.push({
      entityOrdinal: ordinal,
      sourceType: 'policy',
      sourceId: policyId,
      name: displayName('policy', policyId, data),
      origin: 'policies',
      sourceOrdinal: i + 1,
      field: 'policyId',
      targetId: policyId,
    });
    if (!membership.has(policyId)) membership.set(policyId, ordinal);
  }

  for (const [i, name] of (scenario.systems as string[]).entries()) {
    ordinal += 1;
    const systemId = resolveSystemId(name, data);
    rows.push({
      entityOrdinal: ordinal,
      sourceType: 'system',
      sourceId: name,
      name,
      origin: 'systems',
      sourceOrdinal: i + 1,
      field: 'systemId',
      targetId: systemId,
    });
    if (!membership.has(systemId)) membership.set(systemId, ordinal);
  }

  const derived = new Map<string, number>();
  const resolve = (id: string): number => {
    const existing = originals.get(id) ?? membership.get(id) ?? derived.get(id);
    if (existing !== undefined) return existing;
    const type = resolveGlobalType(id, data);
    const field = TYPE_TO_FIELD[type];
    if (!field) throw new Error(`${scenario.id}: unsupported derived type ${type} for ${id}`);
    ordinal += 1;
    rows.push({
      entityOrdinal: ordinal,
      sourceType: type,
      sourceId: id,
      name: displayName(type, id, data),
      origin: 'relationship_endpoint',
      sourceOrdinal: null,
      field,
      targetId: id,
    });
    derived.set(id, ordinal);
    return ordinal;
  };

  for (const rel of scenario.relationships) {
    resolve(rel.from);
    resolve(rel.to);
  }

  return { rows, resolve };
}

export async function seedScenarios(tx: Prisma.TransactionClient): Promise<void> {
  const data = await loadReferenceData();
  const scenarios = await readScenarioFiles();

  for (const scenario of Object.values(scenarios)) {
    await tx.scenario.upsert({
      where: { scenarioId: scenario.id },
      create: {
        scenarioId: scenario.id,
        category: scenario.category,
        title: scenario.title,
        description: scenario.description,
        businessContext: scenario.businessContext,
        expectedOutcome: scenario.expectedOutcome,
        difficulty: scenario.difficulty,
        questionTypes: scenario.questionTypes,
        tags: scenario.tags,
        relevantFacts: scenario.relevantFacts,
        requiredReasoning: scenario.requiredReasoning,
      },
      update: {
        category: scenario.category,
        title: scenario.title,
        description: scenario.description,
        businessContext: scenario.businessContext,
        expectedOutcome: scenario.expectedOutcome,
        difficulty: scenario.difficulty,
        questionTypes: scenario.questionTypes,
        tags: scenario.tags,
        relevantFacts: scenario.relevantFacts,
        requiredReasoning: scenario.requiredReasoning,
      },
    });

    for (const [i, actor] of scenario.actors.entries()) {
      await tx.scenarioActor.upsert({
        where: { scenarioId_actorOrdinal: { scenarioId: scenario.id, actorOrdinal: i + 1 } },
        create: {
          scenarioId: scenario.id,
          actorOrdinal: i + 1,
          employeeId: actor.employeeId,
          roleId: actor.roleId,
          departmentId: actor.departmentId,
          name: actor.name,
          roleTitle: actor.role,
        },
        update: {
          employeeId: actor.employeeId,
          roleId: actor.roleId,
          departmentId: actor.departmentId,
          name: actor.name,
          roleTitle: actor.role,
        },
      });
    }

    const { rows, resolve } = buildEntityRows(scenario, data);
    for (const row of rows) {
      await tx.scenarioEntity.upsert({
        where: {
          scenarioId_entityOrdinal: { scenarioId: scenario.id, entityOrdinal: row.entityOrdinal },
        },
        create: {
          scenarioId: scenario.id,
          entityOrdinal: row.entityOrdinal,
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          name: row.name,
          origin: row.origin,
          sourceOrdinal: row.sourceOrdinal,
          [row.field]: row.targetId,
        },
        update: {
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          name: row.name,
          origin: row.origin,
          sourceOrdinal: row.sourceOrdinal,
          [row.field]: row.targetId,
        },
      });
    }

    for (const event of scenario.events) {
      await tx.scenarioEvent.upsert({
        where: { scenarioId_sequence: { scenarioId: scenario.id, sequence: event.sequence } },
        create: { scenarioId: scenario.id, sequence: event.sequence, event: event.event },
        update: { event: event.event },
      });
    }

    for (const [i, rel] of scenario.relationships.entries()) {
      const fromEntityOrdinal = resolve(rel.from);
      const toEntityOrdinal = resolve(rel.to);
      await tx.scenarioRelationship.upsert({
        where: {
          scenarioId_relationshipOrdinal: {
            scenarioId: scenario.id,
            relationshipOrdinal: i + 1,
          },
        },
        create: {
          scenarioId: scenario.id,
          relationshipOrdinal: i + 1,
          fromEntityOrdinal,
          toEntityOrdinal,
          type: rel.type,
          fromSourceId: rel.from,
          toSourceId: rel.to,
        },
        update: {
          fromEntityOrdinal,
          toEntityOrdinal,
          type: rel.type,
          fromSourceId: rel.from,
          toSourceId: rel.to,
        },
      });
    }
  }
}
