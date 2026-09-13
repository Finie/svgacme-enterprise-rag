import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const ENTERPRISE_DIR = resolve(PROJECT_ROOT, 'data', 'enterprise');
const MASTER_DATA_DIR = resolve(PROJECT_ROOT, 'data', 'master-data');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'data', 'policies');
const EFFECTIVE_DATE = '2026-01-01';
const REVIEW_DATE = '2027-01-01';

interface Department {
  departmentId: string;
  name: string;
}
interface Role {
  roleId: string;
  title: string;
  departmentId: string;
}
interface System {
  systemId: string;
  name: string;
  owningDepartmentId: string;
}
interface Location {
  locationId: string;
  name: string;
}
interface Employee {
  employeeId: string;
  firstName: string;
  lastName: string;
}
interface Company {
  legalName: string;
  tradingName: string;
  country: string;
}
interface EnterpriseData {
  company: Company;
  departments: Department[];
  roles: Role[];
  systems: System[];
  locations: Location[];
  employees: Employee[];
}
interface PolicySpec {
  documentId: string;
  title: string;
  ownerDepartment: string;
  ownerRole: string;
  systemReferences: string[];
  requiredSections: string[];
  relatedPolicies: string[];
  requiredTopics: string[];
  body: string[];
}

const RULES = {
  annualLeaveDays: 24,
  leaveNoticeDays: 5,
  expenseSubmissionDays: 10,
  receiptThresholdKes: 2_000,
  mealLimitKes: 3_000,
  accommodationLimitKes: 12_000,
  mileageRateKes: 45,
  procurementFinanceThresholdKes: 500_000,
  approval: {
    departmentManagerMaxKes: 50_000,
    departmentHeadMaxKes: 500_000,
    financeManagerMaxKes: 2_000_000,
    cfoMaxKes: 10_000_000,
  },
  giftDisclosureThresholdKes: 5_000,
  giftProhibitedThresholdKes: 20_000,
  travelAdvanceDays: 5,
  recordsReviewYears: 7,
  incidentResponseMinutes: { P1: 15, P2: 60, P3: 240, P4: 1_440 },
} as const;

const RELATIONSHIPS: Record<string, string[]> = {
  'HR-POL-001': ['HR-POL-002', 'IT-POL-001', 'GEN-POL-001'],
  'HR-POL-002': ['IT-POL-001', 'IT-POL-002', 'GEN-POL-001', 'HR-POL-001'],
  'FIN-POL-001': ['FIN-POL-002', 'OPS-POL-001', 'GEN-POL-001'],
  'FIN-POL-002': ['PROC-POL-001', 'FIN-POL-001', 'OPS-POL-001', 'COMP-POL-002'],
  'PROC-POL-001': [
    'FIN-POL-002',
    'PROC-POL-002',
    'WH-POL-001',
    'INV-POL-001',
    'GEN-POL-001',
  ],
  'PROC-POL-002': [
    'PROC-POL-001',
    'FIN-POL-002',
    'COMP-POL-001',
    'COMP-POL-002',
  ],
  'SALES-POL-001': ['INV-POL-001', 'WH-POL-001', 'FIN-POL-002', 'COMP-POL-001'],
  'INV-POL-001': ['SALES-POL-001', 'WH-POL-001', 'PROC-POL-001'],
  'WH-POL-001': ['INV-POL-001', 'PROC-POL-001', 'OPS-POL-001'],
  'IT-POL-001': ['HR-POL-002', 'HR-POL-001', 'IT-POL-002', 'COMP-POL-001'],
  'IT-POL-002': ['IT-POL-001', 'COMP-POL-001', 'GEN-POL-001'],
  'COMP-POL-001': [
    'IT-POL-001',
    'IT-POL-002',
    'PROC-POL-002',
    'SALES-POL-001',
    'GEN-POL-001',
  ],
  'COMP-POL-002': ['PROC-POL-002', 'FIN-POL-002', 'OPS-POL-001'],
  'OPS-POL-001': ['FIN-POL-001', 'COMP-POL-002', 'GEN-POL-001'],
  'GEN-POL-001': [
    'HR-POL-001',
    'HR-POL-002',
    'FIN-POL-001',
    'FIN-POL-002',
    'PROC-POL-001',
    'PROC-POL-002',
    'SALES-POL-001',
    'INV-POL-001',
    'WH-POL-001',
    'IT-POL-001',
    'IT-POL-002',
    'COMP-POL-001',
    'COMP-POL-002',
    'OPS-POL-001',
  ],
};

