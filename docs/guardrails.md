# Phase 7: application-controlled question answering

The existing `/questions` endpoint now uses this pipeline:

```text
User → Gate 1 → Router → Structured / Semantic / Hybrid retrieval
     → Gate 2 → deterministic reranking → Context Builder
     → Gemini → Gate 3 → Answer + validated citations
```

`QuestionsService` orchestrates separate injectable input, retrieval, evidence, context, generation, and output services. Controllers only extract the request fields. `/search` remains a retrieval-only endpoint. No agents, generated SQL, tools, external business systems, or web browsing were added.

## Gate 1

Decisions: `ALLOW`, `OUT_OF_SCOPE`, `PROMPT_INJECTION`, `UNSAFE`, `INVALID`. Empty/non-string/overlong questions and malformed `topK` stop before embedding or generation. All question responses include a request ID, including malformed inputs.

Security checks run first. They normalize Unicode and zero-width characters and reject known instruction overrides and requests for credentials, environment variables, API keys, and certain personal details. These checks are intentionally deterministic. They do not constitute complete protection against encoded, indirect, multilingual, or novel attacks. They may reject legitimate security-policy discussions.

Explicit enterprise context remains in scope even if the requested fact is absent: stock-option questions are allowed into retrieval, then abstain if unsupported. Otherwise, the existing embedding provider compares the question against four enterprise domain descriptions and an outside-domain description. The nearest class wins; `GUARDRAIL_SCOPE_MARGIN` is a configurable relative margin, default zero. This is a prototype classifier, not a calibrated probability. `GUARDRAIL_SEMANTIC_SCOPE=false` disables this fallback and uses the conservative explicit-context check. No generation model participates in this decision. Scope embedding failures return `unavailable` without generation.

Routes: `POLICY`, `STRUCTURED`, `SEMANTIC`, `HYBRID`, `CROSS_DOMAIN`. Reviewed intent-to-policy mappings constrain policy coverage. Routing chooses sources, never the final business decision.

## Retrieval and Gate 2

Structured templates use parameterized Prisma queries for product stock, employee/role/approval relationships, supplier/product relationships, named role authority, department heads, company profile, employee departments, cost centers, named system status, warehouse cities, product suppliers, and customer account managers. Named stock queries resolve product and warehouse names against canonical records. Projections omit employee contact details, credentials, and unrestricted record dumps. Both the requested `PROD-` syntax and the corpus's actual `PRD-` identifiers are recognized; nonexistent IDs remain nonexistent. Unsupported structured intents abstain. This is a deliberately bounded template set, not a general natural-language SQL implementation.

Policy retrieval retains pgvector cosine search and freshness checks. The router also searches explicitly needed policy IDs, deduplicates chunks, and verifies current policy status is `Active`. Only useful, authoritative evidence passes the gate: source locator, content, finite score above the calibrated threshold, lexical relevance, no detected document injection, required policy/record coverage, and conservative question-concept coverage. SQL rows do not need a semantic similarity score. Cross-domain coverage is conjunctive: every required source must be present.

Decisions: `SUFFICIENT`, `INSUFFICIENT`, `NO_EVIDENCE`, `CONFLICTING`. Every decision other than `SUFFICIENT` stops before `AnswerService.assertConfigured()` and before generation. Nearby policy chunks alone cannot establish that a missing stock-option policy exists.

Conflict detection checks explicit structured fact keys and narrow numeric statements about annual leave and approval limits. Different values for the same key cause abstention; no source is silently preferred. This is not a general contradiction detector: differently worded rules, conditions, units, or subjects can evade it. It can also abstain conservatively when labels are ambiguous.

The existing scenario-based evaluation questions require context deliberately excluded from production retrieval. A scenario identifier requires `reviewed_scenario_context`; the current production router cannot satisfy that requirement and abstains. Evaluation answers, expected outcomes, reasoning keys, and synthetic scenario answers are never imported into the production evidence context.

