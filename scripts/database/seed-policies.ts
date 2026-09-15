import type { Prisma } from '@/generated/prisma/client.js';
import { metadata, policySections } from '../validate-data-model.js';
import { readJson, readPolicyFiles } from './lib/paths.js';

interface SystemRow {
  systemId: string;
  name: string;
}

interface DepartmentRow {
  departmentId: string;
  name: string;
}

function resolveSystemId(value: string, systems: SystemRow[]): string {
  const byId = systems.find((s) => s.systemId === value);
  if (byId) return byId.systemId;
  const byName = systems.find((s) => s.name === value);
  if (!byName) throw new Error(`Unresolved system reference: ${value}`);
  return byName.systemId;
}

function resolveDepartmentId(name: string, departments: DepartmentRow[]): string {
  const match = departments.find((d) => d.name === name);
  if (!match) throw new Error(`Unresolved department name: ${name}`);
  return match.departmentId;
}

interface ApprovalTierParse {
  ordinal: number;
  lowerBoundKes: number | null;
  upperBoundKes: number | null;
  lowerInclusive: boolean;
  upperInclusive: boolean;
  approverLabel: string;
  sourceRuleText: string;
}

/**
 * Parses the FIN-POL-002 §5 approval matrix prose ("up to and including KES
 * 50,000, Department Manager; ...") into the five ordered tiers documented in
 * docs/data-model/business-rules.md. This is the only policy in the corpus
 * that defines an approval matrix (validate-data-model.ts already asserts the
 * exact wording exists), so this parser is deliberately specific to it rather
 * than a generic rules-table extractor.
 */
export function parseApprovalMatrix(sectionFiveBody: string): ApprovalTierParse[] {
  const pattern =
    /up to and including KES ([\d,]+), ([^;]+)|KES ([\d,]+) to ([\d,]+), ([^;]+)|above KES ([\d,]+), ([^.]+)/g;
  const num = (s: string) => Number(s.replace(/,/g, ''));
  const tiers: ApprovalTierParse[] = [];
  let match: RegExpExecArray | null;
  let ordinal = 0;
  while ((match = pattern.exec(sectionFiveBody))) {
    ordinal += 1;
    if (match[1] !== undefined)
      tiers.push({
        ordinal,
        lowerBoundKes: null,
        upperBoundKes: num(match[1]),
        lowerInclusive: true,
        upperInclusive: true,
        approverLabel: match[2].trim(),
        sourceRuleText: match[0].trim(),
      });
    else if (match[3] !== undefined)
      tiers.push({
        ordinal,
        lowerBoundKes: num(match[3]),
        upperBoundKes: num(match[4]),
        lowerInclusive: true,
        upperInclusive: true,
        approverLabel: match[5].trim(),
        sourceRuleText: match[0].trim(),
      });
    else
      tiers.push({
        ordinal,
        lowerBoundKes: num(match[6]!),
        upperBoundKes: null,
        lowerInclusive: false,
        upperInclusive: true,
        approverLabel: match[7]!.trim(),
        sourceRuleText: match[0].trim(),
      });
  }
  if (tiers.length !== 5)
    throw new Error(
      `Expected 5 approval tiers in FIN-POL-002 §5, parsed ${tiers.length}`,
    );
  return tiers;
}

/**
 * Seeds policies, policy_sections, policy_relationships, policy_systems,
 * approval_policy_sets, approval_tiers and role_approval_authorities.
 *
 * role_approval_authorities is derived from roles.json (not policy markdown)
 * but is seeded here, grouped with the rest of the approval-authority model
 * per docs/data-model/entities.md, rather than with seed-enterprise.ts.
 */
