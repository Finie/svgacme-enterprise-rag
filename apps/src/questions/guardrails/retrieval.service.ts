import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { SearchService } from '../../search/search.service.js';
import { policyNeeds } from './domains.js';
import type { Evidence, Retrieval, Route } from './types.js';

const stop = new Set(
  'what which who when where why how is are was were the a an of for to in on under and or can does do have has be by from with svga company enterprise ltd policy policies rules please tell me about it its s maximum amount should happen happens according explain describe state apply applies handled affects may expose through live new tracing than their actual normal treated receive requests requested require required recorded much about happen must into before after during does process begin'.split(
    ' ',
  ),
);
export function terms(q: string) {
  return [
    ...new Set(
      (q.toLowerCase().match(/[a-z]+/g) ?? [])
        .filter((t) => t.length > 2 && !stop.has(t))
        .map(
          (t) =>
            ({
              approval: 'approv',
              approve: 'approv',
              approved: 'approv',
              approving: 'approv',
              authorisation: 'authority',
              authorization: 'authority',
              authorised: 'authority',
              authorized: 'authority',
              available: 'availability',
              employees: 'employee',
              onboarding: 'onboard',
              provisioned: 'provision',
            })[t] ?? t.replace(/s$/, ''),
        ),
    ),
  ];
}
export function relevance(q: string, e: Evidence) {
  const query = terms(q);
  const source = new Set(terms(`${e.section ?? ''} ${e.content}`));
  return query.length
    ? query.filter((t) => source.has(t)).length / query.length
    : 0;
}
@Injectable()
export class RetrievalRouterService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(SearchService) private readonly search: SearchService,
  ) {}
  async retrieve(
    question: string,
    strategy: Route,
    topK: number,
  ): Promise<Retrieval> {
    const evidence: Evidence[] = [];
    const required: string[] = [];
    const add = (
      sourceId: string,
      section: string,
      data: unknown,
      covers: string[],
      facts?: Evidence['facts'],
    ) =>
      evidence.push({
        sourceType: 'structured',
        sourceId,
        section,
        content: JSON.stringify(data),
        score: 1,
        authoritative: true,
        covers,
        facts,
      });
    if (['STRUCTURED', 'HYBRID', 'CROSS_DOMAIN'].includes(strategy)) {
      const ids = [
        ...new Set(
          question
            .toUpperCase()
            .match(/\b(?:PROD|PRD|EMP|SUP|CUST|CUS|WH)-[A-Z0-9-]+\b/g) ?? [],
        ),
      ];
      required.push(...ids);
      let templateHandled = false;
      const lower = question.toLowerCase();
      const matches = (name: string) => lower.includes(name.toLowerCase());
      if (/\b(legal name|company profile)\b/i.test(question)) {
        templateHandled = true;
        const rows = await this.db.company.findMany({
          select: {
            companyId: true,
            legalName: true,
            employeeCount: true,
            employeeDatasetNote: true,
          },
        });
        for (const row of rows)
          add(row.companyId, 'Company profile', row, ['structured']);
      }
      if (/\bstatus of\b/i.test(question)) {
        templateHandled = true;
        const rows = await this.db.system.findMany({
          select: { systemId: true, name: true, status: true },
        });
        for (const row of rows.filter((r) => matches(r.name)))
          add(row.systemId, 'System status', row, ['structured']);
      }
      if (/\bwhich city\b/i.test(question)) {
        templateHandled = true;
        const rows = await this.db.warehouse.findMany({
          select: { warehouseId: true, name: true, city: true },
        });
        for (const row of rows.filter((r) => matches(r.name)))
          add(row.warehouseId, 'Warehouse city', row, ['structured']);
      }
      if (/\bcost cent(?:er|re)\b/i.test(question)) {
        templateHandled = true;
        const rows = await this.db.department.findMany({
          select: {
            departmentId: true,
            name: true,
            defaultCostCenter: {
              select: { costCenterId: true, code: true, name: true },
            },
          },
        });
        for (const row of rows.filter((r) => matches(r.name)))
          add(row.departmentId, 'Department cost center', row, ['structured']);
      }
      if (/\baccount manager\b/i.test(question)) {
        templateHandled = true;
        const rows = await this.db.customer.findMany({
          select: {
            customerId: true,
            legalName: true,
            tradingName: true,
            accountManager: {
              select: { employeeId: true, firstName: true, lastName: true },
            },
          },
        });
        for (const row of rows.filter(
          (r) => matches(r.legalName) || matches(r.tradingName),
        ))
          add(row.customerId, 'Customer account manager', row, ['structured']);
      }
      if (/\bwhich supplier provides\b/i.test(question)) {
        templateHandled = true;
        const rows = await this.db.product.findMany({
          select: {
            productId: true,
            name: true,
            productSuppliers: {
              select: {
                supplier: {
                  select: {
                    supplierId: true,
                    legalName: true,
                    approvalStatus: true,
                  },
                },
              },
            },
          },
        });
        for (const row of rows.filter((r) => matches(r.name)))
          add(row.productId, 'Product suppliers', row, ['structured']);
      }
      if (
        /\b(stock|units)\b/i.test(question) &&
        !ids.some((id) => /^(PROD|PRD)-/.test(id))
      ) {
        templateHandled = true;
        const products = await this.db.product.findMany({
          select: { productId: true, name: true },
        });
        const warehouses = await this.db.warehouse.findMany({
          select: { warehouseId: true, name: true },
        });
        const selectedProducts = products.filter((p) => matches(p.name));
        const selectedWarehouses = warehouses.filter((w) => matches(w.name));
        if (/\bat\b/i.test(question) && !selectedWarehouses.length)
          required.push('resolved_warehouse');
        for (const product of selectedProducts) {
          const rows = await this.db.inventory.findMany({
            where: {
              productId: product.productId,
              ...(selectedWarehouses.length
                ? {
                    warehouseId: {
                      in: selectedWarehouses.map((w) => w.warehouseId),
                    },
                  }
                : {}),
            },
            select: {
              inventoryId: true,
              productId: true,
              warehouseId: true,
              quantityAvailable: true,
              quantityOnHand: true,
              quantityReserved: true,
            },
          });
          for (const row of rows)
            add(
              row.inventoryId,
              'Named product inventory',
              {
                ...row,
                productName: product.name,
                warehouseName: warehouses.find(
                  (w) => w.warehouseId === row.warehouseId,
                )?.name,
              },
              ['structured', product.productId, row.warehouseId],
            );
        }
      }
      for (const id of ids) {
        if (id.startsWith('PROD-') || id.startsWith('PRD-')) {
          const rows = await this.db.inventory.findMany({
            where: {
              productId: id,
              ...(ids.some((i) => i.startsWith('WH-'))
                ? {
                    warehouseId: { in: ids.filter((i) => i.startsWith('WH-')) },
                  }
                : {}),
            },
            select: {
              inventoryId: true,
              productId: true,
              warehouseId: true,
              quantityOnHand: true,
              quantityReserved: true,
              quantityAvailable: true,
            },
          });
          for (const row of rows)
            add(row.inventoryId, 'Inventory availability', row, [
              id,
              row.warehouseId,
              'structured',
            ]);
        } else if (id.startsWith('EMP-')) {
          const row = await this.db.employee.findUnique({
            where: { employeeId: id },
            select: {
              employeeId: true,
              firstName: true,
              lastName: true,
              department: { select: { departmentId: true, name: true } },
              role: {
                select: { roleId: true, title: true, approvalAuthority: true },
              },
            },
          });
          if (row)
            add(id, 'Employee role and authority', row, [id, 'structured']);
        } else if (id.startsWith('SUP-')) {
          const row = await this.db.supplier.findUnique({
            where: { supplierId: id },
            select: {
              supplierId: true,
              legalName: true,
              approvalStatus: true,
              active: true,
              productSuppliers: { select: { productId: true } },
            },
          });
          if (row) add(id, 'Supplier and products', row, [id, 'structured']);
        }
      }
      if (/\b(approve|approval|authori[sz]e)\b/i.test(question)) {
        required.push('authority');
        const roles = await this.db.role.findMany({
          select: { roleId: true, title: true, approvalAuthority: true },
        });
        for (const role of roles.filter((r) =>
          question.toLowerCase().includes(r.title.toLowerCase()),
        )) {
          if (role.approvalAuthority)
            add(
              role.roleId,
              'Approval authority',
              role,
              ['authority', 'structured'],
              [
                {
                  key: `${role.roleId}:approvalLimitKes`,
                  value: String(role.approvalAuthority.approvalLimitKes),
                },
              ],
            );
        }
      }
      const head = /\b(?:head of|who heads)\s+([a-z ]+?)[?.]?$/i.exec(question);
      if (head) {
        const rows = await this.db.department.findMany({
          where: { name: { equals: head[1].trim(), mode: 'insensitive' } },
          select: {
            departmentId: true,
            name: true,
            headRole: {
              select: {
                title: true,
                employees: {
                  select: { employeeId: true, firstName: true, lastName: true },
                },
              },
            },
          },
        });
        for (const row of rows)
          add(row.departmentId, 'Department head', row, ['structured']);
      }
      if (strategy !== 'CROSS_DOMAIN' || ids.length)
        required.push('structured');
      if (
        strategy === 'CROSS_DOMAIN' &&
        !ids.length &&
        /\bemployee\b.*\b(product|supplier)\b/i.test(question)
      )
        required.push('resolved_cross_domain_entities');
      const scenarioId = question
        .match(/\bSCN-[A-Z]+-\d+\b/i)?.[0]
        ?.toUpperCase();
      if (scenarioId) required.push('reviewed_scenario_context'); // Scenario evaluation narratives are not production facts.
      // Unknown structured intents never fall through to policy-only synthesis.
      if (
        strategy !== 'CROSS_DOMAIN' &&
        !ids.length &&
        !templateHandled &&
        !head &&
        !/\b(approve|approval|authori[sz]e)\b/i.test(question)
      )
        required.push('unsupported_structured_intent');
    }
    if (strategy !== 'STRUCTURED') {
      required.push('policy');
      const needs = policyNeeds(question);
      required.push(...needs);
      const groups = await Promise.all([
        this.search.find(question, Math.max(topK, 10)),
        ...needs.map((policyId) => this.search.find(question, 3, { policyId })),
      ]);
      const results = [
        ...new Map(groups.flat().map((r) => [r.chunkId, r])).values(),
      ];
      const active = await this.db.policy.findMany({
        where: {
          policyId: {
            in: results.flatMap((r) => (r.policyId ? [r.policyId] : [])),
          },
          status: 'Active',
        },
        select: { policyId: true },
      });
      const activeIds = new Set(active.map((p) => p.policyId));
      for (const r of results)
        evidence.push({
          sourceType: 'policy',
          sourceId: r.policyId ?? r.sourceId,
          section: r.sectionHeading ?? undefined,
          content: r.content,
          score: r.score,
          category: r.category ?? undefined,
          authoritative:
            r.documentType === 'POLICY' &&
            !!r.policyId &&
            activeIds.has(r.policyId),
          covers: ['policy', ...(r.policyId ? [r.policyId] : [])],
        });
    }
    return { evidence, required: [...new Set(required)], strategy };
  }
}