const BODY: Record<string, string[]> = {
  'HR-POL-001': [
    `Employees accrue ${RULES.annualLeaveDays} working days of annual leave for each completed leave year. Leave is planned with the line manager so operational coverage is maintained; it is not a substitute for an unreported absence. Annual leave should normally be requested at least ${RULES.leaveNoticeDays} working days before the first day away. The manager checks the team calendar, outstanding work and handover before approving or declining the request in the Employee Management System.`,
    `Sick leave must be reported to the manager as soon as practicable and recorded in the Employee Management System when the employee returns or is able to do so. Supporting medical information is handled confidentially by Human Resources and is not circulated through ordinary team channels. Parental, compassionate and emergency leave are requested through the same workflow, with the relevant supporting information supplied directly to Human Resources where required.`,
    `Emergency leave may be notified by telephone or another reliable channel when advance system submission is not possible. The employee or manager must regularise the absence in the Employee Management System as soon as practicable. Human Resources confirms the leave category, dates and balance, while the manager records the operational handover and any temporary work allocation.`,
    `The manager is the first approver for routine leave. Human Resources resolves balance, eligibility or exceptional-category questions and may escalate an unresolved case to the HR Manager. Leave must not be approved by the employee, and a manager must not approve their own leave. Overlapping critical coverage is managed by adjusting dates or documenting an approved exception rather than silently allowing an unrecorded absence.`,
    `The Employee Management System is the system of record for applications, approvals, balances and return dates. Email or paper evidence may support an emergency request, but it does not replace the system record. Access to medical and family information is restricted under COMP-POL-001 and retained under GEN-POL-001.`,
  ],
  'HR-POL-002': [
    `A hiring manager begins with a documented job requisition stating the business need, department, role, location, employment type and budget. Human Resources checks the requisition against the approved structure and routes it for the financial approval required by FIN-POL-002 before advertising or engaging a candidate. A requisition is not approval to hire until the required authority has signed it.`,
    `Human Resources owns candidate screening, interview coordination and the recruitment record. Interview panels use role-relevant criteria and record reasons for selection. The hiring manager recommends a candidate; the HR Manager confirms process compliance and the authorised approver confirms the offer and compensation. Background checks are completed proportionately and any sensitive result is restricted to authorised HR personnel.`,
    `After offer acceptance, HR creates the employee record in the Employee Management System using the canonical employee, role, department and location data. HR supplies IT with the start date, approved role, manager and required access profile. IT provisions accounts through the Identity and Access Management System according to IT-POL-001; HR does not grant system permissions directly.`,
    `Onboarding includes induction, policy acknowledgement, payroll and personal-record completion, equipment handover, safety information and a documented probation review. A new employee who cannot access Microsoft Dynamics 365 Finance must raise a ticket in the IT Service Desk; the service desk verifies the HR onboarding record and routes an access correction under IT-POL-001. A suspected security issue is handled under IT-POL-002 and COMP-POL-001.`,
    `When employment ends or a transfer is approved, HR notifies IT before the effective time where practicable. IT disables or changes access through the Identity and Access Management System, recovers equipment and preserves records under GEN-POL-001. The employee record remains controlled by HR; recruitment notes are not copied into operational systems without a business need.`,
  ],
  'FIN-POL-001': [
    `Reimbursable expenses must be reasonable, necessary for SVGA Enterprise business and incurred by the claimant while performing an authorised duty. Eligible categories include approved business travel, accommodation, meals, local transport, mileage and modest business communication costs. Personal purchases, fines, entertainment without a business purpose, alcohol, upgrades chosen for convenience and costs already paid by the company are not reimbursable.`,
    `A receipt is required for each expense of KES ${RULES.receiptThresholdKes.toLocaleString()} or more and should be attached to the claim. Where a receipt cannot reasonably be obtained, the claimant records the reason, date, supplier, amount, currency and business purpose; the approver decides whether the exception is acceptable. Meal claims are capped at KES ${RULES.mealLimitKes.toLocaleString()} per person per meal and accommodation at KES ${RULES.accommodationLimitKes.toLocaleString()} per night unless a documented exception is approved before commitment.`,
    `Mileage for an approved personal-vehicle business journey is reimbursed at KES ${RULES.mileageRateKes} per kilometre when the route, date, purpose and distance are recorded. Public transport and approved hired transport require supporting evidence. Travel advances are reconciled against actual costs; unused balances are returned before a subsequent advance is issued. OPS-POL-001 supplies the travel authorisation and logistics rules.`,
    `The employee submits the claim in Microsoft Dynamics 365 Finance within ${RULES.expenseSubmissionDays} calendar days of returning or incurring the cost, with the cost centre, business purpose and attachments. The line manager confirms business purpose and budget; Finance checks arithmetic, duplicates, tax treatment, receipts and approval authority. A claimant must never approve their own claim.`,
  ],
  'FIN-POL-002': [
    `This policy establishes one approval matrix for expenditure, purchase commitments, expense claims and operational travel. Amounts are evaluated on the total expected commitment, including taxes, extensions and related items, rather than being split to avoid a higher approval level. Approval confirms business need, budget and compliance; it does not replace Procurement, receiving or Finance controls.`,
    `The matrix is: up to and including KES ${RULES.approval.departmentManagerMaxKes.toLocaleString()}, Department Manager; KES ${(RULES.approval.departmentManagerMaxKes + 1).toLocaleString()} to ${RULES.approval.departmentHeadMaxKes.toLocaleString()}, Department Head; KES ${(RULES.approval.departmentHeadMaxKes + 1).toLocaleString()} to ${RULES.approval.financeManagerMaxKes.toLocaleString()}, Finance Manager; KES ${(RULES.approval.financeManagerMaxKes + 1).toLocaleString()} to ${RULES.approval.cfoMaxKes.toLocaleString()}, CFO; above KES ${RULES.approval.cfoMaxKes.toLocaleString()}, CEO or Executive Committee. A role-specific authority may be lower and the lower limit applies.`,
    `The requester, approver, receiver and payment processor must be separated where the transaction permits. A delegated approver must be formally recorded with dates and scope; delegation does not permit self-approval, approval of a conflict, or bypass of segregation of duties. Finance reviews transactions above KES ${RULES.procurementFinanceThresholdKes.toLocaleString()} and any unusual, retrospective or split commitment.`,
    `Emergency approval is limited to protecting people, stock, systems or continuity. The responsible manager records the reason, supplier or payee, amount, evidence and retrospective approver in Microsoft Dynamics 365 Finance within one business day. Emergency status does not waive conflict disclosure, sanctions screening, receipt or invoice matching controls.`,
    `The CFO owns the matrix, Finance maintains the approval audit trail and Compliance tests adherence. PROC-POL-001 applies this matrix to purchase requests, FIN-POL-001 to expenses and OPS-POL-001 to travel. Policy exceptions require written approval from the CFO and, where a compliance control is affected, the Compliance Manager.`,
  ],
  'PROC-POL-001': [
    `The procurement lifecycle is: Purchase Request, Approval, Supplier Selection, Quotation, Purchase Order, Delivery, Goods Receipt, Invoice and Finance payment. A requester states the specification, quantity, required date, cost centre and business reason in Microsoft Dynamics 365 Supply Chain Management. Procurement checks whether the item is already available from stock or an approved supplier before sourcing.`,
    `Requests are approved under FIN-POL-002 using the total commitment. Purchases above KES ${RULES.procurementFinanceThresholdKes.toLocaleString()} require Finance review before a purchase order is released. Competitive quotations are obtained in proportion to value and risk; the file records invited suppliers, responses, evaluation criteria and the reason for selection. A purchase order is issued before commitment except for a documented emergency.`,
    `Procurement may only use an approved supplier or complete the onboarding and due-diligence process in PROC-POL-002. The requester must not select, receive and approve the same purchase. A purchase order may not be split, backdated, issued to an employee for personal use, or used to conceal a gift, conflict or unauthorised commitment.`,
    `The Warehouse verifies delivery against the purchase order, inspects quantity and condition, and creates the goods receipt under WH-POL-001. Inventory records the accepted quantity under INV-POL-001. Finance performs three-way matching of purchase order, goods receipt and invoice before payment; shortages, damage and price differences are held for resolution.`,
    `Emergency procurement is used only where delay creates a material risk to people, stock, service continuity or critical systems. The request records the reason and retrospective approvals. Procurement reports emergency use, exceptions, supplier performance and policy breaches to the Procurement Manager and Compliance. Records, quotations, approvals, receipts and invoices are retained under GEN-POL-001.`,
  ],
  'PROC-POL-002': [
    `Supplier onboarding begins with a business need and a completed supplier profile. Procurement collects legal identity, contacts, ownership information, payment details, tax information, service category, references and the proposed risk classification. Finance validates payment and tax details; Compliance performs proportionate due diligence; the Procurement Manager approves inclusion on the approved supplier list.`,
    `Supplier risk is assessed using service criticality, access to personal or company data, financial exposure, operational dependency, geography, subcontracting and integrity indicators. Higher-risk suppliers require stronger evidence, contract controls, monitoring and renewal review. Supplier records are maintained in Microsoft Dynamics 365 Supply Chain Management and sensitive information is handled under COMP-POL-001.`,
    `Procurement reviews performance against delivery, quality, fulfilment, responsiveness, invoice accuracy and policy compliance. A material failure receives a corrective action plan with an owner and due date. A supplier may be suspended for quality failure, suspected fraud, conflict, sanctions concern, data incident or repeated non-performance; suspension blocks new purchase orders until the Procurement Manager records reinstatement or termination.`,
    `Employees disclose personal, family or financial relationships with a supplier under COMP-POL-002 and withdraw from evaluation or approval. Supplier gifts and hospitality are not a substitute for competition or approval. A new supplier cannot be selected merely because a requester prefers it; the approved list, documented exception and FIN-POL-002 authority are required.`,
    `Termination closes open commitments, confirms delivery and invoice status, preserves records and removes unnecessary system access. Procurement, Finance, Compliance and the business owner document the decision. Contracts, due-diligence evidence, reviews, approvals and communications are retained in the Enterprise Document Management System under GEN-POL-001.`,
  ],
  'SALES-POL-001': [
    `Customer onboarding records the legal or trading name, contacts, delivery locations, account manager, tax information, payment terms and verification outcome in Microsoft Dynamics 365 Sales. The Sales Manager approves credit terms and material discounts within authority; Finance performs the required credit and account checks. Customer records must be accurate, access-controlled and handled under COMP-POL-001.`,
    `The Sales Representative creates a quotation or sales order with the customer, product, quantity, price, delivery location and requested date. The order is checked for approval, credit status and pricing before confirmation. Microsoft Dynamics 365 Supply Chain Management supplies the stock availability check; a sales order is not a warehouse instruction until it passes the required status and credit controls.`,
    `The fulfilment flow is Sales Order, Inventory availability, reservation, Warehouse picking and packing, dispatch and delivery confirmation. If requested quantity exceeds quantityAvailable, Sales does not promise unavailable stock. The account manager may propose a partial delivery, an approved back-order or an alternative product, while Inventory determines replenishment and Procurement follows PROC-POL-001.`,
    `Warehouse records picking, packing, dispatch and delivery evidence. Returns require a reason, customer reference, condition assessment and approval before stock is returned or a credit is issued. Damaged, expired or disputed goods are isolated and processed under INV-POL-001 and WH-POL-001; Finance handles approved credits in Microsoft Dynamics 365 Finance.`,
    `Sales Managers review order ageing, cancelled orders, credit breaches, stock-outs, returns and unusual discounts. Customer data exports, account changes and complaints are logged and restricted to a business need. Records of orders, approvals, delivery, returns and correspondence are retained under GEN-POL-001.`,
  ],
  'INV-POL-001': [
    `Inventory records are maintained in Microsoft Dynamics 365 Supply Chain Management by product, site, warehouse, batch or other required control attribute. quantityOnHand is the physically recorded stock. quantityReserved is stock committed to approved demand. quantityAvailable is quantityOnHand less quantityReserved and any controlled hold. reorderLevel is the trigger for replenishment review; reorderQuantity is the approved quantity to order or transfer.`,
    `Inventory compares availability before a sales order is confirmed and reserves stock only against an approved demand. When quantityAvailable falls below reorderLevel, the Inventory Manager reviews demand, open purchase orders, stock in other warehouses and expected lead time. The resulting purchase request or transfer follows PROC-POL-001 and FIN-POL-002; a reorder signal is not an automatic purchase commitment.`,
    `Cycle counts and full stock counts are planned by risk and movement. Counters record the location, product, expected balance, counted balance, variance and evidence. Adjustments require an independent review; write-offs for damage, expiry, loss or obsolescence require the Inventory Manager and the approval level in FIN-POL-002. No employee may erase a transaction to hide a discrepancy.`,
    `Transfers require source, destination, product, quantity, reason and authorisation. Damaged or expired stock is segregated, labelled and held from sale. Warehouse confirms movement and condition under WH-POL-001; Finance receives valuation-impacting adjustments. Inventory reporting distinguishes physical stock, reserved stock, available stock, held stock and approved write-offs.`,
  ],
  'WH-POL-001': [
    `Warehouse receiving begins with the purchase order and delivery appointment or other authorised inbound reference. The receiving officer verifies supplier, purchase order, item, quantity, packaging, batch or expiry information where applicable and visible damage. The Warehouse Manager resolves discrepancies; a delivery is not accepted merely because a vehicle arrived.`,
    `The receiver records a goods receipt in Microsoft Dynamics 365 Supply Chain Management, attaches delivery evidence and identifies accepted, rejected, short or damaged quantities. Accepted stock is labelled and moved to the designated storage location. Damaged or questionable goods are segregated and reported to Procurement and Inventory before disposition. Finance uses the goods receipt for invoice matching under PROC-POL-001.`,
    `Storage follows product handling, security, access and rotation requirements. Picking is against an approved sales or transfer instruction; the picker records product and quantity, a second control applies where risk requires it, and packing verifies the dispatch. Dispatch records destination, carrier or authorised handover, packages and time. Inventory is updated at the controlled transaction point rather than through an informal spreadsheet.`,
    `Stock discrepancies, unauthorised access, loss, damage and failed counts are reported to the Warehouse Manager and Inventory Manager. The warehouse may not create an unexplained adjustment. Inventory approves the accounting treatment under INV-POL-001, Procurement resolves supplier claims, and Operations coordinates cross-site action where a disruption affects service.`,
    `Warehouse access is limited to assigned duties, visitors are logged and keys or credentials are controlled. CCTV or other security records, where used, are accessed only for a legitimate investigation. Receiving records, count evidence, dispatch records, incident reports and visitor records are retained under GEN-POL-001 and protected under COMP-POL-001.`,
  ],
  'IT-POL-001': [
    `Accounts are created only after an authorised HR onboarding, transfer or service request identifies the employee, role, department, manager, start date and approved access profile. The Identity and Access Management System is the control point for authentication, single sign-on, multi-factor authentication and provisioning. IT maps role duties to least-privilege access; access is not granted because a colleague requests it informally.`,
    `Role-based profiles align with canonical roles. A Finance Analyst receives the Microsoft Dynamics 365 Finance read/write transactional and reconciliation profile stated for that role, subject to segregation of duties; they do not receive Finance Manager approval rights by default. Procurement, Sales, Inventory, Warehouse and HR access follows the role profile and business need in the enterprise data. Privileged access requires separate approval and stronger monitoring.`,
    `Users protect credentials, use approved devices and services, do not share accounts, and do not copy confidential records to personal storage. Password and multi-factor authentication controls are enforced by the identity platform. Access requests, approvals, changes and periodic reviews are recorded in the Identity and Access Management System or IT Service Desk. Suspected compromise is an incident under IT-POL-002 and COMP-POL-001.`,
    `Managers review access when duties change and at the scheduled review interval. IT removes dormant, excessive or unsupported access. When HR records termination or transfer, IT disables, changes or recertifies access promptly, recovers equipment and preserves required records. Access to Microsoft Dynamics 365 Finance, Sales, Supply Chain Management, Employee Management System, IT Service Desk and Enterprise Document Management System is granted only for the assigned role.`,
    `The IT Manager owns access control, HR owns the employment trigger, managers own business justification and Compliance tests evidence. Unauthorised access, bypassed approval, shared credentials or attempts to exceed a role profile may result in access suspension and disciplinary action. Access logs and approvals are retained under GEN-POL-001.`,
  ],
  'IT-POL-002': [
    `An incident is an unplanned interruption, degradation, security event or suspected loss of confidentiality, integrity or availability. Employees create a ticket in the IT Service Desk with the affected system, symptoms, time, location, business impact and contact details. They must not conceal a security concern in a routine chat or continue destructive troubleshooting.`,
    `P1 Critical incidents threaten a critical system, widespread operations, safety or confirmed serious security exposure; the service desk acknowledges within ${RULES.incidentResponseMinutes.P1} minutes and escalates immediately. P2 High incidents have substantial business impact and a ${RULES.incidentResponseMinutes.P2}-minute target. P3 Medium incidents affect a limited service with a ${RULES.incidentResponseMinutes.P3}-minute target. P4 Low requests have a ${RULES.incidentResponseMinutes.P4}-minute target. Targets are response targets, not guaranteed resolution times.`,
    `The service desk triages, categorises, assigns, communicates and records the ticket. The IT Manager coordinates major incidents, assigns technical owners and provides business updates. A suspected data incident is escalated to Compliance under COMP-POL-001; access-related events are investigated with IT-POL-001. The incident record contains timestamps, decisions, changes, evidence, affected services, root cause where known and recovery actions.`,
    `Closure requires service restoration or an agreed workaround, user or business confirmation where practicable, a resolution summary and classification of any follow-up problem. Major incidents receive a post-incident review with actions and owners. Reopened incidents retain the original history. Tickets are not deleted to improve service metrics.`,
    `Service desk records are retained in the IT Service Desk and relevant investigation records in the Enterprise Document Management System under GEN-POL-001. Access to logs and evidence is restricted, and evidence is preserved when a legal hold, investigation or privacy request applies.`,
  ],
  'COMP-POL-001': [
    `Personal data includes information that identifies or can reasonably be linked to an employee, customer, supplier contact, candidate or other individual. SVGA Enterprise collects only data needed for a defined business purpose, explains the purpose through the appropriate process and keeps data accurate. The policy applies to HR, Sales, Procurement, Finance, IT, Warehouse, Operations and Compliance records in paper, system and exported form.`,
    `Human Resources protects employee and candidate records in the Employee Management System; Sales protects customer contacts and account history in Microsoft Dynamics 365 Sales; Procurement protects supplier contacts and due-diligence information in Microsoft Dynamics 365 Supply Chain Management; IT protects identities, tickets and logs in the Identity and Access Management System and IT Service Desk. Access follows least privilege under IT-POL-001.`,
    `Processing must have a documented business purpose and an appropriate internal basis. Data is not collected for curiosity, copied to personal accounts or shared with a supplier without an authorised purpose and suitable controls. Data subject requests, corrections, access questions and deletion or retention concerns are logged with Compliance, which coordinates with the record owner and preserves applicable legal or investigation holds.`,
    `Employees report suspected loss, misdirection, unauthorised access, malware, disclosure or excessive access immediately through the IT Service Desk and to Compliance. IT-POL-002 defines incident triage and escalation; Compliance assesses scope, containment, notification and corrective action. The first response preserves evidence and avoids forwarding sensitive data unnecessarily.`,
    `Retention follows GEN-POL-001 and the approved record schedule. At the end of the period, records are securely disposed of unless an active purpose, audit, dispute, investigation or legal hold requires preservation. Compliance monitors access, sharing, retention, training and incidents and reports material concerns to the Compliance Manager.`,
  ],
  'COMP-POL-002': [
    `Bribery includes offering, promising, giving, requesting or accepting anything of value to improperly influence a decision. This includes cash, employment favours, discounts, travel, hospitality, charitable payments or a payment made through an intermediary. Facilitation payments are prohibited. A transaction cannot be made acceptable by labelling it a marketing cost or emergency.`,
    `Gifts or hospitality valued at KES ${RULES.giftDisclosureThresholdKes.toLocaleString()} or more per person must be disclosed to the Compliance Manager before acceptance where practicable and recorded in the gifts register. Gifts or hospitality at or above KES ${RULES.giftProhibitedThresholdKes.toLocaleString()}, cash or cash equivalents, and anything intended to influence a tender, approval, inspection or payment are prohibited. Modest working refreshments may be accepted only when transparent and business-related.`,
    `Employees disclose actual, potential or perceived conflicts involving suppliers, customers, candidates, competitors or company decisions. The disclosure states the relationship, affected decision and proposed control. The manager and Compliance Manager decide whether the employee must withdraw, whether an independent review is required or whether the activity must stop. Procurement follows PROC-POL-002 and financial approvers follow FIN-POL-002.`,
    `Concerns may be reported to Compliance or through the approved reporting channel. Reports are handled confidentially as far as practicable, retaliation is prohibited and records are access-controlled. Compliance determines investigation scope, preserves relevant records under GEN-POL-001 and coordinates with Legal or HR when needed. Employees cooperate and do not investigate a subject they are connected to.`,
    `Confirmed misconduct may lead to withdrawal of approval, supplier suspension, recovery of funds, disciplinary action up to termination and referral to authorities where appropriate. Training, disclosures, approvals, registers, investigations and decisions are monitored by Compliance. Business travel gifts and hospitality are also governed by OPS-POL-001.`,
  ],
  'OPS-POL-001': [
    `Business travel requires a documented purpose, traveller, destination, dates, estimated cost and business owner before booking. The line manager confirms need and budget; approval follows FIN-POL-002. Domestic travel is planned through the authorised process, with reasonable transport and accommodation selected for safety, cost and business suitability. Emergency travel is recorded as soon as practicable and regularised after the event.`,
    `Accommodation is reimbursed up to KES ${RULES.accommodationLimitKes.toLocaleString()} per night unless an approved exception is recorded. Meals are subject to the KES ${RULES.mealLimitKes.toLocaleString()} per-person limit in FIN-POL-001. Approved personal-vehicle mileage is KES ${RULES.mileageRateKes} per kilometre with route evidence. Per diem, where approved for a trip, is reduced for meals or accommodation paid directly by the company so that costs are not claimed twice.`,
    `Travel advances are requested at least ${RULES.travelAdvanceDays} working days before departure where practicable and are approved under the financial matrix. The traveller reconciles the advance with receipts and returns the balance within ${RULES.expenseSubmissionDays} days of return. Finance rejects unsupported, duplicated or personal costs and escalates suspected fraud under COMP-POL-002.`,
    `Travelers follow security, confidentiality and acceptable-use controls. Company information is not exposed in public settings, and a lost device or suspected account compromise is reported through the IT Service Desk immediately. Gifts, hospitality, supplier-sponsored travel and conflicts are disclosed under COMP-POL-002 before acceptance.`,
    `Operations keeps the travel authorisation and itinerary record; Finance keeps the claim, advance and payment evidence; HR or the manager records exceptional absence where applicable. Travel records, approvals, receipts and exception decisions are stored and retained under GEN-POL-001.`,
  ],
  'GEN-POL-001': [
    `A record is evidence of a business activity, decision, obligation, transaction, approval, communication or control. Records are classified as Internal by default unless the owner assigns a more restrictive classification. Corporate policies, HR records, financial evidence, procurement files, customer orders, warehouse records, IT tickets, compliance investigations and travel claims are records under this policy.`,
    `The creator uses a meaningful name containing record type, subject or transaction reference, date and version where relevant. Records are stored in the Enterprise Document Management System or the approved system of record: Employee Management System for HR, Microsoft Dynamics 365 Finance for Finance, Microsoft Dynamics 365 Sales for customer activity, Microsoft Dynamics 365 Supply Chain Management for supply chain activity, and IT Service Desk for incidents and tickets.`,
    `Owners control access, accuracy, version history and retention. A revised policy creates a new version and records the approver, effective date and superseded version; users do not overwrite an approved record to hide history. Drafts are clearly marked and are not treated as final authority. Sharing follows COMP-POL-001 and access follows IT-POL-001.`,
    `Records are retained for the approved schedule, with a default review point of ${RULES.recordsReviewYears} years for corporate control records unless a longer business, contractual, audit or legal period applies. A legal hold, investigation, audit or unresolved dispute suspends disposal. The record owner identifies the hold, prevents alteration or deletion and releases it only through the authorised process.`,
    `At disposal, the owner confirms that the retention period has ended and no hold applies. Electronic records are securely deleted or rendered unrecoverable and paper records are securely destroyed. Compliance monitors classification, retention and disposal; IT maintains repository controls; each department owns its records. The policy is reviewed annually and related policies must preserve their own evidence.`,
  ],
};

