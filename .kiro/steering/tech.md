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
| AI Backend | Python, FastAPI (planned) calling Meta Model API (intended provider; see Architecture Decision 10) |
| Database | PostgreSQL with pgvector extension |

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
- Owns the semantic-search endpoints: validates queries, enforces user ownership, and runs pgvector similarity queries against PostgreSQL through the `pg` pool.
- Applies user-level data isolation on every query.
- The only service that exposes a public API.

### AI Backend — `backend/fastapi/`
- FastAPI with Python.
- Internal service only — not exposed to the public internet.
- Planned responsibilities: catalog generation (summary, subjects, keywords) with Muse Spark, embedding generation (source unresolved), optional image generation and editing with Muse Image, and AI health checks.
- Is the only service that calls Meta Model API and the only one that holds its credentials. Credentials are server-side environment variables and are never exposed to Nuxt.
- Does not implement or expose similarity search. Vector similarity is performed by PostgreSQL (pgvector) and orchestrated by Express.
- Does not read or write the main application database directly.
- Receives text from Express, returns structured AI results.
- AI provider must remain configurable — provider and model identifiers are configuration values, not code constants, and provider-specific code stays in the FastAPI adapters.
- Current state: `app.py` is empty. Nothing above is implemented.

## Architecture Decisions

1. Nuxt → Express is the only public API boundary.
2. Express → FastAPI is an internal HTTP call, not a public API.
3. FastAPI must not independently modify user or card records.
4. PostgreSQL is the single primary datastore.
5. pgvector stores and queries card embeddings within PostgreSQL — no separate vector database.
6. No Redis, message brokers, Kubernetes, or additional databases without a documented requirement.
7. Express accesses PostgreSQL with raw SQL through the `pg` pool. Prisma is not used.
8. Authentication is stateless: a JWT in an HttpOnly cookie. There is no server-side session store.
   Logout clears the cookie only. Token revocation/denylists and refresh tokens are out of scope for the MVP;
   a previously copied token stays valid until it expires (access tokens last 15 minutes).
9. Semantic search is owned by Express and PostgreSQL. Express exposes the endpoints, validates queries, enforces user ownership and runs similarity queries. PostgreSQL (pgvector) stores vectors and computes and ranks similarity. FastAPI has no database access, no similarity-search implementation and no similarity endpoint.
10. The intended runtime AI provider is Meta Model API (Muse family), chosen by the project owner. Muse Spark (`muse-spark-1.3`, Standard mode) handles cataloging, summaries, keyword extraction, reasoning and image understanding. Muse Image (`muse-image-1.0`) handles optional image generation and editing. Video generation is out of scope. FastAPI calls the provider; Express never does. The embedding source is unresolved: Meta's published model catalog lists no embedding model, so semantic search remains blocked on it. Provider facts are documented but unverified for this project; see the ai-cataloging design. Kiro's development-time AI is not a runtime dependency.
11. AI processing has two independent statuses per card: catalog generation (summary, subjects, keywords) and embedding generation. Each can be `PENDING`, `COMPLETE`, `FAILED` or `NOT_AVAILABLE`. (The state set is proposed; see the ai-cataloging design.)

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
- pgvector is enabled by a SQL migration (`CREATE EXTENSION IF NOT EXISTS vector;`). Embeddings are `vector` columns on the cards table. `pg` has no native vector type, so vectors are written and read as text (e.g. `$1::vector` with `'[0.1,0.2]'`).
- All database queries in Express are scoped to `user_id`, taken from the verified JWT (`req.user.id`), never from the request body.

## AI Integration Strategy

- Express sends card text to FastAPI for catalog generation (`{ summary, subjects, keywords }`) and embedding generation (`{ embedding }`). Whether these are one request or two at the API level is an open decision. Their outcomes are always recorded independently.
- While the runtime AI integration is not operational, cards are saved with both AI statuses `NOT_AVAILABLE` and no AI call is made.
- AI provider credentials are environment variables in FastAPI only — never in source code, never in `.env.example` with real values, never exposed to Nuxt or in Express responses, never logged.
- Only Standard-mode (non-training) provider models may process user content. Meta's Contributor-mode variants (documented as permitting training on content) must not be configured.
- Image generation is optional and independent of the two AI statuses.
- Express validates the AI response shape before persisting it.
- If AI processing fails, the card is saved without AI metadata — original content is never lost.
- Embeddings are generated by Express calling FastAPI after card creation; they are not blocking.
- Users can edit AI-generated summary, subjects, and keywords; edits do not trigger re-generation.
- AI-generated results must never overwrite user edits.

## Security Principles

- Never trust `userId` from frontend requests for authorization — always derive it from the verified JWT subject (`req.user.id`).
- All user data queries include a `userId` scope at the database layer.
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
- Express: Jest + Supertest are installed (`npm test`). FastAPI (Pytest) and frontend (Vitest) are not verified as installed. Do not reference test scripts that do not exist in package.json.

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
No requirements.txt or pyproject.toml exists yet. `app.py` is empty.