export async function seedPolicies(tx: Prisma.TransactionClient): Promise<void> {
  const policies = await readPolicyFiles();
  const systems = await readJson<SystemRow[]>('enterprise/systems.json');
  const departments = await readJson<DepartmentRow[]>('enterprise/departments.json');

  for (const [id, markdown] of Object.entries(policies)) {
    const departmentName = metadata(markdown, 'Department');
    if (!departmentName) throw new Error(`${id}: missing Department metadata`);
    const effectiveDate = metadata(markdown, 'Effective Date');
    const reviewDate = metadata(markdown, 'Review Date');
    if (!effectiveDate || !reviewDate)
      throw new Error(`${id}: missing effective/review date metadata`);

    await tx.policy.upsert({
      where: { policyId: id },
      create: {
        policyId: id,
        title: metadata(markdown, 'Title')!,
        version: metadata(markdown, 'Version')!,
        effectiveDate: new Date(effectiveDate),
        reviewDate: new Date(reviewDate),
        ownerRoleId: metadata(markdown, 'Owner')!,
        departmentId: resolveDepartmentId(departmentName, departments),
        status: metadata(markdown, 'Status')!,
        classification: metadata(markdown, 'Classification')!,
        country: metadata(markdown, 'Country')!,
        businessUnit: metadata(markdown, 'Business Unit')!,
        documentType: metadata(markdown, 'Document Type')!,
      },
      update: {
        title: metadata(markdown, 'Title')!,
        version: metadata(markdown, 'Version')!,
        effectiveDate: new Date(effectiveDate),
        reviewDate: new Date(reviewDate),
        ownerRoleId: metadata(markdown, 'Owner')!,
        departmentId: resolveDepartmentId(departmentName, departments),
        status: metadata(markdown, 'Status')!,
        classification: metadata(markdown, 'Classification')!,
        country: metadata(markdown, 'Country')!,
        businessUnit: metadata(markdown, 'Business Unit')!,
        documentType: metadata(markdown, 'Document Type')!,
      },
    });
  }

  for (const [id, markdown] of Object.entries(policies)) {
    for (const section of policySections(markdown)) {
      const heading = section.heading.trim();
      const body = section.body.trim();
      await tx.policySection.upsert({
        where: { policyId_sectionOrdinal: { policyId: id, sectionOrdinal: section.ordinal } },
        create: {
          policyId: id,
          sectionOrdinal: section.ordinal,
          heading,
          sourceHeading: heading,
          bodyMarkdown: body,
        },
        update: { heading, sourceHeading: heading, bodyMarkdown: body },
      });
    }
  }

  // §12 RELATED POLICIES is the only source of policy_relationships edges;
  // body mentions elsewhere are validated references, not extra edges
  // (docs/data-model/knowledge-model.md).
  for (const [id, markdown] of Object.entries(policies)) {
    const related = policySections(markdown).find((s) => s.heading.trim() === 'RELATED POLICIES');
    if (!related) throw new Error(`${id}: missing RELATED POLICIES section`);
    const targets = [...related.body.matchAll(/^- ([A-Z]+-POL-\d{3}):/gm)];
    for (const [i, m] of targets.entries()) {
      const ordinal = i + 1;
      const relatedPolicyId = m[1];
      await tx.policyRelationship.upsert({
        where: { policyId_relatedPolicyId: { policyId: id, relatedPolicyId } },
        create: { policyId: id, relatedPolicyId, ordinal },
        update: { ordinal },
      });
    }
  }

  for (const [id, markdown] of Object.entries(policies)) {
    const systemField = metadata(markdown, 'System') ?? '';
    const names = systemField
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const [i, name] of names.entries()) {
      const systemId = resolveSystemId(name, systems);
      await tx.policySystem.upsert({
        where: { policyId_systemId: { policyId: id, systemId } },
        create: { policyId: id, systemId, ordinal: i + 1 },
        update: { ordinal: i + 1 },
      });
    }
  }

  const financeMarkdown = policies['FIN-POL-002'];
  if (!financeMarkdown) throw new Error('FIN-POL-002 not found in data/policies');
  const sectionFive = policySections(financeMarkdown).find((s) => s.ordinal === 5);
  if (!sectionFive) throw new Error('FIN-POL-002: missing §5');
  const version = metadata(financeMarkdown, 'Version')!;
  const scope = 'financial';
  const approvalPolicySetId = `FIN-POL-002:${version}:${scope}`;
  await tx.approvalPolicySet.upsert({
    where: { approvalPolicySetId },
    create: { approvalPolicySetId, policyId: 'FIN-POL-002', scope },
    update: { policyId: 'FIN-POL-002', scope },
  });
  for (const tier of parseApprovalMatrix(sectionFive.body)) {
    await tx.approvalTier.upsert({
      where: {
        approvalPolicySetId_tierOrdinal: { approvalPolicySetId, tierOrdinal: tier.ordinal },
      },
      create: {
        approvalPolicySetId,
        tierOrdinal: tier.ordinal,
        lowerBoundKes: tier.lowerBoundKes,
        upperBoundKes: tier.upperBoundKes,
        lowerInclusive: tier.lowerInclusive,
        upperInclusive: tier.upperInclusive,
        approverLabel: tier.approverLabel,
        sourceRuleText: tier.sourceRuleText,
      },
      update: {
        lowerBoundKes: tier.lowerBoundKes,
        upperBoundKes: tier.upperBoundKes,
        lowerInclusive: tier.lowerInclusive,
        upperInclusive: tier.upperInclusive,
        approverLabel: tier.approverLabel,
        sourceRuleText: tier.sourceRuleText,
      },
    });
  }

  // A null approvalAuthority object means no row (absent authority), not an
  // unlimited one; an existing row with a null limit means unlimited
  // (docs/data-model/business-rules.md).
  interface RoleRow {
    roleId: string;
    approvalAuthority: { description: string; approvalLimitKes: number | null } | null;
  }
  const roles = await readJson<RoleRow[]>('enterprise/roles.json');
  for (const r of roles) {
    if (r.approvalAuthority === null) continue;
    await tx.roleApprovalAuthority.upsert({
      where: { roleId: r.roleId },
      create: {
        roleId: r.roleId,
        description: r.approvalAuthority.description,
        approvalLimitKes: r.approvalAuthority.approvalLimitKes,
      },
      update: {
        description: r.approvalAuthority.description,
        approvalLimitKes: r.approvalAuthority.approvalLimitKes,
      },
    });
  }
}
