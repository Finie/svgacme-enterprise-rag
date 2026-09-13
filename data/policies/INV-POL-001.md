# SVGA ENTERPRISE LTD

## Inventory Management & Stock Control Policy

| Metadata | Value |
|---|---|
| Document ID | INV-POL-001 |
| Title | Inventory Management & Stock Control Policy |
| Version | 1.0 |
| Effective Date | 2026-01-01 |
| Review Date | 2027-01-01 |
| Owner | ROLE-INV-MGR |
| Department | Inventory |
| Status | Active |
| Classification | Internal |
| Country | Kenya |
| Business Unit | Corporate / Distribution Operations |
| System | Microsoft Dynamics 365 Supply Chain Management; Microsoft Dynamics 365 Finance |
| Document Type | Policy |

## 1. PURPOSE

This policy establishes a controlled, practical operating standard for inventory management & stock control policy at SVGA Enterprise Limited. It supports consistent decisions, clear accountability, auditable records and coordination between departments. It must be read with the related policies below and with the canonical enterprise records for departments, roles, employees, locations and systems.

## 2. SCOPE

This policy applies to employees, managers, contractors and authorised third parties performing work for SVGA Enterprise Ltd in Kenya. It applies across the Corporate and Distribution Operations business units and to paper, electronic and verbal activities that create a business record. Where a contract, law, safety requirement or approved control is stricter, the stricter requirement applies and the owner records the decision.

## 3. DEFINITIONS

- **Authorised approver:** a person with an active role and sufficient authority under FIN-POL-002 or the relevant process control.
- **Business record:** evidence of an activity, decision, transaction, approval, communication or control.
- **Exception:** a documented departure from a normal requirement with a reason, risk assessment, approver and expiry or review date.
- **System of record:** the approved enterprise system in which the authoritative transaction or record is maintained.
- **Working day:** a normal SVGA business day in Kenya, excluding approved company holidays.

## 4. POLICY PRINCIPLES

1. Decisions are based on an identifiable business need, authorised role and accurate information.
2. Duties are separated so that requesting, approving, receiving, recording and paying are not concentrated in one person.
3. Access, information sharing and retention follow least privilege, business purpose and documented controls.
4. Exceptions are visible, time-bound and reviewed; urgency does not make an unauthorised action routine.
5. Employees raise concerns promptly and preserve evidence rather than altering or deleting records.

## 5. PROCEDURES AND REQUIREMENTS

1. Inventory records are maintained in Microsoft Dynamics 365 Supply Chain Management by product, site, warehouse, batch or other required control attribute. quantityOnHand is the physically recorded stock. quantityReserved is stock committed to approved demand. quantityAvailable is quantityOnHand less quantityReserved and any controlled hold. reorderLevel is the trigger for replenishment review; reorderQuantity is the approved quantity to order or transfer.

2. Inventory compares availability before a sales order is confirmed and reserves stock only against an approved demand. When quantityAvailable falls below reorderLevel, the Inventory Manager reviews demand, open purchase orders, stock in other warehouses and expected lead time. The resulting purchase request or transfer follows PROC-POL-001 and FIN-POL-002; a reorder signal is not an automatic purchase commitment.

3. Cycle counts and full stock counts are planned by risk and movement. Counters record the location, product, expected balance, counted balance, variance and evidence. Adjustments require an independent review; write-offs for damage, expiry, loss or obsolescence require the Inventory Manager and the approval level in FIN-POL-002. No employee may erase a transaction to hide a discrepancy.

4. Transfers require source, destination, product, quantity, reason and authorisation. Damaged or expired stock is segregated, labelled and held from sale. Warehouse confirms movement and condition under WH-POL-001; Finance receives valuation-impacting adjustments. Inventory reporting distinguishes physical stock, reserved stock, available stock, held stock and approved write-offs.

5. Control checkpoints for this policy cover inventory, product, quantity, reorderLevel, discrepancy. The process owner records the initiating request, the responsible person, the approval decision, the transaction or case reference, the date and the resulting action. A reviewer must be able to trace each handoff without relying on an informal conversation or an untracked personal file.

6. At every handoff, the sending team confirms that the information is complete and the receiving team confirms acceptance or records a discrepancy. Open items are assigned an owner and due date. Rejected, returned, cancelled or partially completed work remains visible in the system of record so that later reporting does not present an incomplete process as successful.