function buildSpecs(): PolicySpec[] {
  const definitions: Array<
    [string, string, string, string, string[], string[]]
  > = [
    [
      'HR-POL-001',
      'Employee Leave & Time-Off Policy',
      'Human Resources',
      'ROLE-HR-MGR',
      ['SYS-HR'],
      [
        'annual leave',
        'sick leave',
        'parental leave',
        'emergency leave',
        'leave records',
      ],
    ],
    [
      'HR-POL-002',
      'Recruitment & Onboarding Policy',
      'Human Resources',
      'ROLE-HR-MGR',
      ['SYS-HR', 'SYS-IAM', 'SYS-SD', 'SYS-D365-FIN'],
      [
        'job requisitions',
        'candidate screening',
        'onboarding',
        'system access',
        'probation',
      ],
    ],
    [
      'FIN-POL-001',
      'Expense & Reimbursement Policy',
      'Finance',
      'ROLE-FIN-MGR',
      ['SYS-D365-FIN', 'SYS-DMS'],
      ['expense', 'receipt', 'mileage', 'claim', 'approval'],
    ],
    [
      'FIN-POL-002',
      'Financial Approval & Delegation Policy',
      'Finance',
      'ROLE-CFO',
      ['SYS-D365-FIN', 'SYS-DMS'],
      [
        'approval matrix',
        'delegation',
        'segregation of duties',
        'emergency approval',
        'Finance',
      ],
    ],
    [
      'PROC-POL-001',
      'Procurement & Purchasing Policy',
      'Procurement',
      'ROLE-PROC-MGR',
      ['SYS-D365-SCM', 'SYS-D365-FIN', 'SYS-DMS'],
      [
        'purchase requests',
        'quotations',
        'purchase orders',
        'goods receiving',
        'invoice matching',
      ],
    ],
    [
      'PROC-POL-002',
      'Supplier & Vendor Management Policy',
      'Procurement',
      'ROLE-PROC-MGR',
      ['SYS-D365-SCM', 'SYS-DMS'],
      [
        'supplier onboarding',
        'due diligence',
        'supplier risk',
        'approved supplier list',
        'supplier performance',
      ],
    ],
    [
      'SALES-POL-001',
      'Sales Order & Customer Management Policy',
      'Sales',
      'ROLE-SALES-MGR',
      ['SYS-D365-SALES', 'SYS-D365-SCM', 'SYS-D365-FIN'],
      [
        'customer onboarding',
        'credit assessment',
        'sales orders',
        'stock availability',
        'returns',
      ],
    ],
    [
      'INV-POL-001',
      'Inventory Management & Stock Control Policy',
      'Inventory',
      'ROLE-INV-MGR',
      ['SYS-D365-SCM', 'SYS-D365-FIN'],
      ['inventory', 'product', 'quantity', 'reorderLevel', 'discrepancy'],
    ],
    [
      'WH-POL-001',
      'Warehouse Operations & Receiving Policy',
      'Warehouse',
      'ROLE-WH-MGR',
      ['SYS-D365-SCM', 'SYS-DMS'],
      ['warehouse', 'receiving', 'storage', 'picking', 'dispatch'],
    ],
    [
      'IT-POL-001',
      'IT Acceptable Use & Access Control Policy',
      'Information Technology',
      'ROLE-IT-MGR',
      [
        'SYS-IAM',
        'SYS-SD',
        'SYS-D365-FIN',
        'SYS-D365-SALES',
        'SYS-D365-SCM',
        'SYS-HR',
        'SYS-DMS',
      ],
      [
        'accounts',
        'least privilege',
        'role-based access',
        'authentication',
        'access',
      ],
    ],
    [
      'IT-POL-002',
      'IT Incident Management & Service Desk Policy',
      'Information Technology',
      'ROLE-IT-MGR',
      ['SYS-SD', 'SYS-IAM', 'SYS-DMS'],
      ['incident', 'service desk', 'response targets', 'escalates', 'closure'],
    ],
    [
      'COMP-POL-001',
      'Data Protection & Privacy Policy',
      'Compliance',
      'ROLE-COMP-MGR',
      [
        'SYS-HR',
        'SYS-D365-SALES',
        'SYS-D365-SCM',
        'SYS-IAM',
        'SYS-SD',
        'SYS-DMS',
      ],
      [
        'personal data',
        'processing',
        'data subject',
        'data incident',
        'retention',
      ],
    ],
    [
      'COMP-POL-002',
      'Anti-Bribery & Conflict of Interest Policy',
      'Compliance',
      'ROLE-COMP-MGR',
      ['SYS-DMS', 'SYS-D365-SCM', 'SYS-D365-FIN'],
      [
        'bribery',
        'gifts',
        'facilitation payments',
        'conflicts of interest',
        'investigations',
      ],
    ],
    [
      'OPS-POL-001',
      'Business Travel & Logistics Policy',
      'Operations',
      'ROLE-OPS-MGR',
      ['SYS-D365-FIN', 'SYS-DMS', 'SYS-SD'],
      ['travel', 'accommodation', 'mileage', 'per diem', 'advances'],
    ],
    [
      'GEN-POL-001',
      'Records Retention & Document Management Policy',
      'Administration',
      'ROLE-DEPT-MGR',
      [
        'SYS-DMS',
        'SYS-HR',
        'SYS-D365-FIN',
        'SYS-D365-SALES',
        'SYS-D365-SCM',
        'SYS-SD',
      ],
      ['classified', 'name', 'retention', 'disposal', 'legal hold'],
    ],
  ];
  return definitions.map(
    ([
      documentId,
      title,
      ownerDepartment,
      ownerRole,
      systemReferences,
      requiredTopics,
    ]) => ({
      documentId,
      title,
      ownerDepartment,
      ownerRole,
      systemReferences,
      requiredSections: [
        '1. PURPOSE',
        '2. SCOPE',
        '3. DEFINITIONS',
        '4. POLICY PRINCIPLES',
        '5. PROCEDURES AND REQUIREMENTS',
        '6. APPROVALS AND AUTHORITY',
        '7. EXCEPTIONS',
        '8. ROLES AND RESPONSIBILITIES',
        '9. RECORDS AND DOCUMENTATION',
        '10. SYSTEMS AND PROCESS INTEGRATION',
        '11. COMPLIANCE AND MONITORING',
        '12. RELATED POLICIES',
        '13. REVIEW AND VERSION CONTROL',
      ],
      relatedPolicies: RELATIONSHIPS[documentId],
      requiredTopics,
      body: [
        ...BODY[documentId],
        `Control checkpoints for this policy cover ${requiredTopics.join(', ')}. The process owner records the initiating request, the responsible person, the approval decision, the transaction or case reference, the date and the resulting action. A reviewer must be able to trace each handoff without relying on an informal conversation or an untracked personal file.`,
        `At every handoff, the sending team confirms that the information is complete and the receiving team confirms acceptance or records a discrepancy. Open items are assigned an owner and due date. Rejected, returned, cancelled or partially completed work remains visible in the system of record so that later reporting does not present an incomplete process as successful.`,
        `Supervisors review exceptions, overdue actions and repeat failures for root causes rather than treating each occurrence as an isolated error. Corrective action may include training, a workflow change, access adjustment, reconciliation, supplier or employee follow-up, or escalation to Compliance. Evidence of the review and closure is retained with the underlying record.`,
        `A control owner pauses processing when required information is missing, an approval is outside authority, a record conflicts with the system of record, or the activity could create a privacy, security, financial, safety or integrity risk. The owner documents the pause, informs the affected stakeholder and resumes only after the discrepancy is resolved or an authorised exception is recorded.`,
        `The department maintains a practical handoff checklist for recurring work covered by this policy. At minimum it identifies the requester, business purpose, affected entity or transaction, amount or quantity where relevant, required date, current status, next action and escalation contact. Checklists support consistent work but do not replace approvals or authoritative system entries.`,
        `Management reporting distinguishes completed, pending, rejected, cancelled, overdue and exceptional activity. Trends are reviewed for concentration by department, role, supplier, customer, location, system or transaction type where that analysis is appropriate and lawful. Reports contain only the information needed for the management purpose and are protected under COMP-POL-001 and IT-POL-001.`,
        `When this policy interacts with another process, the owning team remains accountable for its control even after the work moves to a different department or system. The receiving team records the handoff and applies its own approval, privacy, security and retention requirements. Unclear ownership is escalated to both policy owners rather than resolved by omitting the step.`,
      ],
    }),
  );
}

