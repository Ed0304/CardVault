---
inclusion: always
---

# CardVault — Technology

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Nuxt 4, Vue 3.5, TypeScript, Tailwind CSS |
| Main Backend | Node.js, Express.js v5, TypeScript, Zod, `pg` (node-postgres) with parameterized SQL |
| Authentication | JWT (HS256, `jsonwebtoken`) in an HttpOnly cookie; Argon2id password hashing (`argon2`) |
| AI Backend | Python 3.13, FastAPI, pydantic-settings, OpenAI Python SDK calling Meta Model API (see Architecture Decision 10) |
| Database | PostgreSQL (the pgvector extension is added in the future Semantic Retrieval milestone, not the MVP) |

## Service Responsibilities

### Frontend — `frontend/cardvault/`
- Nuxt 4 with Vue 3.5 and TypeScript.
- All user-facing pages and components.
- Communicates exclusively with the Express backend — never directly with FastAPI.
- Uses `$fetch` or `useFetch` for API calls.
- `<script setup lang="ts">` in all Vue components.

### Main Backend — `backend/expressjs/`
- Express.js v5 with TypeScript.
- Owns all authentication: Argon2id password hashing, JWT issuance and verification, and the auth cookie.
- Owns all user and card CRUD operations.
- Owns all database interactions through the shared `pg` connection pool (`src/lib/db.ts`) using parameterized SQL. No ORM.
- Validates all inbound requests with Zod schemas.
- Calls FastAPI internally for AI processing. It never calls the AI provider directly and holds no provider credentials.
- Owns the search endpoints: validates queries, enforces user ownership, and runs the search queries against PostgreSQL through the `pg` pool. In the MVP this is PostgreSQL keyword search. In the future Semantic Retrieval milestone it also runs pgvector similarity queries.
- Applies user-level data isolation on every query.
- The only service that exposes a public API.

### AI Backend — `backend/fastapi/`
- FastAPI with Python.
- Internal service only — not exposed to the public internet.
- MVP responsibilities: catalog generation (summary, subjects, keywords) with Muse Ember, and health checks. Optional image generation and editing with Muse Image is outside the MVP.
- Accepts requests only with the shared service token; no CORS and no interactive docs.
- Future Semantic Retrieval milestone: embedding generation. Local inference in FastAPI is the preferred direction; no embedding model or runtime is selected, and no second hosted AI provider is introduced.
- Is the only service that calls Meta Model API and the only one that holds its credentials. Credentials are server-side environment variables and are never exposed to Nuxt.
- Does not implement or expose similarity search. Vector similarity is performed by PostgreSQL (pgvector) and orchestrated by Express.
- Does not read or write the main application database directly.
- Receives text from Express, returns structured AI results.
- AI provider must remain configurable — provider and model identifiers are configuration values, not code constants, and provider-specific code stays in the FastAPI adapters.
- Current state: catalog generation and health are implemented and tested with a fake provider. Not yet deployed or run against a live account.

## Architecture Decisions

