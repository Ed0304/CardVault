# Search — Tasks (MVP keyword search and future semantic retrieval)

> **Status: NO TASK IS COMPLETE.**
> **MVP vs future:** tasks tagged `[MVP]` deliver PostgreSQL keyword search. Tasks tagged `[FUTURE: Semantic Retrieval milestone]` are preserved but are not MVP prerequisites. No `[MVP]` task depends on a `[FUTURE]` task, on pgvector, on embeddings, or on FastAPI.
> Decisions: D-6 and D-12 (embedding dimension and provider) gate only the future tasks. D-10 (MVP search API and UI shape) and D-14 (relation to the `q` filter on `/api/cards`) gate the MVP tasks. D-11 is resolved: `auto` is the intended future default.

## MVP completion criteria

The MVP search work is complete when TASK-SEM-004, 006, 009, 011, 013 and 014 are done and:
- A signed-in user can search their own cards by keyword and gets only their own cards.
- Search works on a database with no pgvector extension and no `embedding` column, with FastAPI and the AI provider not running.
- A card with no AI metadata is found by its source text and title.
- Nothing in these tasks calls FastAPI or reads an embedding.

## Database (future milestone)

- [ ] **[FUTURE: Semantic Retrieval milestone]** **TASK-SEM-001** Verify the pgvector extension is enabled in PostgreSQL (created by TASK-CAT-001, `CREATE EXTENSION IF NOT EXISTS vector;`). Requires pgvector to be installed on the server (unverified).
- [ ] **[FUTURE; needs D-6, D-12]** **TASK-SEM-002** Confirm the `embedding` vector column exists on `knowledge_cards` (added by TASK-CAT-024).
- [ ] **[FUTURE; needs D-6]** **TASK-SEM-003** Create a SQL migration in `backend/expressjs/migrations/` for the HNSW index: `CREATE INDEX IF NOT EXISTS knowledge_cards_embedding_hnsw ON knowledge_cards USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);`

## Express Backend

- [ ] **[MVP; shape of `mode` is D-10]** **TASK-SEM-004** Create `src/schemas/search.schemas.ts` — Zod schema validating `q` (string, 1–500 chars), `page`, `pageSize`, and `mode` (enum: `semantic` | `keyword` | `auto`). The future default is `auto` (D-11); how `mode` behaves in the MVP is open (D-10).
- [ ] **[FUTURE; needs D-12]** **TASK-SEM-005** Create `semanticSearch(userId, query, limit)` in `src/services/searchService.ts` — parameterized SQL through the `pg` pool (`src/lib/db.ts`) with pgvector cosine distance. Needs a query embedding from the embedding provider (D-12).
- [ ] **[MVP]** **TASK-SEM-006** Create `src/services/searchService.ts` and implement `keywordSearch(userId, query, limit)` — contains search (parameterized SQL, `ILIKE` with `%`, `_` and `\` escaped in user input) across `source_title`, `source_text`, `ai_summary`, `ai_keywords`, always scoped by `user_id`. Depends on TASK-CAT-002 (the `knowledge_cards` table). Does not depend on any AI or pgvector task.
- [ ] **[FUTURE; needs D-12]** **TASK-SEM-007** Implement `getRelatedCards(userId, cardId, limit)` in `searchService.ts` — fetch the current card's embedding (scoped to the user), run the nearest-neighbour query excluding self.
- [ ] **[FUTURE; needs D-12; depends on TASK-SEM-005, TASK-SEM-006]** **TASK-SEM-008** Implement `auto` mode logic: run semantic search; if results are empty, run keyword fallback and set `fallback: true` in response.
- [ ] **[MVP; depends on TASK-AUTH authenticate middleware, TASK-SEM-006]** **TASK-SEM-009** Create `src/routes/search.routes.ts` and `src/controllers/searchController.ts` — `GET /api/search` endpoint, protected by `authenticate` middleware, calls `searchService`. MVP serves keyword search.
- [ ] **[FUTURE; needs D-12]** **TASK-SEM-010** Add `GET /api/cards/:id/related` to `src/routes/cards.routes.ts` — calls `searchService.getRelatedCards`.
- [ ] **[MVP]** **TASK-SEM-011** Mount the `search` router in `src/app.ts` under `/api`.

## FastAPI Backend (future milestone)

- [ ] **[FUTURE; needs D-7, D-12]** **TASK-SEM-012** Confirm the `POST /embeddings` contract can embed a search query as well as card source text, taking into account the `card_id` field (depends on TASK-AI-009; not implemented). FastAPI implements no similarity search.

## Frontend

- [ ] **[MVP; semantic states are future, D-10]** **TASK-SEM-013** Extend the existing `app/composables/useSearch.ts` — expose `search(query, mode)`, reactive `results`, `isLoading`, `error`. `isFallback` matters only in the future milestone.
- [ ] **[MVP; semantic states are future, D-10]** **TASK-SEM-014** Update `app/pages/catalog/index.vue` (the card list page; `app/pages/index.vue` is the landing page) — add search bar and display the search results list. The fallback notice ("No semantic results found") and any `semantic` or `auto` mode choice belong to the future milestone; what the scaffold's mode selector shows in the MVP is open (D-10).
- [ ] **[FUTURE; needs D-12]** **TASK-SEM-015** Create `app/components/catalog/RelatedCards.vue` — fetch and display up to 5 related cards on card detail page load.
- [ ] **[FUTURE; needs D-12]** **TASK-SEM-016** Update `app/pages/catalog/[id].vue` — add `RelatedCards` component at the bottom of the page.