## Calibration and evaluation

Run `npm run evaluate:guardrails` with the existing database and embedding configuration. It evaluates all 173 questions, reports answerable/unanswerable score distributions and per-question decisions, and writes `docs/guardrail-evaluation.json` plus the model-bound production default in `calibration.ts`. Negative business-action questions are still answerable: an evidence-based “no” is different from a security rejection.

Candidate thresholds are observed best retrieval scores. Selection minimizes full-gate false passes, then false abstentions, then prefers the highest remaining threshold. Score-only errors are reported separately. This uses the calibration population itself, not a held-out validation set; results must not be presented as independent generalization accuracy. The small unanswerable set limits what zero observed false passes establishes.

The evaluator caches only embeddings for reuse, keyed by text, embedding space, and query/document task type. Retrieval and gate decisions are rerun against the current database. Local intermediate artifacts remain under ignored `tmp/`. A failed run does not replace the previous calibration. The production default only applies to the matching provider/model/dimensions/version. Other spaces fail closed until calibrated or explicitly configured. `GUARDRAIL_EVIDENCE_THRESHOLD` overrides the default; an explicit empty value disables semantic generation. SQL-only evidence can still pass.

Conservative term coverage and limited structured templates cause false abstentions, particularly for paraphrases, named entities without supported lookups, and synthetic scenarios. Consult the measured report before deployment; this phase does not claim that all 173 questions are answerable by the implemented router.

## Context, generation, and Gate 3

After sufficiency, the context builder deterministically reranks by lexical relevance, then similarity and source ID. It preserves the entire useful evidence set so a required hop is not lost after Gate 2. The application assigns `E1`, `E2`, etc. `topK` influences candidate collection; it does not truncate required evidence after sufficiency.

The Gemini system instruction separates instructions from JSON-encoded user question and retrieved evidence. Evidence is explicitly untrusted data that cannot override instructions. Only supplied enterprise facts and evidence IDs may be used; the prompt prohibits invented facts and filling gaps with pretrained knowledge. Factual sentences must carry citations. Numeric synthesis is deliberately restricted to supplied values.

Gate 3 validates every bracket citation against the actual supplied evidence, reconstructs citation metadata on the server, requires citations on each sentence, and rejects numeric values absent from that sentence's cited sources. It detects the controlled 24-versus-30-day error. Secret-shaped strings and configured secret values are blocked. Missing evidence, invalid citations, and unsupported output are never returned as answers.

Statuses: `GROUNDED`, `UNSUPPORTED_CLAIM`, `INVALID_CITATION`, `INSUFFICIENT_EVIDENCE`. Invalid citations allow exactly one retry with stricter instructions. Unsupported claims and model abstentions stop immediately. After failure, only a fixed abstention is returned; rejected output and raw retrieved evidence are not returned.

`GROUNDED` means these first-version checks passed, not that entailment has been proved. The checker can miss unsupported nonnumeric claims, swapped subjects/units, and incorrect claims using numbers that happen to exist in the cited chunk. It may reject legitimate paraphrases, arithmetic, or citation formatting. `OutputGuardrailService` is injectable so a stronger evaluator can replace it without changing orchestration.

## API and observability

Responses distinguish `answered`, `out_of_scope`, `rejected`, `insufficient_evidence`, and `unavailable`. `/questions` uses HTTP 200 with explicit application outcomes, including malformed question values; `/search` retains its existing HTTP validation behavior. The old numeric citation/raw-source response is replaced with server-validated `E` citations. `sources` is retained as an alias for citation metadata, not full chunks.

Example:

```json
{
  "status": "answered",
  "answer": "Annual leave is 24 days [E1].",
  "citations": [{ "id": "E1", "sourceType": "policy", "sourceId": "HR-POL-001", "section": "Leave" }],
  "grounding": { "status": "GROUNDED" },
  "requestId": "application-generated UUID"
}
```

