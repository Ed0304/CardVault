# Semantic Search — Tasks

## Database

- [ ] **TASK-SEM-001** Verify pgvector extension is enabled in PostgreSQL: `CREATE EXTENSION IF NOT EXISTS vector;` — add to initial migration or setup script.
- [ ] **TASK-SEM-002** Confirm `embedding` vector column exists on `knowledge_cards` after catalog management migrations.
- [ ] **TASK-SEM-003** Create a Prisma custom migration to add the HNSW index: `CREATE INDEX knowledge_cards_embedding_hnsw ON knowledge_cards USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);`

## Express Backend

- [ ] **TASK-SEM-004** Create `src/schemas/search.ts` — Zod schema validating `q` (string, 1–500 chars), `mode` (enum: `semantic` | `keyword` | `auto`), `page`, `pageSize`.
- [ ] **TASK-SEM-005** Create `src/services/searchService.ts` — implement `semanticSearch(userId, query, limit)` using `prisma.$queryRaw` with pgvector cosine distance.
- [ ] **TASK-SEM-006** Implement `keywordSearch(userId, query, limit)` in `searchService.ts` — full-text contains search across `sourceTitle`, `sourceText`, `aiSummary`, `aiKeywords`.
- [ ] **TASK-SEM-007** Implement `getRelatedCards(userId, cardId, limit)` in `searchService.ts` — fetch current card embedding, run nearest-neighbour query excluding self.
- [ ] **TASK-SEM-008** Implement `auto` mode logic: run semantic search; if results are empty, run keyword fallback and set `fallback: true` in response.
- [ ] **TASK-SEM-009** Create `src/routes/search.ts` — `GET /api/search` endpoint, protected by `authenticate` middleware, calls `searchService`.
- [ ] **TASK-SEM-010** Add `GET /api/cards/:id/related` to `src/routes/cards.ts` — calls `searchService.getRelatedCards`.
- [ ] **TASK-SEM-011** Mount `search` router in `src/index.ts`.

## FastAPI Backend

- [ ] **TASK-SEM-012** Confirm `POST /embeddings` endpoint handles query strings as well as card source text (same endpoint, no changes needed if already implemented in TASK-AI-009).

## Frontend

- [ ] **TASK-SEM-013** Create `app/composables/useSearch.ts` — expose `search(query, mode)`, reactive `results`, `isLoading`, `isFallback`, `error`.
- [ ] **TASK-SEM-014** Update `app/pages/index.vue` — add search bar, display search results list, show fallback notice when `isFallback === true`.
- [ ] **TASK-SEM-015** Create `app/components/card/RelatedCards.vue` — fetch and display up to 5 related cards on card detail page load.
- [ ] **TASK-SEM-016** Update `app/pages/cards/[id].vue` — add `RelatedCards` component at the bottom of the page.