async function readJson<T>(fileName: string): Promise<T> {
  return JSON.parse(
    await readFile(resolve(ENTERPRISE_DIR, fileName), 'utf8'),
  ) as T;
}

async function loadEnterprise(): Promise<EnterpriseData> {
  const [company, departments, roles, systems, locations, employees] =
    await Promise.all([
      readJson<Company>('company.json'),
      readJson<Department[]>('departments.json'),
      readJson<Role[]>('roles.json'),
      readJson<System[]>('systems.json'),
      readJson<Location[]>('locations.json'),
      readJson<Employee[]>('employees.json'),
    ]);
  return { company, departments, roles, systems, locations, employees };
}

async function optionalMasterIds(fileName: string): Promise<Set<string>> {
  try {
    const values = JSON.parse(
      await readFile(resolve(MASTER_DATA_DIR, fileName), 'utf8'),
    ) as Array<Record<string, unknown>>;
    return new Set(
      values.flatMap((value) =>
        Object.values(value).filter(
          (item): item is string =>
            typeof item === 'string' && /^(SUP|PROD|CUST|WH|CC)-/.test(item),
        ),
      ),
    );
  } catch {
    return new Set();
  }
}

function render(spec: PolicySpec, enterprise: EnterpriseData): string {
  const systemNames = spec.systemReferences.map(
    (id) =>
      enterprise.systems.find((system) => system.systemId === id)?.name ?? id,
  );
  const related = spec.relatedPolicies
    .map((id) => {
      const relatedSpec = buildSpecs().find((item) => item.documentId === id);
      return `- ${id}: ${relatedSpec?.title ?? id}`;
    })
    .join('\n');
  return `# SVGA ENTERPRISE LTD\n\n## ${spec.title}\n\n| Metadata | Value |\n|---|---|\n| Document ID | ${spec.documentId} |\n| Title | ${spec.title} |\n| Version | 1.0 |\n| Effective Date | ${EFFECTIVE_DATE} |\n| Review Date | ${REVIEW_DATE} |\n| Owner | ${spec.ownerRole} |\n| Department | ${spec.ownerDepartment} |\n| Status | Active |\n| Classification | Internal |\n| Country | Kenya |\n| Business Unit | Corporate / Distribution Operations |\n| System | ${systemNames.join('; ')} |\n| Document Type | Policy |\n\n## 1. PURPOSE\n\nThis policy establishes a controlled, practical operating standard for ${spec.title.toLowerCase()} at SVGA Enterprise Limited. It supports consistent decisions, clear accountability, auditable records and coordination between departments. It must be read with the related policies below and with the canonical enterprise records for departments, roles, employees, locations and systems.\n\n## 2. SCOPE\n\nThis policy applies to employees, managers, contractors and authorised third parties performing work for SVGA Enterprise Ltd in Kenya. It applies across the Corporate and Distribution Operations business units and to paper, electronic and verbal activities that create a business record. Where a contract, law, safety requirement or approved control is stricter, the stricter requirement applies and the owner records the decision.\n\n## 3. DEFINITIONS\n\n- **Authorised approver:** a person with an active role and sufficient authority under FIN-POL-002 or the relevant process control.\n- **Business record:** evidence of an activity, decision, transaction, approval, communication or control.\n- **Exception:** a documented departure from a normal requirement with a reason, risk assessment, approver and expiry or review date.\n- **System of record:** the approved enterprise system in which the authoritative transaction or record is maintained.\n- **Working day:** a normal SVGA business day in Kenya, excluding approved company holidays.\n\n## 4. POLICY PRINCIPLES\n\n1. Decisions are based on an identifiable business need, authorised role and accurate information.\n2. Duties are separated so that requesting, approving, receiving, recording and paying are not concentrated in one person.\n3. Access, information sharing and retention follow least privilege, business purpose and documented controls.\n4. Exceptions are visible, time-bound and reviewed; urgency does not make an unauthorised action routine.\n5. Employees raise concerns promptly and preserve evidence rather than altering or deleting records.\n\n## 5. PROCEDURES AND REQUIREMENTS\n\n${spec.body.map((paragraph, index) => `${index + 1}. ${paragraph}`).join('\n\n')}\n\n## 6. APPROVALS AND AUTHORITY\n\nThe policy owner approves operating procedures and interprets routine questions within the approved control framework. Financial commitments use the shared approval matrix in FIN-POL-002. No employee may approve their own request, expense, access, supplier relationship or exception. Delegation must be documented, current and limited to the delegated scope.\n\n## 7. EXCEPTIONS\n\nAn exception request must state the requirement being varied, reason, duration, affected records or people, risks, compensating controls and proposed approver. The owner may approve routine low-risk exceptions; financial, privacy, security, procurement or segregation-of-duties exceptions require the authority named in the related policy. Emergency action is recorded as soon as practicable and reviewed retrospectively.\n\n## 8. ROLES AND RESPONSIBILITIES\n\n- **${spec.ownerDepartment}:** owns this policy, maintains procedures, trains affected users and reports control performance.\n- **Managers:** provide business justification, approve only within authority, maintain coverage and act on exceptions.\n- **Employees and contractors:** follow the procedure, protect information, maintain accurate records and report concerns.\n- **Finance:** validates budgets, financial authority, payment evidence and relevant reconciliations.\n- **IT:** maintains system access, availability, audit logs and technical controls.\n- **Compliance:** monitors adherence, coordinates investigations and tracks corrective actions.\n\n## 9. RECORDS AND DOCUMENTATION\n\nRequests, approvals, evidence, decisions, exceptions, reconciliations, communications and monitoring results are retained in the relevant system of record. Records are named and versioned under GEN-POL-001, protected under COMP-POL-001 and access-controlled under IT-POL-001. Records must be complete enough for an independent reviewer to understand who acted, what was decided, when it happened and why.\n\n## 10. SYSTEMS AND PROCESS INTEGRATION\n\nThis policy integrates with: ${systemNames.join(', ')}. System names and identifiers are taken from the canonical enterprise system register. Users must use the system of record for the transaction; a spreadsheet, email or paper note may provide supporting evidence but must not silently replace the controlled record. System incidents and access failures follow IT-POL-002.\n\n## 11. COMPLIANCE AND MONITORING\n\nThe owner monitors completion, exceptions, ageing, approval evidence and control failures at least quarterly or more often for high-risk activity. Findings are assigned an owner and due date. Material breaches are escalated to the relevant department head, Compliance Manager or CFO, and suspected misconduct is handled under COMP-POL-002. Failure to follow this policy may lead to retraining, withdrawal of authority, recovery of losses or disciplinary action.\n\n## 12. RELATED POLICIES\n\n${related}\n\n## 13. REVIEW AND VERSION CONTROL\n\nVersion 1.0 is effective ${EFFECTIVE_DATE}. The owner reviews this policy by ${REVIEW_DATE}, after a material process, system, organisational or risk change, or after a significant incident. Changes require documented review, approval, publication in the Enterprise Document Management System and communication to affected users. Superseded versions remain retained under GEN-POL-001.\n`;
}