1. Nuxt → Express is the only public API boundary.
2. Express → FastAPI is an internal HTTP call, not a public API.
3. FastAPI must not independently modify user or card records.
4. PostgreSQL is the single primary datastore.
5. Future Semantic Retrieval milestone: pgvector stores and queries card embeddings within PostgreSQL — no separate vector database. pgvector is not an MVP prerequisite.
6. No Redis, message brokers, Kubernetes, or additional databases without a documented requirement.
7. Express accesses PostgreSQL with raw SQL through the `pg` pool. Prisma is not used.
8. Authentication uses a short-lived access JWT (15 minutes, HttpOnly `cv_token` cookie) and a rotating opaque refresh token (HttpOnly `cv_refresh` cookie, `migrations/004_create_refresh_tokens.sql`). Only the refresh token's SHA-256 hash is stored. A login lasts up to 7 days without use and 30 days at most; reuse of a rotated token after a 30-second grace period revokes the whole login. Logout revokes the login's refresh tokens and clears both cookies. An already-issued access token stays valid until it expires; there is no access-token denylist.
9. Search is owned by Express and PostgreSQL. The MVP search is PostgreSQL keyword search and needs no embeddings, pgvector or AI service. In the future Semantic Retrieval milestone, Express runs the similarity queries and PostgreSQL (pgvector) stores vectors and computes and ranks similarity. FastAPI has no database access, no similarity-search implementation and no similarity endpoint. FastAPI may only generate embeddings (future). The intended default search mode for the future milestone is `auto` (semantic search with keyword fallback); decision D-11 is resolved in that direction.
10. The runtime AI provider is Meta Model API (Muse family), chosen by the project owner. Catalog generation uses **Muse Ember** (`muse-ember-1.0`, Standard mode, reasoning effort `low`) through the OpenAI-compatible Chat Completions API with JSON-schema structured output; `muse-spark-1.3` is the configurable quality fallback and Muse Wonder is not used. Model ids are configuration (`MUSE_CATALOG_MODEL`), and Contributor-mode ids are rejected. Muse Image (`muse-image-1.0`) is for optional image generation, not pursued. Video generation is out of scope. FastAPI calls the provider; Express never does. No second hosted AI provider is introduced. The embedding provider is deferred to the future Semantic Retrieval milestone, with local inference in FastAPI as the preferred direction (Meta's model catalog lists no embedding model). Provider facts are verified against Meta's documentation but not yet against a live account; see the ai-cataloging design. Kiro's development-time AI is not a runtime dependency.
11. AI processing has two independent statuses per card: catalog generation (summary, subjects, keywords) and embedding generation. Each can be `PENDING`, `COMPLETE`, `FAILED` or `NOT_AVAILABLE` (not implemented or not enabled). In the MVP the embedding status is `NOT_AVAILABLE`, which is not a processing failure. (The state set is proposed; see the ai-cataloging design.)
12. Community Catalog (catalog-management REQ-CAT-011 to REQ-CAT-014): cards carry a `visibility` of `PRIVATE` (default) or `PUBLIC`. The `/api/community` endpoints require a signed-in user, read only `PUBLIC` cards, and select an explicit list of public columns in `communityService.ts`; they never serialize a full card row. Saving a published card creates an independent copy owned by the saver, in one transaction, with provenance columns on the copy and no foreign key to the original.

## API Communication

- All REST APIs return a consistent response envelope:
  ```json
  { "data": ..., "error": null, "message": "Success" }
  ```
- HTTP status codes must be explicit: 200, 201, 400, 401, 403, 404, 409, 413, 422, 500.
- Error responses use `{ "data": null, "error": { "code": "...", "details": [...] }, "message": "..." }` (`details` is optional).
- Express validates all request bodies with Zod before processing.
- FastAPI validates all request/response shapes with Pydantic models.
- CORS on Express allows the Nuxt dev origin (`http://localhost:3000`) with `credentials: true`, which the auth cookie requires.

## Database Strategy

- Express uses the `pg` library through one shared `Pool` (`src/lib/db.ts`) configured from `DATABASE_URL`.
- All SQL is parameterized (`$1`, `$2`, ...). Values are never concatenated into query strings.
- Only files in `src/services/` run SQL. Routes and controllers never touch the pool.
- Schema changes are plain SQL files in `backend/expressjs/migrations/`, applied in filename order by `npm run migrate` (`scripts/migrate.ts`). There is no migration history table, so every file runs on every invocation and must be idempotent (`IF NOT EXISTS`, etc.).
- The existing `users` table (`migrations/001_create_users.sql`) is the source of truth for user data. New tables reference `users(id)` (UUID) and must not alter it.
- SQL table and column names are snake_case. Services map rows to camelCase objects before returning them.
- Future Semantic Retrieval milestone (not an MVP prerequisite): pgvector is enabled by a SQL migration (`CREATE EXTENSION IF NOT EXISTS vector;`). Embeddings are `vector` columns on the cards table. `pg` has no native vector type, so vectors are written and read as text (e.g. `$1::vector` with `'[0.1,0.2]'`).
- MVP search is keyword search over the cards table and does not depend on pgvector.
- All database queries in Express are scoped to `user_id`, taken from the verified JWT (`req.user.id`), never from the request body.
- The one exception is the Community Catalog's read queries, which are scoped to `visibility = 'PUBLIC'` instead and return only the approved public columns. Every write, including saving a copy, is still scoped to the signed-in user.

## AI Integration Strategy

- MVP: the card's owner requests cataloging (`POST /api/cards/:id/catalog`). Express sends the title, source text and the owner's existing subject headings to FastAPI (`POST /catalog`, bearer `AI_SERVICE_TOKEN`), and stores the validated `{ summary, subjects, keywords }` as a private draft (`ai_catalog_draft`). The catalog fields change only when the owner saves; saving clears the draft. Card creation never waits for or depends on AI. Notes, collections and tags are never sent.
- Future Semantic Retrieval milestone: Express also asks FastAPI for an embedding (`{ embedding }`). Embedding generation is independent of catalog generation, and card creation never waits for it either. Whether the two are one request or two at the API level is an open decision. Their outcomes are always recorded independently.
- When catalog generation is not implemented or not enabled, the catalog status is `NOT_AVAILABLE` and no AI call is made. In the MVP the embedding status is always `NOT_AVAILABLE`.
- AI provider credentials are environment variables in FastAPI only — never in source code, never in `.env.example` with real values, never exposed to Nuxt or in Express responses, never logged.
- Only Standard-mode (non-training) provider models may process user content. Meta's Contributor-mode variants (documented as permitting training on content) must not be configured.
- Image generation is optional and independent of the two AI statuses.
- Express validates the AI response shape before persisting it.
- If AI processing fails, the card is saved without AI metadata — original content is never lost.
- Future milestone: embeddings are generated by FastAPI when Express asks after card creation; they are not blocking.
- Users can edit AI-generated summary, subjects, and keywords; edits do not trigger re-generation.
- AI-generated results must never overwrite user edits.

## Security Principles

- Never trust `userId` from frontend requests for authorization — always derive it from the verified JWT subject (`req.user.id`).
- All user data queries include a `userId` scope at the database layer (Community Catalog reads: `visibility = 'PUBLIC'` and public columns only; see Database Strategy).
- Public responses never include personal notes, collections, tags, AI processing statuses, owner ids or email addresses. Source text is public only when the owner chose to share it, and community search does not match unshared source text.
- URL ingestion restricted to HTTP/HTTPS only.
- Validate resolved IP addresses against SSRF blocklist (private ranges, loopback, link-local).
- Apply request timeouts and response-size limits on external URL fetches.
- Treat all extracted webpage content as untrusted — sanitize before storage.
- Prevent prompt injection: never pass raw user-supplied text directly into privileged AI system prompts.
- The JWT lives in an HttpOnly cookie (`cv_token`) with `SameSite=Lax`; `Secure` is enabled when `NODE_ENV=production`.
- Passwords are hashed with Argon2id. JWTs are signed HS256 with `JWT_SECRET` (min 32 characters) and verified against issuer, audience and expiry.
- Registration and login must not reveal whether an email address is registered. (Known discrepancy: the current registration endpoint returns 409 for a duplicate email. See the authentication design and TASK-AUTH-022.)
- Never log sensitive user content, passwords, or tokens.

## Testing Expectations

- Express: Jest with Supertest for route and integration tests.
- FastAPI: Pytest for unit and route tests.
- Frontend: Vitest for composable and utility tests.
- Express: Jest + Supertest are installed (`npm test`). FastAPI: Pytest is in `requirements-dev.txt`. Frontend (Vitest) is not installed. Do not reference test scripts that do not exist in package.json.

## Available Scripts (Verified)

### Frontend (`frontend/cardvault/package.json`)
```
npm run dev       # nuxt dev
npm run build     # nuxt build
npm run generate  # nuxt generate
npm run preview   # nuxt preview
```

### Express (`backend/expressjs/package.json`)
```
npm run dev        # tsx watch src/server.ts
npm run build      # tsc -p tsconfig.build.json
npm start          # node dist/server.js
npm run typecheck  # tsc --noEmit
npm run migrate    # tsx scripts/migrate.ts (applies migrations/*.sql in order)
npm test           # Jest (ESM mode)
```
Entry point: `src/server.ts` starts the server and imports the app from `src/app.ts`.

Environment variables (see `.env.example`): `PORT` (default 5000), `DATABASE_URL`, `JWT_SECRET`, `JWT_ISSUER` (default `cardvault-api`), `JWT_AUDIENCE` (default `cardvault-web`), `NODE_ENV`.

### FastAPI (`backend/fastapi/`)
```
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt   # Windows; .venv/bin/python elsewhere
.venv\Scripts\python -m pytest -q                              # tests (fake provider, no network)
.venv\Scripts\python -m uvicorn app:app --port 8000            # run locally (needs .env)
```
Environment variables (see `backend/fastapi/.env.example`): `MODEL_API_KEY`, `MODEL_API_BASE_URL`, `MUSE_CATALOG_MODEL`, `MUSE_CATALOG_REASONING_EFFORT`, `MUSE_CATALOG_MAX_OUTPUT_TOKENS`, `CATALOG_MAX_INPUT_CHARS`, `MUSE_TIMEOUT_SECONDS`, `MUSE_MAX_RETRIES`, `AI_SERVICE_TOKEN`.

Express AI variables (optional; both or neither): `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, plus `AI_SERVICE_TIMEOUT_MS` and `AI_CATALOG_HOURLY_LIMIT`.

Express URL-ingestion variables (optional; defaults 10000, 5242880, 30): `URL_FETCH_TIMEOUT_MS`, `URL_FETCH_MAX_BYTES`, `URL_INGEST_HOURLY_LIMIT`. URL ingestion runs in Express (`urlIngestionService.ts`) with `@mozilla/readability`, `jsdom` and `ipaddr.js`.
