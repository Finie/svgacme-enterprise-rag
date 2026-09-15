# Provider and configuration

EmbeddingProvider exposes `space`, `apiCalls`, `embed(text)` and `embedBatch(texts)`. Two verified adapters exist behind this interface — Google (Gemini API) and OpenAI — selected only by `EMBEDDING_PROVIDER`; no vendor code is spread through search/storage. Tests inject an implementation or fetch mock. Production configuration accepts only implemented providers and verified models per provider; there is no fake-provider environment switch. `createEmbeddingProvider(config)` (`apps/src/embeddings/providers/index.ts`) is the single selection point used by both the Nest module and the CLI scripts.

| Variable              | Default              | Meaning                                                             |
| --------------------- | -------------------- | -------------------------------------------------------------------- |
| EMBEDDING_PROVIDER    | google                | Adapter identity: `google` or `openai`                             |
| EMBEDDING_MODEL       | gemini-embedding-001  | Verified model for the selected provider (see below)               |
| EMBEDDING_DIMENSIONS  | 1536                 | Must match the migrated `vector(1536)` column, for either provider |
| EMBEDDING_VERSION     | content-v1           | Embedding input/processing version                                 |
| EMBEDDING_API_KEY     | unset                | Required for paid calls, not dry runs/validation                   |
| EMBEDDING_BATCH_SIZE  | 32                   | Inputs per batch, integer 1–2048                                    |
| EMBEDDING_TIMEOUT_MS  | 30000                | Per-attempt timeout, 1–120000 ms                                    |
| EMBEDDING_MAX_RETRIES | 3                    | Additional attempts, 0–5                                            |

## Google (configured provider)

Model `gemini-embedding-001` natively outputs 3072-dimension vectors but supports Matryoshka-truncated `outputDimensionality`; this system requests **1536** to match the existing `vector(1536)` column, verified empirically against the live API (`npm run embeddings:smoke`) rather than assumed. The adapter calls `batchEmbedContents` (used for both single and batch requests — a single `embed()` call is a batch of one) via native `fetch`, authenticated with the `x-goog-api-key` header rather than the `key` query parameter, so the credential never appears in a URL, access log or proxy log.

Two behaviors are specific to Google and documented here because they are not obvious from the shared `EmbeddingProvider` interface:

- **Asymmetric task types.** Gemini embedding models improve retrieval quality when the caller declares whether text is a query or a document. Since `embed(text)` is only ever called by `SemanticSearchService` for the user's query, and `embedBatch(texts)` is only ever called by `EmbeddingsService` for chunk content, the adapter maps `embed` → `taskType: RETRIEVAL_QUERY` and `embedBatch` → `taskType: RETRIEVAL_DOCUMENT` without changing the shared interface. OpenAI has no equivalent distinction.
- **Client-side normalization.** Google documents that only the model's default (3072) output is pre-normalized to unit length; a truncated `outputDimensionality` such as 1536 is not (verified: a live response measured L2 norm ≈ 0.69, not 1). pgvector cosine distance (`<=>`) is scale-invariant, so this has no effect on ranking correctness by itself. The adapter still normalizes every vector to unit length before returning it, purely so stored vectors are consistent with OpenAI's natively-normalized output and remain safe if a future change introduces a magnitude-sensitive metric (inner product, L2). This is a deliberate defensive choice, not a correctness requirement of the current cosine-only design.
- **No per-item index in batch responses.** Unlike OpenAI's `data[].index`, Google's `batchEmbedContents` response (`embeddings: [{ values }]`) does not echo which request each item corresponds to; Google documents response order as matching request order, and the adapter trusts that contract, verifying only response length against the request count. This is a narrower guarantee than OpenAI's index-verified reordering and is called out explicitly rather than implied.

Verified once against the live API: `gemini-embedding-001` at `outputDimensionality: 1536` returns exactly 1536 finite float values per input, and a 32-item `batchEmbedContents` call succeeds (the configured default batch size). See the [Gemini API embeddings documentation](https://ai.google.dev/gemini-api/docs/embeddings) for the endpoint, task types and dimensionality contract.

## OpenAI (alternative provider)

Set `EMBEDDING_PROVIDER=openai` with `EMBEDDING_MODEL=text-embedding-3-small` (native 1536) or `text-embedding-3-large` (explicitly shortened server-side to 1536 via the `dimensions` request field). The adapter calls `POST /v1/embeddings` with native fetch, explicit float encoding and dimensions, authenticated with a bearer token. Returned model, input indexes, batch length and every vector are validated; batches are reordered using the response's `index` field. See the [official embedding guide](https://developers.openai.com/api/docs/guides/embeddings) and [API contract](https://developers.openai.com/api/reference/resources/embeddings/methods/create).

## Shared behavior

Input is the canonical chunk content only; metadata is filtered relationally, not appended as a surrogate for filters. Query text is trimmed. Retries cover 429, 500, 502, 503, 504, network failures and timeout/abort errors, for both providers identically (the retry policy is HTTP-status-driven, not vendor-specific). Exponential delay starts at 500 ms plus jitter; a `Retry-After` seconds/date header is respected within a 30-second cap. All retries and request timeouts are bounded per `EMBEDDING_MAX_RETRIES`. HTTP 400/401/403 and invalid response contracts are not retried — a sustained per-minute rate/quota limit (observed in practice against the live Google API while embedding the 240-chunk corpus) can still exhaust bounded retries; the fix is to rerun the idempotent build after the provider's quota window resets, not to retry indefinitely inline. Errors omit response bodies, credentials and input text.

Batch count is configurable, not a token-limit guarantee. Current short policy chunks fit comfortably at the default batch size of 32 for both providers (verified against the live Google API). Large future chunks/batches may exceed provider per-input, aggregate token, or per-minute rate limits and fail with a non-retried 400 or a retry-exhausted 429; decrease `EMBEDDING_BATCH_SIZE` before rerunning. Model-specific token packing is not implemented in this phase.

A dimension change fails configuration until migrated. For a new dimension, retain the old space in an archive/shadow table if historical comparison is needed, create a new `vector(N)` column/table and matching CHECKs, update `DATABASE_DIMENSIONS` and the provider contract, rebuild the new space, evaluate it, then switch query configuration. Never pad, truncate or relabel existing real vectors. A same-dimension model/version or provider change needs no schema migration but must build a separate keyed space (by `provider, model, version`) before retrieval — switching `EMBEDDING_PROVIDER` from `google` to `openai` (or vice versa) is exactly this case, not a migration.