7. Supervisors review exceptions, overdue actions and repeat failures for root causes rather than treating each occurrence as an isolated error. Corrective action may include training, a workflow change, access adjustment, reconciliation, supplier or employee follow-up, or escalation to Compliance. Evidence of the review and closure is retained with the underlying record.

8. A control owner pauses processing when required information is missing, an approval is outside authority, a record conflicts with the system of record, or the activity could create a privacy, security, financial, safety or integrity risk. The owner documents the pause, informs the affected stakeholder and resumes only after the discrepancy is resolved or an authorised exception is recorded.

9. The department maintains a practical handoff checklist for recurring work covered by this policy. At minimum it identifies the requester, business purpose, affected entity or transaction, amount or quantity where relevant, required date, current status, next action and escalation contact. Checklists support consistent work but do not replace approvals or authoritative system entries.

10. Management reporting distinguishes completed, pending, rejected, cancelled, overdue and exceptional activity. Trends are reviewed for concentration by department, role, supplier, customer, location, system or transaction type where that analysis is appropriate and lawful. Reports contain only the information needed for the management purpose and are protected under COMP-POL-001 and IT-POL-001.

11. When this policy interacts with another process, the owning team remains accountable for its control even after the work moves to a different department or system. The receiving team records the handoff and applies its own approval, privacy, security and retention requirements. Unclear ownership is escalated to both policy owners rather than resolved by omitting the step.

## 6. APPROVALS AND AUTHORITY

The policy owner approves operating procedures and interprets routine questions within the approved control framework. Financial commitments use the shared approval matrix in FIN-POL-002. No employee may approve their own request, expense, access, supplier relationship or exception. Delegation must be documented, current and limited to the delegated scope.

## 7. EXCEPTIONS

An exception request must state the requirement being varied, reason, duration, affected records or people, risks, compensating controls and proposed approver. The owner may approve routine low-risk exceptions; financial, privacy, security, procurement or segregation-of-duties exceptions require the authority named in the related policy. Emergency action is recorded as soon as practicable and reviewed retrospectively.

## 8. ROLES AND RESPONSIBILITIES

- **Inventory:** owns this policy, maintains procedures, trains affected users and reports control performance.
- **Managers:** provide business justification, approve only within authority, maintain coverage and act on exceptions.
- **Employees and contractors:** follow the procedure, protect information, maintain accurate records and report concerns.
- **Finance:** validates budgets, financial authority, payment evidence and relevant reconciliations.
- **IT:** maintains system access, availability, audit logs and technical controls.
- **Compliance:** monitors adherence, coordinates investigations and tracks corrective actions.

## 9. RECORDS AND DOCUMENTATION

Requests, approvals, evidence, decisions, exceptions, reconciliations, communications and monitoring results are retained in the relevant system of record. Records are named and versioned under GEN-POL-001, protected under COMP-POL-001 and access-controlled under IT-POL-001. Records must be complete enough for an independent reviewer to understand who acted, what was decided, when it happened and why.

## 10. SYSTEMS AND PROCESS INTEGRATION

This policy integrates with: Microsoft Dynamics 365 Supply Chain Management, Microsoft Dynamics 365 Finance. System names and identifiers are taken from the canonical enterprise system register. Users must use the system of record for the transaction; a spreadsheet, email or paper note may provide supporting evidence but must not silently replace the controlled record. System incidents and access failures follow IT-POL-002.

## 11. COMPLIANCE AND MONITORING

The owner monitors completion, exceptions, ageing, approval evidence and control failures at least quarterly or more often for high-risk activity. Findings are assigned an owner and due date. Material breaches are escalated to the relevant department head, Compliance Manager or CFO, and suspected misconduct is handled under COMP-POL-002. Failure to follow this policy may lead to retraining, withdrawal of authority, recovery of losses or disciplinary action.

## 12. RELATED POLICIES

- SALES-POL-001: Sales Order & Customer Management Policy
- WH-POL-001: Warehouse Operations & Receiving Policy
- PROC-POL-001: Procurement & Purchasing Policy

## 13. REVIEW AND VERSION CONTROL

Version 1.0 is effective 2026-01-01. The owner reviews this policy by 2027-01-01, after a material process, system, organisational or risk change, or after a significant incident. Changes require documented review, approval, publication in the Enterprise Document Management System and communication to affected users. Superseded versions remain retained under GEN-POL-001.
