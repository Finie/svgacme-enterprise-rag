# HTTP API

Import [postman.collection.json](postman.collection.json) into Postman. Its `baseUrl` defaults to `http://127.0.0.1:3000`.

## Start

Prepare the database and embeddings as described in the root README, then run `npm run start:dev`. PostgreSQL must be running. If the Docker app already occupies port 3000, run `docker compose stop app` before starting the local server.

For `/questions`, set `GEMINI_API_KEY` and `GEMINI_GENERATION_MODEL` in `.env`. Choose a Gemini model available to your account that supports `generateContent`; this is a text-generation model, not `gemini-embedding-001`. Embedding configuration remains separate. Restart after changing `.env`.

| Endpoint | Input | Result |
| --- | --- | --- |
| `GET /health` | None | Server and database status; 503 if database probe fails |
| `GET /policies/:id` | Policy ID in URL | Policy record with ordered sections; 404 if missing |
| `POST /search` | `{"query":"Annual leave rules?","topK":5}` | Query and ranked evidence chunks |
| `POST /questions` | `{"question":"Annual leave rules?","topK":5}` | Question, generated answer, numbered source chunks |

Send POST bodies as raw JSON with `Content-Type: application/json`. Text must contain 1–4000 characters; optional `topK` defaults to 5 and must be an integer from 1 to 20. Invalid inputs return 400. Search requires complete, current embeddings and returns 503 for unavailable dependencies. Questions return 503 for missing generation settings and 502 for generation-provider failures or incomplete responses.

`/questions` implements one retrieval-and-generation pass over policies. It instructs Gemini to cite sources as `[1]`, `[2]`, etc. and to acknowledge insufficient evidence. Source references are returned for inspection; generated claims and citation correctness are not independently verified. It does not yet perform autonomous tool selection or structured operational queries. Empty retrieval results skip generation.

Search and questions make real embedding calls; questions also send retrieved policy text to Gemini for generation. These calls may incur charges. The health endpoint checks the database only, not provider availability or embedding readiness.

The API is currently for local development, without authentication or per-user authorization. It binds to `127.0.0.1` by default. Docker binds within the container and publishes on host loopback. Add access controls before exposing company data to other users.

## Feature folders

- `apps/src/app/`: root application module, controller, service, and tests.
- `apps/src/health/`: database health endpoint.
- `apps/src/policies/`: policy lookup controller and service.
- `apps/src/search/`: HTTP search and existing vector retrieval.
- `apps/src/questions/`: question orchestration and Gemini answer generation.
- `apps/src/http/`: shared HTTP request validation.

Generation follows the [Gemini generateContent API](https://ai.google.dev/api/generate-content).
