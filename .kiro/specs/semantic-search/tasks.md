# Semantic Search — Tasks

> **Status: NO TASK IS COMPLETE.** Semantic and related-card tasks are BLOCKED by the unresolved embedding source (D-12; the intended provider, Meta Model API, lists no embedding model) and the open embedding dimension (D-6). Keyword-search tasks do not depend on the AI provider. The default search mode is disputed (D-11).

## Database

- [ ] **TASK-SEM-001** Verify the pgvector extension is enabled in PostgreSQL (created by TASK-CAT-001, `CREATE EXTENSION IF NOT EXISTS vector;`). Requires pgvector to be installed on the server (unverified).
- [ ] **[BLOCKED: D-6]** **TASK-SEM-002** Confirm the `embedding` vector column exists on `knowledge_cards` (added by TASK-CAT-024, deferred).
- [ ] **[BLOCKED: D-6]** **TASK-SEM-003** Create a SQL migration in `backend/expressjs/migrations/` for the HNSW index: `CREATE INDEX IF NOT EXISTS knowledge_cards_embedding_hnsw ON knowledge_cards USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);`

## Express Backend

- [ ] **[INDEPENDENT]** **TASK-SEM-004** Create `src/schemas/search.schemas.ts` — Zod schema validating `q` (string, 1–500 chars), `mode` (enum: `semantic` | `keyword` | `auto`; the default is open, D-11), `page`, `pageSize`.
- [ ] **[BLOCKED: D-12]** **TASK-SEM-005** Create `src/services/searchService.ts` — implement `semanticSearch(userId, query, limit)` using parameterized SQL through the `pg` pool (`src/lib/db.ts`) with pgvector cosine distance. Needs a query embedding from an established embedding source (D-12).
- [ ] **[INDEPENDENT]** **TASK-SEM-006** Implement `keywordSearch(userId, query, limit)` in `searchService.ts` — contains search (parameterized SQL, `ILIKE` with `%`, `_` and `\` escaped in user input) across `source_title`, `source_text`, `ai_summary`, `ai_keywords`.
- [ ] **[BLOCKED: D-12]** **TASK-SEM-007** Implement `getRelatedCards(userId, cardId, limit)` in `searchService.ts` — fetch the current card's embedding (scoped to the user), run the nearest-neighbour query excluding self.
- [ ] **[BLOCKED in part: semantic step D-12; D-10, D-11]** **TASK-SEM-008** Implement `auto` mode logic: run semantic search; if results are empty, run keyword fallback and set `fallback: true` in response.
- [ ] **[INDEPENDENT for keyword mode]** **TASK-SEM-009** Create `src/routes/search.routes.ts` and `src/controllers/searchController.ts` — `GET /api/search` endpoint, protected by `authenticate` middleware, calls `searchService`.
- [ ] **[BLOCKED: D-12]** **TASK-SEM-010** Add `GET /api/cards/:id/related` to `src/routes/cards.routes.ts` — calls `searchService.getRelatedCards`.
- [ ] **TASK-SEM-011** Mount the `search` router in `src/app.ts` under `/api`.

## FastAPI Backend

- [ ] **[BLOCKED: D-12, D-7]** **TASK-SEM-012** Confirm the `POST /embeddings` contract can embed a search query as well as card source text, taking into account the `card_id` field (depends on TASK-AI-009; not implemented). FastAPI implements no similarity search.

## Frontend

- [ ] **[INDEPENDENT for keyword mode; semantic states D-10]** **TASK-SEM-013** Extend the existing `app/composables/useSearch.ts` — expose `search(query, mode)`, reactive `results`, `isLoading`, `isFallback`, `error`.
- [ ] **[INDEPENDENT for keyword mode; semantic states D-10]** **TASK-SEM-014** Update `app/pages/catalog/index.vue` (the card list page; `app/pages/index.vue` is the landing page) — add search bar, display search results list, show fallback notice when `isFallback === true`.
- [ ] **[BLOCKED: D-12]** **TASK-SEM-015** Create `app/components/catalog/RelatedCards.vue` — fetch and display up to 5 related cards on card detail page load.
- [ ] **[BLOCKED: D-12]** **TASK-SEM-016** Update `app/pages/catalog/[id].vue` — add `RelatedCards` component at the bottom of the page.