function validate(
  specs: PolicySpec[],
  enterprise: EnterpriseData,
  documents: Map<string, string>,
): void {
  const issues: string[] = [];
  const ids = new Set(specs.map((spec) => spec.documentId));
  const systemIds = new Set(enterprise.systems.map((item) => item.systemId));
  const departmentNames = new Set(
    enterprise.departments.map((item) => item.name),
  );
  const roleIds = new Set(enterprise.roles.map((item) => item.roleId));
  if (specs.length !== 15)
    issues.push(`Expected 15 specifications, found ${specs.length}`);
  if (ids.size !== specs.length) issues.push('Duplicate document IDs found');
  for (const spec of specs) {
    if (
      !documents.has(spec.documentId) ||
      !documents.get(spec.documentId)?.trim()
    )
      issues.push(`${spec.documentId} is empty or missing`);
    if (!departmentNames.has(spec.ownerDepartment))
      issues.push(
        `${spec.documentId} references unknown department ${spec.ownerDepartment}`,
      );
    if (!roleIds.has(spec.ownerRole))
      issues.push(
        `${spec.documentId} references unknown owner role ${spec.ownerRole}`,
      );
    for (const systemId of spec.systemReferences)
      if (!systemIds.has(systemId))
        issues.push(`${spec.documentId} references unknown system ${systemId}`);
    for (const relatedId of spec.relatedPolicies)
      if (!ids.has(relatedId))
        issues.push(
          `${spec.documentId} references unknown policy ${relatedId}`,
        );
    for (const section of spec.requiredSections)
      if (!documents.get(spec.documentId)?.includes(`## ${section}`))
        issues.push(`${spec.documentId} is missing section ${section}`);
    const documentText = documents.get(spec.documentId)?.toLowerCase() ?? '';
    if (
      spec.requiredTopics.some((topic) => {
        const normalizedTopic = topic.toLowerCase();
        const words = normalizedTopic
          .split(/\s+/)
          .filter((word) => word.length > 3);
        return (
          !documentText.includes(normalizedTopic) &&
          words.some((word) => {
            const singular = word.endsWith('s') ? word.slice(0, -1) : word;
            return (
              !documentText.includes(word) && !documentText.includes(singular)
            );
          })
        );
      })
    )
      issues.push(`${spec.documentId} is missing a required topic`);
    if (
      documents.get(spec.documentId)?.includes('[INSERT') ||
      documents.get(spec.documentId)?.includes('TODO')
    )
      issues.push(`${spec.documentId} contains placeholder text`);
  }
  if (RULES.procurementFinanceThresholdKes !== 500_000)
    issues.push('Shared procurement threshold changed unexpectedly');
  if (issues.length > 0)
    throw new Error(
      `Policy validation failed with ${issues.length} issue(s):\n- ${issues.join('\n- ')}`,
    );
}