Every orchestration outcome records request ID, input decision, route, retrieval strategy, semantic/structured counts, best semantic score, evidence decision, reranking flag, generation flag/model/attempt count, citation count, grounding status, abstention flag, and total latency in milliseconds. Logs omit questions, prompts, evidence bodies, generated output, provider errors, credentials, and database URLs. Provider/database failures return a fixed unavailable response.

## Verification

- Unit and orchestration fixtures test input decisions, routes, authority/coverage, empty/weak/missing-topic evidence, conflicts, SQL-only evidence, hybrid/cross-domain paths, citations, unsupported numbers, bounded retries, and discarded output.
- Mandatory mock generation counts are exactly zero for out-of-scope, prompt injection, unsafe requests, no evidence, and insufficient evidence. Rejected requests also prove zero enterprise retrieval calls.
- HTTP integration verifies request IDs, outcome shapes, validated citations, and blocked generation.
- PostgreSQL integration checks fixed stock and authority queries. Policy results in the new routing fixtures are controlled mocks; existing pgvector integration tests separately exercise real vector ranking and provenance.
- Existing generation-provider tests verify configuration, system instructions, hidden-thought exclusion, sanitized failures, and incomplete-response rejection.
- The 173-question evaluation uses real embeddings and PostgreSQL retrieval, with no generation calls. Gate 3 is tested with controlled model responses; this evaluation does not establish live Gemini answer quality over all 173 questions.

## Measured implementation status (2026-09-18)

Calibration used all **173** existing questions, **163 answerable** and **10 unanswerable**, with `google / gemini-embedding-001`, 1536 dimensions, `content-v1`, and cosine similarity. The selected threshold is **0.594082320089203**.

| Population | Minimum | 25th percentile | Median | 75th percentile | Maximum |
|---|---:|---:|---:|---:|---:|
| Answerable (163) | 0.575898 | 0.645576 | 0.676556 | 0.702825 | 0.785084 |
| Unanswerable (10) | 0.570836 | 0.577759 | 0.600396 | 0.608664 | 0.713225 |

Gate 1 allowed 167 requests and rejected/classified six others, with **zero false rejections of answerable questions**. Four in-scope but unanswerable requests were allowed into retrieval, then stopped by Gate 2. This is intentional, not a scope-classification error.

The complete pipeline allowed **60/163 answerable questions**, with **103 false abstentions**, and allowed **0/10 unanswerable questions**. A score-only classifier at the same threshold would have five false positives and nine false negatives. These are calibration-set results, not held-out accuracy. The high false-abstention count is a substantial limitation: this implementation is conservative and does not provide broad enterprise question coverage yet.

Verification completed:

| Check | Result |
|---|---|
| Unit suite, including guardrails, generation, retrieval and data tooling | 120 tests passed across 7 files |
| HTTP, guardrail SQL, database, knowledge and pgvector integration | 44 tests passed across 5 files |
| Nest build and full TypeScript check | Passed |
| Lint | Passed with two pre-existing warnings in untouched embedding files |
| Diff whitespace check | Passed |

[Live dependency smoke results](guardrail-live-smoke.json) establish that annual leave, real `PRD-001` stock, Finance Manager approval, and the existing P1/customer-data cross-domain question pass Gate 2. Weather, prompt injection, API-key requests, and missing stock-option evidence stop with **zero generation invocations**. The stock-option question scored about **0.6951**, above the threshold, but still abstained on coverage.

**Live generation was not verified:** both `GEMINI_API_KEY` and `GEMINI_GENERATION_MODEL` are unset in the local environment. Eligible live requests return `unavailable` at generation configuration validation. Successful generation, grounded output, fake citations, unsupported claims, conflicts, and forbidden-path invocation counts are verified using controlled providers. The mock-provider tests separately prove zero generation calls for empty retrieval and weak/insufficient evidence, without relying on missing live credentials.
