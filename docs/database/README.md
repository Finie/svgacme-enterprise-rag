# SVGA Enterprise database

The physical PostgreSQL implementation of [docs/data-model/](../data-model/README.md), the
approved logical model. This phase turns the generated corpus under `data/` into a real,
queryable relational database. It does **not** add embeddings, retrieval, an LLM/agent layer or
a chat endpoint — see [What this phase does not implement](#what-this-phase-does-not-implement).

Read next: [architecture.md](architecture.md) (design decisions), [migration.md](migration.md)
(schema/migrations), [seeding.md](seeding.md) (import pipeline), [indexing.md](indexing.md).

## Requirements

- Docker (for PostgreSQL + [pgvector](https://github.com/pgvector/pgvector))
- Node 24.15.0 (`.nvmrc`; `nvm use` if you have nvm)

## Quick start

```sh
cp .env.example .env        # edit POSTGRES_PASSWORD; keep DATABASE_URL in sync
npm install                 # also runs `prisma generate` (postinstall)

npm run db:up                # start PostgreSQL (docker compose)
npm run db:migrate           # apply migrations to an empty database
npm run db:seed              # import data/ into the database (safe to re-run)
npm run db:validate          # verify the database against data/
```

Other scripts:

```sh
npm run db:down              # stop PostgreSQL (volume persists)
npm run db:reset             # drop + recreate the database, re-migrate, re-seed
npm run db:studio            # Prisma Studio (browse the database)
npm run db:generate          # regenerate the Prisma client (postinstall does this too)
```

`npm run build` and `npm test` do not require PostgreSQL to be running — the generated NestJS
app boots without a database connection (see [architecture.md](architecture.md#nestjs-boundary)).
The database integration tests do require it:

```sh
npm run db:up && npm run db:migrate
npm run test:e2e
```

## What this phase does not implement

Per the task boundary, none of the following exist yet, anywhere in this codebase:
embeddings, embedding models, LLM calls (OpenAI/Anthropic/Gemini), RAG, retrieval, reranking,
semantic search, a chat endpoint, an agent, tool calling, prompt engineering. `pgvector` is
enabled at the database level only, for future readiness — see
[architecture.md#pgvector](architecture.md#pgvector).

The derived [knowledge ingestion layer](../knowledge/README.md) adds section-aware policy chunks and explicitly selected scenario narratives. Its schema and source constraints are documented in the [knowledge logical model](../data-model/knowledge-model.md).
