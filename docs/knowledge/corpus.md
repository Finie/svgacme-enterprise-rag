# Corpus boundary

All policies are logical documents; all nonempty policy section bodies are semantic knowledge. Empty sections intentionally produce zero chunks. Policy title, original heading, status, classification and department remain metadata. Policies are section-aware because future policy questions depend on meaning and require coherent evidence.

Employees, departments, roles, products, customers, suppliers, inventory, warehouses, cost centers and approval-authority tables remain relational. Counts, balances, manager relationships and approval limits require exact SQL queries, joins and numeric comparisons rather than similarity matching. Policy prose about approvals is knowledge; structured approval decisions remain database queries.

Scenario selection is an explicit comma-separated KNOWLEDGE_SCENARIO_IDS allowlist, empty by default. The source scenarios are synthetic evaluation fixtures and some events/context already describe policy interpretations; automatic inclusion would risk evaluation contamination even after removing answer-key fields. Opt-in is a corpus curation decision and selected scenarios must not also be used as held-out evaluation examples. All scenario metadata marks synthetic=true; these are illustrations, not operational history or authoritative policy.

Selected scenarios expose title as metadata and independently chunk Business Context, Description, Events (sequence order) and Relevant Facts. The database query positively selects only these narrative fields plus identity/category/difficulty. It never reads expectedOutcome, requiredReasoning, questionTypes, evaluation questions, expected answers, acceptable answer points or reasoning steps. Metadata does not copy the source record. No runtime option enables answer-key inclusion.
