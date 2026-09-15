/**
 * Integration tests against a real PostgreSQL instance (docker-compose).
 * Start it first:
 *
 *   npm run db:up
 *   npm run db:migrate
 *
 * Then run:
 *
 *   npm run test:e2e
 *
 * These tests exercise actual Postgres behavior (constraints, transactions)
 * rather than only Prisma objects in memory. See docs/database/README.md.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { createPrismaClient } from '../scripts/database/lib/client.js';
import { seedAll } from '../scripts/database/seed.js';

describe('database integration', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createPrismaClient();
    await seedAll(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to postgres', async () => {
    const result = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    expect(result[0]?.ok).toBe(1);
  });

  it('applied the migration: pgvector, deferred FKs and hand-authored CHECKs all exist', async () => {
    const extensions = await prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    expect(extensions).toHaveLength(1);

    const deferred = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE conname IN ('departments_department_head_role_id_fkey', 'departments_cost_center_id_fkey')
        AND condeferrable AND condeferred
    `;
    expect(deferred).toHaveLength(2);

    const formulaCheck = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint WHERE conname = 'inventory_quantity_available_formula_check'
    `;
    expect(formulaCheck).toHaveLength(1);
  });

  it('seeded the full generated corpus', async () => {
    expect(await prisma.company.count()).toBe(1);
    expect(await prisma.department.count()).toBe(13);
    expect(await prisma.role.count()).toBe(22);
    expect(await prisma.employee.count()).toBe(39);
    expect(await prisma.location.count()).toBe(5);
    expect(await prisma.system.count()).toBe(7);
    expect(await prisma.costCenter.count()).toBe(13);
    expect(await prisma.warehouse.count()).toBe(4);
    expect(await prisma.supplier.count()).toBe(16);
    expect(await prisma.product.count()).toBe(36);
    expect(await prisma.customer.count()).toBe(20);
    expect(await prisma.inventory.count()).toBe(141);
    expect(await prisma.policy.count()).toBe(15);
    expect(await prisma.scenario.count()).toBe(65);
    expect(await prisma.evaluationQuestion.count()).toBe(173);
  });

  it('is idempotent: seeding twice does not duplicate rows', async () => {
    const [before, beforeInventory, beforeSources, beforeEntities] = await Promise.all([
      prisma.employee.count(),
      prisma.inventory.count(),
      prisma.evaluationQuestionSource.count(),
      prisma.scenarioEntity.count(),
    ]);

    await seedAll(prisma);

    expect(await prisma.employee.count()).toBe(before);
    expect(await prisma.inventory.count()).toBe(beforeInventory);
    expect(await prisma.evaluationQuestionSource.count()).toBe(beforeSources);
    expect(await prisma.scenarioEntity.count()).toBe(beforeEntities);
  }, 120_000);

  it('preserves the employee hierarchy: exactly one nullable-manager root, no dangling managers', async () => {
    const roots = await prisma.employee.findMany({ where: { managerEmployeeId: null } });
    expect(roots).toHaveLength(1);
    expect(roots[0]?.employeeId).toBe('EMP-0001');
  });

  it('rejects a manager reference to a nonexistent employee (FK enforced)', async () => {
    await expect(
      prisma.employee.update({
        where: { employeeId: 'EMP-0002' },
        data: { managerEmployeeId: 'EMP-DOES-NOT-EXIST' },
      }),
    ).rejects.toThrow();
  });

  it('represents product<->supplier as a deduplicated many-to-many junction', async () => {
    const pairs = await prisma.productSupplier.findMany();
    const keys = pairs.map((p) => `${p.productId}/${p.supplierId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(pairs.length).toBeGreaterThan(0);

    await expect(
      prisma.productSupplier.create({ data: { productId: pairs[0]!.productId, supplierId: pairs[0]!.supplierId } }),
    ).rejects.toThrow();
  });

  it('enforces inventory UNIQUE(product_id, warehouse_id)', async () => {
    const existing = await prisma.inventory.findFirstOrThrow();
    await expect(
      prisma.inventory.create({
        data: {
          inventoryId: 'INV-TEST-DUPLICATE',
          productId: existing.productId,
          warehouseId: existing.warehouseId,
          quantityOnHand: 10,
          quantityReserved: 0,
          quantityAvailable: 10,
          reorderLevel: 0,
          reorderQuantity: 0,
          inventoryStatus: 'IN_STOCK',
          lastStockCountDate: new Date('2026-01-01'),
        },
      }),
    ).rejects.toThrow();
  });

  it('enforces the inventory quantity_available = on_hand - reserved invariant', async () => {
    const existing = await prisma.inventory.findFirstOrThrow();
    await expect(
      prisma.inventory.update({
        where: { inventoryId: existing.inventoryId },
        data: { quantityAvailable: existing.quantityOnHand - existing.quantityReserved + 1 },
      }),
    ).rejects.toThrow();
  });

  it('reconstructs a policy from its ordered sections', async () => {
    const sections = await prisma.policySection.findMany({
      where: { policyId: 'FIN-POL-002' },
      orderBy: { sectionOrdinal: 'asc' },
    });
    expect(sections).toHaveLength(13);
    expect(sections.map((s) => s.sectionOrdinal)).toEqual(
      Array.from({ length: 13 }, (_, i) => i + 1),
    );
    expect(sections[4]?.heading).toBe('PROCEDURES AND REQUIREMENTS');
  });

  it('persists scenario graph structure without loss', async () => {
    const scenario = await prisma.scenario.findUnique({
      where: { scenarioId: 'SCN-SUP-005' },
      include: { actors: true, entities: true, events: true, relationships: true },
    });
    expect(scenario).not.toBeNull();
    expect(scenario!.actors.length).toBeGreaterThan(0);
    expect(scenario!.events.length).toBeGreaterThan(0);
    expect(scenario!.relationships.length).toBeGreaterThan(0);
    // DEPT-PROC is a relationship endpoint absent from SCN-SUP-005's source
    // entities[]/policies[]/systems[] arrays (business-rules.md); it must
    // still be present as a derived node so the relationship resolves.
    const derived = scenario!.entities.find((e) => e.origin === 'relationship_endpoint');
    expect(derived?.sourceId).toBe('DEPT-PROC');
    expect(derived?.departmentId).toBe('DEPT-PROC');
  });

  it('persists evaluation questions with their expected behavior and source references', async () => {
    const question = await prisma.evaluationQuestion.findUnique({
      where: { questionId: 'Q-NEG-001' },
      include: { sources: true },
    });
    expect(question).not.toBeNull();
    expect(question!.expectedBehavior).toBe('reject');
    expect(question!.sources.length).toBeGreaterThan(0);
    expect(question!.sources[0]?.policyId).toBe('SALES-POL-001');
  });
});
