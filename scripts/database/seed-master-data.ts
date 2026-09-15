import type { Prisma } from '@/generated/prisma/client.js';
import { readJson } from './lib/paths.js';

interface CostCenterRow {
  costCenterId: string;
  code: string;
  name: string;
  departmentId: string;
  managerEmployeeId: string;
  locationId: string;
  status: string;
}

interface WarehouseRow {
  warehouseId: string;
  code: string;
  name: string;
  locationId: string;
  city: string;
  warehouseType: string;
  managerEmployeeId: string;
  capacityUnits: number;
  operatingHours: string;
  temperatureControlled: boolean;
  status: string;
}

interface SupplierRow {
  supplierId: string;
  supplierCode: string;
  legalName: string;
  tradingName: string;
  supplierCategory: string;
  contactEmail: string;
  contactPhone: string;
  country: string;
  city: string;
  paymentTerms: string;
  currency: string;
  taxRegistrationStatus: string;
  approvalStatus: string;
  riskRating: string;
  procurementCategory: string;
  primaryContactName: string;
  relationshipOwnerEmployeeId: string;
  suppliedProductIds: string[];
  active: boolean;
}

interface ProductRow {
  productId: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  unitOfMeasure: string;
  unitCost: number;
  sellingPrice: number;
  reorderLevel: number;
  reorderQuantity: number;
  supplierIds: string[];
  taxCategory: string;
  status: string;
}

interface CustomerRow {
  customerId: string;
  customerCode: string;
  legalName: string;
  tradingName: string;
  customerType: string;
  industry: string;
  city: string;
  county: string;
  country: string;
  creditLimit: number;
  paymentTerms: string;
  accountManagerEmployeeId: string;
  customerStatus: string;
  riskRating: string;
}

interface InventoryRow {
  inventoryId: string;
  productId: string;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderLevel: number;
  reorderQuantity: number;
  inventoryStatus: string;
  lastStockCountDate: string;
}

