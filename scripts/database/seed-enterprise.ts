import type { Prisma } from '@/generated/prisma/client.js';
import { parseAccess } from '../validate-data-model.js';
import { readJson } from './lib/paths.js';

interface CompanyRow {
  companyId: string;
  legalName: string;
  tradingName: string;
  industry: string;
  description: string;
  registrationNumber: string;
  kraPin: string;
  country: string;
  headquarters: { locationId: string; address: string };
  employeeCount: number;
  employeeDatasetNote: string;
  yearEstablished: number;
  website: string;
  contact: unknown;
  currency: string;
  timezone: string;
  fiscalYear: unknown;
  status: string;
}

interface DepartmentRow {
  departmentId: string;
  name: string;
  description: string;
  departmentHeadRoleId: string;
  costCenterCode: string;
  status: string;
}

interface RoleRow {
  roleId: string;
  title: string;
  departmentId: string;
  level: string;
  description: string;
  responsibilities: string[];
  approvalAuthority: { description: string; approvalLimitKes: number | null } | null;
  systemAccessProfile: string[];
}

interface EmployeeRow {
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
  employmentType: string;
  employmentStatus: string;
  hireDate: string;
  businessProcesses: string[];
}

interface LocationRow {
  locationId: string;
  name: string;
  type: string;
  city: string;
  county: string;
  country: string;
  address: string;
  status: string;
}

interface SystemRow {
  systemId: string;
  name: string;
  vendor: string;
  category: string;
  description: string;
  owningDepartmentId: string;
  criticality: string;
  environment: string;
  status: string;
}

/**
 * Seeds locations, companies, departments, roles, employees, systems and
 * role_system_access. Must run inside the top-level seed transaction: the
 * departments -> roles and departments -> cost_centers FKs are cyclic and
 * are DEFERRABLE INITIALLY DEFERRED (see docs/database/architecture.md), so
 * they are only checked once the whole seed transaction commits.
 */
