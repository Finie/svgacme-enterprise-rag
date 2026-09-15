import { beforeAll, describe, expect, it } from 'vitest';
import {
  effectiveAuthority,
  loadCorpus,
  parseAccess,
  validateDataModel,
  type Corpus,
} from './validate-data-model.js';

let corpus: Corpus;
beforeAll(async () => {
  corpus = await loadCorpus();
});
const errors = (data: Corpus, group: string) =>
  validateDataModel(data).filter((issue) => issue.group === group);

describe('generated corpus logical model', () => {
  it('satisfies all current model assumptions', () => {
    expect(validateDataModel(corpus)).toEqual([]);
  });
  it.each([
    'managers',
    'organization',
    'suppliers',
    'inventory-uniqueness',
    'inventory-quantities',
    'policies',
    'actors',
    'evaluation',
    'approval',
  ])('validates actual data: %s', (group) => {
    expect(errors(corpus, group)).toEqual([]);
  });
  it('rejects missing managers and reporting cycles', () => {
    const copy = structuredClone(corpus);
    copy.records.employee[0].managerEmployeeId = 'MISSING';
    expect(errors(copy, 'managers').length).toBeGreaterThan(0);
    copy.records.employee[0].managerEmployeeId =
      copy.records.employee[0].employeeId;
    expect(
      errors(copy, 'managers').some((e) => e.message.includes('cycle')),
    ).toBe(true);
  });
  it('requires valid role and employee departments without forcing equality', () => {
    expect(
      corpus.records.employee.some(
        (e) =>
          corpus.records.role.find((r) => r.roleId === e.roleId)
            ?.departmentId !== e.departmentId,
      ),
    ).toBe(true);
    const copy = structuredClone(corpus);
    copy.records.role[0].departmentId = 'MISSING';
    copy.records.employee[0].roleId = 'MISSING';
    expect(errors(copy, 'organization').length).toBeGreaterThanOrEqual(2);
  });
  it('rejects disagreement between both product/supplier projections', () => {
    const copy = structuredClone(corpus);
    copy.records.product[0].supplierIds.pop();
    expect(
      errors(copy, 'suppliers').some((e) =>
        e.message.includes('nonreciprocal'),
      ),
    ).toBe(true);
  });
  it('rejects a duplicate inventory pair even with a distinct inventory ID', () => {
    const copy = structuredClone(corpus);
    copy.records.inventory.push({
      ...copy.records.inventory[0],
      inventoryId: 'DISTINCT-ID',
    });
    expect(errors(copy, 'inventory-uniqueness')).toHaveLength(1);
  });
  it('rejects incorrect or negative stock quantities', () => {
    const copy = structuredClone(corpus);
    copy.records.inventory[0].quantityAvailable++;
    copy.records.inventory[1].quantityReserved = -1;
    expect(errors(copy, 'inventory-quantities').length).toBeGreaterThanOrEqual(
      2,
    );
  });
  it('rejects missing policy relationships', () => {
    const copy = structuredClone(corpus);
    copy.policies['FIN-POL-002'] += '\nMissing related policy BAD-POL-999\n';
    expect(
      errors(copy, 'policies').some((e) => e.message.includes('BAD-POL-999')),
    ).toBe(true);
  });
  it('rejects missing actors and inconsistent actor departments', () => {
    const copy = structuredClone(corpus);
    copy.records.scenario[0].actors[0].employeeId = 'MISSING';
    expect(errors(copy, 'actors').length).toBeGreaterThan(0);
  });
  it('rejects unknown evaluation source types and missing IDs', () => {
    const copy = structuredClone(corpus);
    copy.records.question[0].requiredSources.push(
      { type: 'unknown', id: 'EMP-0001' },
      { type: 'policy', id: 'MISSING' },
    );
    expect(
      errors(copy, 'evaluation').filter((e) =>
        e.message.includes('unresolved'),
      ),
    ).toHaveLength(2);
  });
  it('retains absent, finite and unlimited role authorities separately', () => {
    const roles = corpus.records.role;
    expect(
      effectiveAuthority(
        50_000,
        roles.find((r) => r.approvalAuthority === null)!.approvalAuthority,
      ),
    ).toBeUndefined();
    expect(
      effectiveAuthority(
        null,
        roles.find((r) => r.roleId === 'ROLE-CEO')!.approvalAuthority,
      ),
    ).toBeNull();
    expect(
      effectiveAuthority(
        2_000_000,
        roles.find((r) => r.roleId === 'ROLE-FIN-MGR')!.approvalAuthority,
      ),
    ).toBe(1_000_000);
    expect(
      effectiveAuthority(
        10_000_000,
        roles.find((r) => r.roleId === 'ROLE-CFO')!.approvalAuthority,
      ),
    ).toBe(5_000_000);
    const copy = structuredClone(corpus);
    copy.policies['FIN-POL-002'] = copy.policies['FIN-POL-002'].replace(
      '50,001 to 500,000',
      '50,001 to 600,000',
    );
    expect(errors(copy, 'approval').length).toBeGreaterThan(0);
  });
  it('round-trips every actual role access string without invented permissions', () => {
    for (const role of corpus.records.role)
      for (const raw of role.systemAccessProfile) {
        const parsed = parseAccess(raw)!;
        expect(`${parsed.systemId}: ${parsed.accessProfile}`).toBe(raw);
      }
  });
  it('checks graph endpoints and event order, including nonlocal canonical endpoints', () => {
    const copy = structuredClone(corpus);
    copy.records.scenario[0].relationships.push({
      from: 'MISSING',
      type: 'test',
      to: 'EMP-0001',
    });
    copy.records.scenario[0].events[0].sequence = 2;
    expect(errors(copy, 'scenarios').length).toBeGreaterThanOrEqual(2);
  });
});