/** Seeds cost_centers, warehouses, suppliers, products, product_suppliers, customers, inventory. */
export async function seedMasterData(tx: Prisma.TransactionClient): Promise<void> {
  const costCenters = await readJson<CostCenterRow[]>('master-data/cost-centers.json');
  for (const c of costCenters)
    await tx.costCenter.upsert({
      where: { costCenterId: c.costCenterId },
      create: {
        costCenterId: c.costCenterId,
        code: c.code,
        name: c.name,
        departmentId: c.departmentId,
        managerEmployeeId: c.managerEmployeeId,
        locationId: c.locationId,
        status: c.status,
      },
      update: {
        code: c.code,
        name: c.name,
        departmentId: c.departmentId,
        managerEmployeeId: c.managerEmployeeId,
        locationId: c.locationId,
        status: c.status,
      },
    });

  const warehouses = await readJson<WarehouseRow[]>('master-data/warehouses.json');
  for (const w of warehouses)
    await tx.warehouse.upsert({
      where: { warehouseId: w.warehouseId },
      create: {
        warehouseId: w.warehouseId,
        code: w.code,
        name: w.name,
        locationId: w.locationId,
        city: w.city,
        warehouseType: w.warehouseType,
        managerEmployeeId: w.managerEmployeeId,
        capacityUnits: w.capacityUnits,
        operatingHours: w.operatingHours,
        temperatureControlled: w.temperatureControlled,
        status: w.status,
      },
      update: {
        code: w.code,
        name: w.name,
        locationId: w.locationId,
        city: w.city,
        warehouseType: w.warehouseType,
        managerEmployeeId: w.managerEmployeeId,
        capacityUnits: w.capacityUnits,
        operatingHours: w.operatingHours,
        temperatureControlled: w.temperatureControlled,
        status: w.status,
      },
    });

  const suppliers = await readJson<SupplierRow[]>('master-data/suppliers.json');
  for (const s of suppliers)
    await tx.supplier.upsert({
      where: { supplierId: s.supplierId },
      create: {
        supplierId: s.supplierId,
        supplierCode: s.supplierCode,
        legalName: s.legalName,
        tradingName: s.tradingName,
        supplierCategory: s.supplierCategory,
        contactEmail: s.contactEmail,
        contactPhone: s.contactPhone,
        country: s.country,
        city: s.city,
        paymentTerms: s.paymentTerms,
        currency: s.currency,
        taxRegistrationStatus: s.taxRegistrationStatus,
        approvalStatus: s.approvalStatus,
        riskRating: s.riskRating,
        procurementCategory: s.procurementCategory,
        primaryContactName: s.primaryContactName,
        relationshipOwnerEmployeeId: s.relationshipOwnerEmployeeId,
        active: s.active,
      },
      update: {
        supplierCode: s.supplierCode,
        legalName: s.legalName,
        tradingName: s.tradingName,
        supplierCategory: s.supplierCategory,
        contactEmail: s.contactEmail,
        contactPhone: s.contactPhone,
        country: s.country,
        city: s.city,
        paymentTerms: s.paymentTerms,
        currency: s.currency,
        taxRegistrationStatus: s.taxRegistrationStatus,
        approvalStatus: s.approvalStatus,
        riskRating: s.riskRating,
        procurementCategory: s.procurementCategory,
        primaryContactName: s.primaryContactName,
        relationshipOwnerEmployeeId: s.relationshipOwnerEmployeeId,
        active: s.active,
      },
    });

  const products = await readJson<ProductRow[]>('master-data/products.json');
  for (const p of products)
    await tx.product.upsert({
      where: { productId: p.productId },
      create: {
        productId: p.productId,
        sku: p.sku,
        name: p.name,
        description: p.description,
        category: p.category,
        subcategory: p.subcategory,
        unitOfMeasure: p.unitOfMeasure,
        unitCost: p.unitCost,
        sellingPrice: p.sellingPrice,
        reorderLevel: p.reorderLevel,
        reorderQuantity: p.reorderQuantity,
        taxCategory: p.taxCategory,
        status: p.status,
      },
      update: {
        sku: p.sku,
        name: p.name,
        description: p.description,
        category: p.category,
        subcategory: p.subcategory,
        unitOfMeasure: p.unitOfMeasure,
        unitCost: p.unitCost,
        sellingPrice: p.sellingPrice,
        reorderLevel: p.reorderLevel,
        reorderQuantity: p.reorderQuantity,
        taxCategory: p.taxCategory,
        status: p.status,
      },
    });

  // The canonical junction: products[].supplierIds and suppliers[].suppliedProductIds
  // must already agree (validated by validate-data-model.ts); this is the single
  // relational representation, not a copy of either array (entities.md §product_suppliers).
  for (const p of products)
    for (const supplierId of p.supplierIds)
      await tx.productSupplier.upsert({
        where: { productId_supplierId: { productId: p.productId, supplierId } },
        create: { productId: p.productId, supplierId },
        update: {},
      });

  const customers = await readJson<CustomerRow[]>('master-data/customers.json');
  for (const c of customers)
    await tx.customer.upsert({
      where: { customerId: c.customerId },
      create: {
        customerId: c.customerId,
        customerCode: c.customerCode,
        legalName: c.legalName,
        tradingName: c.tradingName,
        customerType: c.customerType,
        industry: c.industry,
        city: c.city,
        county: c.county,
        country: c.country,
        creditLimit: c.creditLimit,
        paymentTerms: c.paymentTerms,
        accountManagerEmployeeId: c.accountManagerEmployeeId,
        customerStatus: c.customerStatus,
        riskRating: c.riskRating,
      },
      update: {
        customerCode: c.customerCode,
        legalName: c.legalName,
        tradingName: c.tradingName,
        customerType: c.customerType,
        industry: c.industry,
        city: c.city,
        county: c.county,
        country: c.country,
        creditLimit: c.creditLimit,
        paymentTerms: c.paymentTerms,
        accountManagerEmployeeId: c.accountManagerEmployeeId,
        customerStatus: c.customerStatus,
        riskRating: c.riskRating,
      },
    });

  const inventory = await readJson<InventoryRow[]>('master-data/inventory.json');
  for (const i of inventory)
    await tx.inventory.upsert({
      where: { inventoryId: i.inventoryId },
      create: {
        inventoryId: i.inventoryId,
        productId: i.productId,
        warehouseId: i.warehouseId,
        quantityOnHand: i.quantityOnHand,
        quantityReserved: i.quantityReserved,
        quantityAvailable: i.quantityAvailable,
        reorderLevel: i.reorderLevel,
        reorderQuantity: i.reorderQuantity,
        inventoryStatus: i.inventoryStatus,
        lastStockCountDate: new Date(i.lastStockCountDate),
      },
      update: {
        productId: i.productId,
        warehouseId: i.warehouseId,
        quantityOnHand: i.quantityOnHand,
        quantityReserved: i.quantityReserved,
        quantityAvailable: i.quantityAvailable,
        reorderLevel: i.reorderLevel,
        reorderQuantity: i.reorderQuantity,
        inventoryStatus: i.inventoryStatus,
        lastStockCountDate: new Date(i.lastStockCountDate),
      },
    });
}
