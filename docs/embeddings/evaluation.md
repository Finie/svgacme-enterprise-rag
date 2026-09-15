# Retrieval evaluation

`npm run evaluate:retrieval -- --dry-run` selects and counts the supported subset with no provider calls. The existing 173 PostgreSQL evaluation questions remain separate from knowledge. The initial subset is 20 questions: answerability=answerable, expected_behavior=answer, at least one required source, and every required source is a policy. The other 153 questions (including mixed structured/scenario questions and abstention cases) are excluded, not silently scored as retrieval failures.

Only question text, identity, answerability/behavior and required-source policy/section locators are read. Expected answers, acceptable answer points and reasoning steps are never selected or sent to the provider. Questions are transient query inputs, not persisted embeddings or production knowledge. Neither answers nor retrieved text is sent to a generation model.

Real evaluation first requires full current-space embedding coverage. Questions are batch embedded and searched at top 10 without ground-truth policy filters. Each question's required locators are deduplicated. A source with a resolved policySectionOrdinal requires the same policy and section; a null section locator requires the same policy only. Ambiguous labels (e.g. Approval Authority) stay policy-level, following the existing logical model; no fuzzy heading matching is invented.

For each K=1,3,5,10:

- Recall@K is the fraction of unique required policy/section locators represented by the top K chunks. Multiple chunks from one source do not multiply recall.
- Precision@K is the number of top K chunks matching any required locator divided by K (missing results count as misses). Multiple relevant chunks may count for precision.
- MRR@K is the reciprocal rank of the first relevant chunk, or zero if absent.

The report macro-averages these metrics over supported questions and includes question IDs, ground truth and retrieved provenance for audit. It does not measure answer quality or claim success on excluded questions. Metrics are not computed from similarity thresholds.

## Measured result (real Google provider, 20/20 supported questions, top-10 retrieval)

Measured 2026-09-14 against the fully embedded 240-chunk corpus, `gemini-embedding-001` at 1536 dimensions, one query-embedding API call per question:

| K  | Recall@K | Precision@K | MRR@K |
| -- | -------- | ------------ | ----- |
| 1  | 0.725    | 0.850        | 0.850 |
| 3  | 0.900    | 0.567        | 0.900 |
| 5  | 0.950    | 0.390        | 0.900 |
| 10 | 0.950    | 0.230        | 0.900 |

Recall rises sharply from K=1 to K=3 and plateaus near 0.95 by K=5, meaning the correct policy/section is almost always present in the top handful of results even when it does not rank first. Precision falls with K by construction (each question has few relevant locators against a fixed-size result set). This measures retrieval only — no answer was generated or judged.
