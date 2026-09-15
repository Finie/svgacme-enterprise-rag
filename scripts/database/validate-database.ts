/**
 * Connects to PostgreSQL and verifies the seeded database against the
 * generated source corpus under data/. Read-only: never writes to the
 * database or to data/. Companion to scripts/validate-data-model.ts, which
 * validates the source corpus itself without a database.
 */
import { metadata, policySections } from '../validate-data-model.js';
import { createPrismaClient } from './lib/client.js';
import { readJson, readPolicyFiles, readScenarioFiles } from './lib/paths.js';

interface Issue {
  group: string;
  message: string;
}

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  const issues: Issue[] = [];
  const fail = (group: string, message: string) => issues.push({ group, message });

  try {
    // -----------------------------------------------------------------
    // Row counts against source
    // -----------------------------------------------------------------
    const company = await readJson<any>('enterprise/company.json');
    const departments = await readJson<any[]>('enterprise/departments.json');
    const roles = await readJson<any[]>('enterprise/roles.json');
    const employees = await readJson<any[]>('enterprise/employees.json');
    const locations = await readJson<any[]>('enterprise/locations.json');
    const systems = await readJson<any[]>('enterprise/systems.json');
    const costCenters = await readJson<any[]>('master-data/cost-centers.json');
    const warehouses = await readJson<any[]>('master-data/warehouses.json');
    const suppliers = await readJson<any[]>('master-data/suppliers.json');
    const products = await readJson<any[]>('master-data/products.json');
    const customers = await readJson<any[]>('master-data/customers.json');
    const inventory = await readJson<any[]>('master-data/inventory.json');
    const policies = await readPolicyFiles();
    const scenarios = await readScenarioFiles();
    const questions = await readJson<any[]>('test-questions/questions.json');

    const expectRowCount = async (
      group: string,
      label: string,
      expected: number,
      actual: () => Promise<number>,
    ) => {
      const count = await actual();
      if (count !== expected) fail(group, `${label}: expected ${expected} rows, found ${count}`);
    };

    await expectRowCount('counts', 'companies', 1, () => prisma.company.count());
    await expectRowCount('counts', 'departments', departments.length, () => prisma.department.count());
    await expectRowCount('counts', 'roles', roles.length, () => prisma.role.count());
    await expectRowCount('counts', 'employees', employees.length, () => prisma.employee.count());
    await expectRowCount('counts', 'locations', locations.length, () => prisma.location.count());
    await expectRowCount('counts', 'systems', systems.length, () => prisma.system.count());
    await expectRowCount('counts', 'cost_centers', costCenters.length, () => prisma.costCenter.count());
    await expectRowCount('counts', 'warehouses', warehouses.length, () => prisma.warehouse.count());
    await expectRowCount('counts', 'suppliers', suppliers.length, () => prisma.supplier.count());
    await expectRowCount('counts', 'products', products.length, () => prisma.product.count());
    await expectRowCount('counts', 'customers', customers.length, () => prisma.customer.count());
    await expectRowCount('counts', 'inventory', inventory.length, () => prisma.inventory.count());
    await expectRowCount('counts', 'policies', Object.keys(policies).length, () => prisma.policy.count());
    await expectRowCount('counts', 'scenarios', Object.keys(scenarios).length, () => prisma.scenario.count());
    await expectRowCount('counts', 'evaluation_questions', questions.length, () =>
      prisma.evaluationQuestion.count(),
    );

    let expectedAccess = 0;
    for (const r of roles) expectedAccess += r.systemAccessProfile.length;
    await expectRowCount('counts', 'role_system_access', expectedAccess, () =>
      prisma.roleSystemAccess.count(),
    );

    let expectedProductSuppliers = 0;
    for (const p of products) expectedProductSuppliers += p.supplierIds.length;
    await expectRowCount('counts', 'product_suppliers', expectedProductSuppliers, () =>
      prisma.productSupplier.count(),
    );

    let expectedSections = 0;
    let expectedRelationships = 0;
    let expectedPolicySystems = 0;
    for (const md of Object.values(policies)) {
      expectedSections += policySections(md).length;
      const related = policySections(md).find((s) => s.heading.trim() === 'RELATED POLICIES');
      expectedRelationships += related ? [...related.body.matchAll(/^- ([A-Z]+-POL-\d{3}):/gm)].length : 0;
      expectedPolicySystems += (metadata(md, 'System') ?? '').split(';').filter((s) => s.trim()).length;
    }
    await expectRowCount('counts', 'policy_sections', expectedSections, () => prisma.policySection.count());
    await expectRowCount('counts', 'policy_relationships', expectedRelationships, () =>
      prisma.policyRelationship.count(),
    );
    await expectRowCount('counts', 'policy_systems', expectedPolicySystems, () => prisma.policySystem.count());

    let expectedActors = 0;
    let expectedEvents = 0;
    let expectedScenarioRelationships = 0;
    for (const s of Object.values<any>(scenarios)) {
      expectedActors += s.actors.length;
      expectedEvents += s.events.length;
      expectedScenarioRelationships += s.relationships.length;
    }
    await expectRowCount('counts', 'scenario_actors', expectedActors, () => prisma.scenarioActor.count());
    await expectRowCount('counts', 'scenario_events', expectedEvents, () => prisma.scenarioEvent.count());
    await expectRowCount('counts', 'scenario_relationships', expectedScenarioRelationships, () =>
      prisma.scenarioRelationship.count(),
    );

    let expectedSources = 0;
    for (const q of questions)
      expectedSources +=
        q.requiredSources.length + q.entities.length + q.systems.length + q.policies.length + q.scenarios.length;
    await expectRowCount('counts', 'evaluation_question_sources', expectedSources, () =>
      prisma.evaluationQuestionSource.count(),
    );

    // -----------------------------------------------------------------
    // Row-level equivalence for core enterprise + master data
    // -----------------------------------------------------------------
    const dbCompany = await prisma.company.findUnique({ where: { companyId: company.companyId } });
    if (!dbCompany) fail('company', `${company.companyId}: missing from database`);
    else if (dbCompany.headquartersLocationId !== company.headquarters.locationId)
      fail('company', `${company.companyId}: headquarters_location_id mismatch`);

    for (const d of departments) {
      const row = await prisma.department.findUnique({ where: { departmentId: d.departmentId } });
      if (!row) fail('departments', `${d.departmentId}: missing from database`);
      else if (
        row.name !== d.name ||
        row.departmentHeadRoleId !== d.departmentHeadRoleId ||
        row.costCenterId !== d.costCenterCode
      )
        fail('departments', `${d.departmentId}: field mismatch against source`);
    }

    for (const e of employees) {
      const row = await prisma.employee.findUnique({ where: { employeeId: e.employeeId } });
      if (!row) fail('employees', `${e.employeeId}: missing from database`);
      else if (
        row.roleId !== e.roleId ||
        row.departmentId !== e.departmentId ||
        row.managerEmployeeId !== e.managerEmployeeId ||
        row.email !== e.email
      )
        fail('employees', `${e.employeeId}: field mismatch against source`);
    }

    for (const p of products) {
      const row = await prisma.product.findUnique({ where: { productId: p.productId } });
      if (!row) fail('products', `${p.productId}: missing from database`);
      else if (Number(row.unitCost) !== p.unitCost || Number(row.sellingPrice) !== p.sellingPrice)
        fail('products', `${p.productId}: price mismatch against source`);
    }

    // -----------------------------------------------------------------
    // Referential integrity beyond what FK constraints already guarantee:
    // spot-check that a sample of resolved relations match source values.
    // -----------------------------------------------------------------
    const root = employees.find((e) => e.managerEmployeeId === null);
    if (!root) fail('hierarchy', 'no root employee (nullable manager) found in source');
    else {
      const rootRow = await prisma.employee.findUnique({ where: { employeeId: root.employeeId } });
      if (rootRow?.managerEmployeeId !== null)
        fail('hierarchy', `${root.employeeId}: expected null manager in database`);
    }

    // -----------------------------------------------------------------
    // Inventory invariant (defense in depth: the CHECK constraint already
    // makes this impossible, so any failure here means the constraint was
    // bypassed or dropped).
    // -----------------------------------------------------------------
    const badInventory = await prisma.$queryRaw<{ inventory_id: string }[]>`
      SELECT inventory_id FROM inventory
      WHERE quantity_available <> quantity_on_hand - quantity_reserved
    `;
    for (const row of badInventory)
      fail('inventory', `${row.inventory_id}: available != on_hand - reserved`);
    const negativeInventory = await prisma.$queryRaw<{ inventory_id: string }[]>`
      SELECT inventory_id FROM inventory
      WHERE quantity_on_hand < 0 OR quantity_reserved < 0 OR quantity_available < 0
    `;
    for (const row of negativeInventory) fail('inventory', `${row.inventory_id}: negative quantity`);

    // -----------------------------------------------------------------
    // Product/supplier many-to-many completeness and non-duplication
    // -----------------------------------------------------------------
    const junctionPairs = await prisma.productSupplier.findMany();
    const junctionSet = new Set(junctionPairs.map((r) => `${r.productId}/${r.supplierId}`));
    if (junctionSet.size !== junctionPairs.length)
      fail('product_suppliers', 'duplicate (product_id, supplier_id) pairs in database');
    const sourcePairs = new Set<string>();
    for (const p of products) for (const s of p.supplierIds) sourcePairs.add(`${p.productId}/${s}`);
    for (const pair of sourcePairs)
      if (!junctionSet.has(pair)) fail('product_suppliers', `missing pair in database: ${pair}`);
    for (const pair of junctionSet)
      if (!sourcePairs.has(pair)) fail('product_suppliers', `unexpected pair in database: ${pair}`);

    // -----------------------------------------------------------------
    // Policy reconstruction: DB sections must reproduce source ordering,
    // headings and body text exactly, for every policy.
    // -----------------------------------------------------------------
    for (const [policyId, markdown] of Object.entries(policies)) {
      const sourceSections = policySections(markdown);
      const dbSections = await prisma.policySection.findMany({
        where: { policyId },
        orderBy: { sectionOrdinal: 'asc' },
      });
      if (dbSections.length !== sourceSections.length) {
        fail(
          'policy-reconstruction',
          `${policyId}: expected ${sourceSections.length} sections, found ${dbSections.length}`,
        );
        continue;
      }
      dbSections.forEach((dbSection, i) => {
        const source = sourceSections[i]!;
        if (dbSection.sectionOrdinal !== source.ordinal)
          fail('policy-reconstruction', `${policyId}: section ${i + 1} ordinal mismatch`);
        if (dbSection.heading !== source.heading.trim())
          fail('policy-reconstruction', `${policyId}: section ${source.ordinal} heading mismatch`);
        if (dbSection.bodyMarkdown !== source.body.trim())
          fail('policy-reconstruction', `${policyId}: section ${source.ordinal} body mismatch`);
      });
    }

    // -----------------------------------------------------------------
    // Scenario reconstruction: actors/entities/events/relationships must be
    // imported without loss (entities count includes derived endpoint nodes,
    // so it is checked as >= the source array lengths, not equality).
    // -----------------------------------------------------------------
    for (const [file, scenario] of Object.entries<any>(scenarios)) {
      if (scenario.id !== file) fail('scenario-reconstruction', `${file}: id mismatch (${scenario.id})`);
      const [actors, entities, events, relationships] = await Promise.all([
        prisma.scenarioActor.count({ where: { scenarioId: scenario.id } }),
        prisma.scenarioEntity.count({ where: { scenarioId: scenario.id } }),
        prisma.scenarioEvent.count({ where: { scenarioId: scenario.id } }),
        prisma.scenarioRelationship.count({ where: { scenarioId: scenario.id } }),
      ]);
      if (actors !== scenario.actors.length)
        fail('scenario-reconstruction', `${scenario.id}: actor count mismatch`);
      const expectedEntityMin = scenario.entities.length + scenario.policies.length + scenario.systems.length;
      if (entities < expectedEntityMin)
        fail('scenario-reconstruction', `${scenario.id}: entity rows lost (found ${entities}, expected >= ${expectedEntityMin})`);
      if (events !== scenario.events.length)
        fail('scenario-reconstruction', `${scenario.id}: event count mismatch`);
      if (relationships !== scenario.relationships.length)
        fail('scenario-reconstruction', `${scenario.id}: relationship count mismatch`);

      const dbEvents = await prisma.scenarioEvent.findMany({
        where: { scenarioId: scenario.id },
        orderBy: { sequence: 'asc' },
      });
      scenario.events.forEach((event: any, i: number) => {
        if (dbEvents[i]?.sequence !== event.sequence || dbEvents[i]?.event !== event.event)
          fail('scenario-reconstruction', `${scenario.id}: event ${i + 1} content mismatch`);
      });
    }

    // -----------------------------------------------------------------
    // Evaluation reconstruction: every question and its expected
    // behavior/source references must be preserved exactly.
    // -----------------------------------------------------------------
    for (const q of questions) {
      const row = await prisma.evaluationQuestion.findUnique({ where: { questionId: q.id } });
      if (!row) {
        fail('evaluation-reconstruction', `${q.id}: missing from database`);
        continue;
      }
      if (
        row.question !== q.question ||
        row.expectedAnswer !== q.expectedAnswer ||
        row.expectedBehavior !== q.expectedBehavior ||
        row.category !== q.category
      )
        fail('evaluation-reconstruction', `${q.id}: field mismatch against source`);
      const sourceCount =
        q.requiredSources.length + q.entities.length + q.systems.length + q.policies.length + q.scenarios.length;
      const dbCount = await prisma.evaluationQuestionSource.count({ where: { questionId: q.id } });
      if (dbCount !== sourceCount)
        fail(
          'evaluation-reconstruction',
          `${q.id}: expected ${sourceCount} source rows, found ${dbCount}`,
        );
    }
  } finally {
    await prisma.$disconnect();
  }

  for (const issue of issues) console.error(`ERROR [${issue.group}] ${issue.message}`);
  console.log(`Database validation: ${issues.length ? 'FAIL' : 'PASS'} (${issues.length} errors)`);
  process.exitCode = issues.length ? 1 : 0;
}

main().catch((error: unknown) => {
  console.error('Database validation crashed:', error);
  process.exitCode = 1;
});