export async function seedEnterprise(tx: Prisma.TransactionClient): Promise<void> {
  const locations = await readJson<LocationRow[]>('enterprise/locations.json');
  for (const l of locations)
    await tx.location.upsert({
      where: { locationId: l.locationId },
      create: {
        locationId: l.locationId,
        name: l.name,
        type: l.type,
        city: l.city,
        county: l.county,
        country: l.country,
        address: l.address,
        status: l.status,
      },
      update: {
        name: l.name,
        type: l.type,
        city: l.city,
        county: l.county,
        country: l.country,
        address: l.address,
        status: l.status,
      },
    });

  const company = await readJson<CompanyRow>('enterprise/company.json');
  await tx.company.upsert({
    where: { companyId: company.companyId },
    create: {
      companyId: company.companyId,
      legalName: company.legalName,
      tradingName: company.tradingName,
      industry: company.industry,
      description: company.description,
      registrationNumber: company.registrationNumber,
      kraPin: company.kraPin,
      country: company.country,
      headquartersLocationId: company.headquarters.locationId,
      headquartersAddress: company.headquarters.address,
      employeeCount: company.employeeCount,
      employeeDatasetNote: company.employeeDatasetNote,
      yearEstablished: company.yearEstablished,
      website: company.website,
      contact: company.contact as object,
      currency: company.currency,
      timezone: company.timezone,
      fiscalYear: company.fiscalYear as object,
      status: company.status,
    },
    update: {
      legalName: company.legalName,
      tradingName: company.tradingName,
      industry: company.industry,
      description: company.description,
      registrationNumber: company.registrationNumber,
      kraPin: company.kraPin,
      country: company.country,
      headquartersLocationId: company.headquarters.locationId,
      headquartersAddress: company.headquarters.address,
      employeeCount: company.employeeCount,
      employeeDatasetNote: company.employeeDatasetNote,
      yearEstablished: company.yearEstablished,
      website: company.website,
      contact: company.contact as object,
      currency: company.currency,
      timezone: company.timezone,
      fiscalYear: company.fiscalYear as object,
      status: company.status,
    },
  });

  // departments.costCenterCode is a misleading source name: it holds the
  // cost_centers.cost_center_id business key, not cost_centers.code
  // (docs/data-model/entities.md §Normalization and uniqueness).
  const departments = await readJson<DepartmentRow[]>('enterprise/departments.json');
  for (const d of departments)
    await tx.department.upsert({
      where: { departmentId: d.departmentId },
      create: {
        departmentId: d.departmentId,
        name: d.name,
        description: d.description,
        departmentHeadRoleId: d.departmentHeadRoleId,
        costCenterId: d.costCenterCode,
        status: d.status,
      },
      update: {
        name: d.name,
        description: d.description,
        departmentHeadRoleId: d.departmentHeadRoleId,
        costCenterId: d.costCenterCode,
        status: d.status,
      },
    });

  const roles = await readJson<RoleRow[]>('enterprise/roles.json');
  for (const r of roles)
    await tx.role.upsert({
      where: { roleId: r.roleId },
      create: {
        roleId: r.roleId,
        title: r.title,
        departmentId: r.departmentId,
        level: r.level,
        description: r.description,
        responsibilities: r.responsibilities,
      },
      update: {
        title: r.title,
        departmentId: r.departmentId,
        level: r.level,
        description: r.description,
        responsibilities: r.responsibilities,
      },
    });

  const employees = await readJson<EmployeeRow[]>('enterprise/employees.json');
  for (const e of employees)
    await tx.employee.upsert({
      where: { employeeId: e.employeeId },
      create: {
        employeeId: e.employeeId,
        employeeNumber: e.employeeNumber,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone,
        roleId: e.roleId,
        departmentId: e.departmentId,
        managerEmployeeId: e.managerEmployeeId,
        locationId: e.locationId,
        employmentType: e.employmentType,
        employmentStatus: e.employmentStatus,
        hireDate: new Date(e.hireDate),
        businessProcesses: e.businessProcesses,
      },
      update: {
        employeeNumber: e.employeeNumber,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone,
        roleId: e.roleId,
        departmentId: e.departmentId,
        managerEmployeeId: e.managerEmployeeId,
        locationId: e.locationId,
        employmentType: e.employmentType,
        employmentStatus: e.employmentStatus,
        hireDate: new Date(e.hireDate),
        businessProcesses: e.businessProcesses,
      },
    });

  const systems = await readJson<SystemRow[]>('enterprise/systems.json');
  for (const s of systems)
    await tx.system.upsert({
      where: { systemId: s.systemId },
      create: {
        systemId: s.systemId,
        name: s.name,
        vendor: s.vendor,
        category: s.category,
        description: s.description,
        owningDepartmentId: s.owningDepartmentId,
        criticality: s.criticality,
        environment: s.environment,
        status: s.status,
      },
      update: {
        name: s.name,
        vendor: s.vendor,
        category: s.category,
        description: s.description,
        owningDepartmentId: s.owningDepartmentId,
        criticality: s.criticality,
        environment: s.environment,
        status: s.status,
      },
    });

  // roles[].systemAccessProfile[] is split "SYS-ID: profile text" -> the
  // junction row; the array itself is raw ingestion input, not the source of
  // truth (docs/data-model/entities.md §role_system_access).
  for (const r of roles) {
    for (const raw of r.systemAccessProfile) {
      const parsed = parseAccess(raw);
      if (!parsed)
        throw new Error(`${r.roleId}: unparseable system access profile ${raw}`);
      await tx.roleSystemAccess.upsert({
        where: { roleId_systemId: { roleId: r.roleId, systemId: parsed.systemId } },
        create: {
          roleId: r.roleId,
          systemId: parsed.systemId,
          accessProfile: parsed.accessProfile,
        },
        update: { accessProfile: parsed.accessProfile },
      });
    }
  }
}
