# Catalog Management — Tasks

## Database

- [ ] **TASK-CAT-001** Create `backend/expressjs/migrations/002_enable_pgvector.sql` — `CREATE EXTENSION IF NOT EXISTS vector;`. Requires pgvector to be installed on the PostgreSQL server (unverified). Unused until an embedding column exists (TASK-CAT-024).
- [ ] **[needs D-8]** **TASK-CAT-002** Create `backend/expressjs/migrations/003_create_catalog_tables.sql` — `collections`, `tags`, `knowledge_cards` (with `ai_catalog_status` and `ai_embedding_status`, and without the `embedding` column, which is deferred), `card_tags`, and indexes, as in `design.md`. Idempotent; do not alter `users`.
- [ ] **TASK-CAT-003** Run `npm run migrate` and verify the tables exist (e.g. `\d knowledge_cards` in psql). Run it twice to confirm idempotence.

## Express Backend

- [ ] **TASK-CAT-004** Create `src/schemas/cards.schemas.ts` — Zod schemas for `createCardSchema`, `updateNotesSchema`, `updateAiMetadataSchema`.
- [ ] **TASK-CAT-005** Create `src/schemas/collections.schemas.ts` — Zod schemas for `createCollectionSchema`, `renameCollectionSchema`.
- [ ] **TASK-CAT-006** Create `src/schemas/tags.schemas.ts` — Zod schema for `createTagSchema`.
- [ ] **TASK-CAT-007** Create `src/services/cardService.ts` — implement `createCard`, `getCards`, `getCard`, `updateNotes`, `updateAiMetadata`, `deleteCard`. Use the `pg` pool (`src/lib/db.ts`) with parameterized SQL; every query includes `user_id = $n`. Sets the initial AI statuses on insert (D-9); the AI calls themselves are TASK-AI-015 [BLOCKED].
- [ ] **TASK-CAT-008** Create `src/services/collectionService.ts` — implement `getCollections`, `createCollection`, `renameCollection`, `deleteCollection`. Use the `pg` pool (`src/lib/db.ts`) with parameterized SQL; every query includes `user_id = $n`.
- [ ] **TASK-CAT-009** Create `src/services/tagService.ts` — implement `getTags`, `createTag`, `deleteTag`, `applyTagToCard`, `removeTagFromCard`. Use the `pg` pool (`src/lib/db.ts`) with parameterized SQL; every query includes `user_id = $n`.
- [ ] **TASK-CAT-010** Create `src/routes/cards.routes.ts` and `src/controllers/cardController.ts` — mount all card endpoints; protect with `authenticate`.
- [ ] **TASK-CAT-011** Create `src/routes/collections.routes.ts` and `src/controllers/collectionController.ts` — mount all collection endpoints; protect with `authenticate`.
- [ ] **TASK-CAT-012** Create `src/routes/tags.routes.ts` and `src/controllers/tagController.ts` — mount all tag endpoints; protect with `authenticate`.
- [ ] **TASK-CAT-013** Mount cards, collections, and tags routers in `src/app.ts` under `/api`.
- [ ] **[BLOCKED: D-12, D-6]** **TASK-CAT-024** Create `backend/expressjs/migrations/004_add_embedding_column.sql` — `ALTER TABLE knowledge_cards ADD COLUMN IF NOT EXISTS embedding vector(<N>);` with N set by decision D-6. Idempotent.

## Frontend

- [ ] **TASK-CAT-014** Extend the existing `app/composables/useCatalog.ts` (it already exposes `cards`, `card`, `fetchCards`, `fetchCard`, `createCard`, `createCardFromUrl`, `deleteCard`) — add `updateNotes` and `updateAiMetadata`. The earlier spec name `useCards.ts` is not used.
- [ ] **TASK-CAT-015** Create `app/composables/useCollections.ts` — expose `collections`, `fetchCollections`, `createCollection`, `renameCollection`, `deleteCollection`.
- [ ] **TASK-CAT-016** Create `app/composables/useTags.ts` — expose `tags`, `fetchTags`, `createTag`, `deleteTag`, `applyTag`, `removeTag`.
- [ ] **TASK-CAT-017** Verify and extend the existing `app/components/catalog/KnowledgeCard.vue` (the card list item; it already renders title, source host, summary, subjects, tags, collection and createdAt) so it shows the two AI statuses (TASK-AI-019). The earlier spec name `CardItem.vue` is not used.
- [ ] **TASK-CAT-018** Create `app/components/ai/AiMetadataEditor.vue` (beside the existing read-only `AiMetadata.vue`) — editable fields for aiSummary, aiSubjects, aiKeywords with a status badge for each of the two AI statuses (PENDING / COMPLETE / FAILED / NOT_AVAILABLE). Shows metadata whenever it exists.
- [ ] **TASK-CAT-019** Create `app/components/catalog/NotesEditor.vue` — auto-saving textarea for personal notes.
- [ ] **TASK-CAT-020** Create `app/components/common/ConfirmDialog.vue` (generic UI primitives live in `components/common/`; there is no `ui/` folder) — modal dialog with confirm/cancel props and emits. The card detail page currently uses `window.confirm`.
- [ ] **TASK-CAT-021** Extend the existing `app/pages/catalog/index.vue` (the card list page; `app/pages/index.vue` is the landing page) — card list with pagination, filter sidebar (by collection and tag), and search input. The list and search input exist; pagination and the filter sidebar do not.
- [ ] **TASK-CAT-022** Extend the existing `app/pages/catalog/create.vue` — tabbed form for "Paste Text" and "From URL" card creation. The tabs exist in the scaffold; they are not connected to a working backend.
- [ ] **TASK-CAT-023** Extend the existing `app/pages/catalog/[id].vue` — three-panel card detail: source content (read-only), notes editor, AI metadata editor with delete button using `ConfirmDialog`.