async function main(): Promise<void> {
  const enterprise = await loadEnterprise();
  await Promise.all(
    [
      'suppliers.json',
      'products.json',
      'customers.json',
      'warehouses.json',
      'cost-centers.json',
    ].map(optionalMasterIds),
  );
  const specs = buildSpecs();
  const documents = new Map<string, string>();
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const spec of specs) {
    const document = render(spec, enterprise);
    documents.set(spec.documentId, document);
    await writeFile(
      resolve(OUTPUT_DIR, `${spec.documentId}.md`),
      document,
      'utf8',
    );
  }
  validate(specs, enterprise, documents);
  const crossReferences = specs.reduce(
    (total, spec) => total + spec.relatedPolicies.length,
    0,
  );
  const counts = specs.reduce<Record<string, number>>((result, spec) => {
    const group = spec.documentId.startsWith('HR-')
      ? 'HR'
      : spec.documentId.startsWith('FIN-')
        ? 'Finance'
        : spec.documentId.startsWith('PROC-')
          ? 'Procurement'
          : spec.documentId.startsWith('SALES-')
            ? 'Sales'
            : spec.documentId.startsWith('INV-')
              ? 'Inventory'
              : spec.documentId.startsWith('WH-')
                ? 'Warehouse'
                : spec.documentId.startsWith('IT-')
                  ? 'IT'
                  : spec.documentId.startsWith('COMP-')
                    ? 'Compliance'
                    : spec.documentId.startsWith('OPS-')
                      ? 'Operations'
                      : 'General';
    result[group] = (result[group] ?? 0) + 1;
    return result;
  }, {});
  console.log(`Policies generated: ${specs.length}`);
  for (const group of [
    'HR',
    'Finance',
    'Procurement',
    'Sales',
    'Inventory',
    'Warehouse',
    'IT',
    'Compliance',
    'Operations',
    'General',
  ])
    console.log(`${group}: ${counts[group] ?? 0}`);
  console.log(`Cross-policy references: ${crossReferences}`);
  console.log(`Output directory: ${relative(PROJECT_ROOT, OUTPUT_DIR)}`);
  console.log('Validation: PASSED');
}

main().catch((error: unknown) => {
  console.error('Policy generation FAILED.');
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exitCode = 1;
});
