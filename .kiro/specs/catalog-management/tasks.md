# Catalog Management — Tasks

## Database

> **MVP vs future:** every task below is MVP unless tagged `[FUTURE]`. No MVP task depends on a `[FUTURE]` task. The MVP database work is TASK-CAT-002 and TASK-CAT-003, and it needs neither pgvector nor an embedding column.

- [ ] **[FUTURE: Semantic Retrieval milestone]** **TASK-CAT-001** Create `backend/expressjs/migrations/002_enable_pgvector.sql` — `CREATE EXTENSION IF NOT EXISTS vector;`. Requires pgvector to be installed on the PostgreSQL server (unverified). Not an MVP prerequisite; unused until an embedding column exists (TASK-CAT-024).
- [x] **[D-8 resolved]** **TASK-CAT-002** Create `backend/expressjs/migrations/003_create_catalog_tables.sql` — `collections`, `tags`, `knowledge_cards` (with `ai_catalog_status` and `ai_embedding_status`, and without the `embedding` column, which is future-milestone work), `card_tags`, and indexes, as in `design.md`. Idempotent; do not alter `users`. Does not depend on TASK-CAT-001.
- [x] **TASK-CAT-003** Run `npm run migrate` and verify the tables exist (e.g. `\d knowledge_cards` in psql). Run it twice to confirm idempotence. Completion criterion: the catalog tables exist and the second run changes nothing, with no pgvector installed. (Verified on the local `cardvault_test` database via `npm run db:test:setup`, run twice. Still to run on the local dev database and on Railway.)

## Express Backend

- [x] **TASK-CAT-004** Create `src/schemas/cards.schemas.ts` — Zod schemas for `createCardSchema`, `updateNotesSchema`, `updateAiMetadataSchema`.
- [x] **TASK-CAT-005** Create `src/schemas/collections.schemas.ts` — Zod schemas for `createCollectionSchema`, `renameCollectionSchema`.
- [x] **TASK-CAT-006** Create `src/schemas/tags.schemas.ts` — Zod schema for `createTagSchema`.
- [x] **TASK-CAT-007** Create `src/services/cardService.ts` — implement `createCard`, `getCards`, `getCard`, `updateNotes`, `updateAiMetadata`, `deleteCard`. Use the `pg` pool (`src/lib/db.ts`) with parameterized SQL; every query includes `user_id = $n`. Sets the initial AI statuses on insert (D-9) and returns without waiting for any AI work; the catalog-generation call itself is TASK-AI-015. Does not depend on embeddings or any future task.
- [x] **TASK-CAT-008** Create `src/services/collectionService.ts` — implement `getCollections`, `createCollection`, `renameCollection`, `deleteCollection`. Use the `pg` pool (`src/lib/db.ts`) with parameterized SQL; every query includes `user_id = $n`.
- [x] **TASK-CAT-009** Create `src/services/tagService.ts` — implement `getTags`, `createTag`, `deleteTag`, `applyTagToCard`, `removeTagFromCard`. Use the `pg` pool (`src/lib/db.ts`) with parameterized SQL; every query includes `user_id = $n`.
- [x] **TASK-CAT-010** Create `src/routes/cards.routes.ts` and `src/controllers/cardController.ts` — mount all card endpoints; protect with `authenticate`.
- [x] **TASK-CAT-011** Create `src/routes/collections.routes.ts` and `src/controllers/collectionController.ts` — mount all collection endpoints; protect with `authenticate`.
- [x] **TASK-CAT-012** Create `src/routes/tags.routes.ts` and `src/controllers/tagController.ts` — mount all tag endpoints; protect with `authenticate`.
- [x] **TASK-CAT-013** Mount cards, collections, and tags routers in `src/app.ts` under `/api`. (TASK-CAT-005 to 013 verified by `tests/organization.integration.test.ts` on the isolated test database.)
- [ ] **[FUTURE: Semantic Retrieval milestone; needs D-6, D-12]** **TASK-CAT-024** Create `backend/expressjs/migrations/006_add_embedding_column.sql` (004 and 005 are taken) — `ALTER TABLE knowledge_cards ADD COLUMN IF NOT EXISTS embedding vector(<N>);` with N set by decision D-6. Idempotent.

## Frontend

- [x] **TASK-CAT-014** (Done: `updateAiMetadata` and `updateNotes`; verified by typecheck and production build, not yet in a browser.) Extend the existing `app/composables/useCatalog.ts` (it already exposes `cards`, `card`, `fetchCards`, `fetchCard`, `createCard`, `createCardFromUrl`, `deleteCard`) — add `updateNotes` and `updateAiMetadata`. The earlier spec name `useCards.ts` is not used.
- [ ] **TASK-CAT-015** Create `app/composables/useCollections.ts` — expose `collections`, `fetchCollections`, `createCollection`, `renameCollection`, `deleteCollection`.
- [ ] **TASK-CAT-016** Create `app/composables/useTags.ts` — expose `tags`, `fetchTags`, `createTag`, `deleteTag`, `applyTag`, `removeTag`.
- [ ] **TASK-CAT-017** Verify and extend the existing `app/components/catalog/KnowledgeCard.vue` (the card list item; it already renders title, source host, summary, subjects, tags, collection and createdAt) so it shows the two AI statuses (TASK-AI-019). The earlier spec name `CardItem.vue` is not used.
- [x] **TASK-CAT-018** (Done in the Muse milestone, with `AiCatalogPanel.vue` showing the status; verified by the production build only.) Create `app/components/ai/AiMetadataEditor.vue` (beside the existing read-only `AiMetadata.vue`) — editable fields for aiSummary, aiSubjects, aiKeywords with a status badge for each of the two AI statuses (PENDING / COMPLETE / FAILED / NOT_AVAILABLE). Shows metadata whenever it exists.
- [x] **TASK-CAT-019** Create `app/components/catalog/NotesEditor.vue` — auto-saving textarea for personal notes. (Done: saves 1.2 s after typing stops, on blur and when leaving the card; 20,000-character limit matching the API; warns before closing the tab with unsaved edits. Verified by typecheck and production build, not yet in a browser.)
- [ ] **TASK-CAT-020** Create `app/components/common/ConfirmDialog.vue` (generic UI primitives live in `components/common/`; there is no `ui/` folder) — modal dialog with confirm/cancel props and emits. The card detail page currently uses `window.confirm`.
- [ ] **TASK-CAT-021** Extend the existing `app/pages/catalog/index.vue` (the card list page; `app/pages/index.vue` is the landing page) — card list with pagination, filter sidebar (by collection and tag), and search input. The list and the keyword search (`GET /api/cards?q=`, done in the Muse milestone) exist; pagination and the filter sidebar do not. (Partial, 2026-11-25: the page now honours `?collectionId=` and `?tagId=` links with a "Show all cards" reset; no sidebar or pagination yet.)
- [x] **TASK-CAT-022** Extend the existing `app/pages/catalog/create.vue` — tabbed form for "Paste Text" and "From URL" card creation. Both tabs now work (From URL through `POST /api/cards/from-url`, URL Ingestion spec); verified by integration tests and the end-to-end run, not yet in a browser.
- [ ] **TASK-CAT-023** Extend the existing `app/pages/catalog/[id].vue` — three-panel card detail: source content (read-only), notes editor, AI metadata editor with delete button using `ConfirmDialog`. (Partial, 2026-11-25. The source text collapses past 1,500 characters (`SourceText.vue`), and the page gained a collection and tags panel (`CardOrganisation.vue`). The delete button still uses `window.confirm`, pending TASK-CAT-020.)

## UX Review (2026-11-25)

- [x] **TASK-CAT-040** Make the capture, catalog, connect, share workflow clear, and correct copy that claimed unsupported behaviour:
  - Landing page: no "search by meaning", and no automatic AI.
  - Saved catalog entries no longer carry the AI sparkle and "AI-assisted" eyebrow, since CardVault doesn't record whether Muse wrote a saved field.
  - Status labels: `COMPLETE` means "Muse has made suggestions", and `NOT_AVAILABLE` means "Muse not asked".
  - The Muse hint now also says that the owner's existing subject headings are sent.
  - The Collections page's "add from a card's page" and its filter links are now true.
  - Added `HowItWorks.vue` (Home), a short "what CardVault is" on welcome, an empty-vault example labelled "Example only" (static, no data), clearer New Card steps, "Why it's here" on recommendations, and save-state and topic-matching notes in Settings.
  - Verified on 2026-11-25 by `vue-tsc`, the production build, and a headless-Chrome check at 375 and 1280 px against `cardvault_test` with throwaway users (31 checks: no horizontal overflow on 9 pages, plus behaviour checks).

## Community Catalog (REQ-CAT-011 to REQ-CAT-014)

Verification for the ticked tasks: `tests/community.integration.test.ts` (28 tests) on the isolated `cardvault_test` database, the full backend suite (114 tests), `npm run typecheck`, the frontend production build, and an HTTP check through the production Nuxt `/api` proxy. No browser-level UI test was run.

- [x] **TASK-CAT-025** Create `backend/expressjs/migrations/005_add_card_publishing.sql` — `visibility`, `published_at`, `share_source_text`, `saved_from_card_id`, `saved_from_author`, their CHECK constraints, the public-listing index and the one-copy-per-user unique index, as in `design.md`. Idempotent; existing cards become `PRIVATE`. (Applied twice to `cardvault_test`.)
- [ ] **TASK-CAT-026** Run `npm run migrate` on the local development database and on Railway (needs approval for Railway). Required before deploying: the card queries now read the new columns.
- [x] **TASK-CAT-027** Add `setVisibilitySchema` and `listPublicCardsQuerySchema` to `src/schemas/cards.schemas.ts`.
- [x] **TASK-CAT-028** Extend `src/services/cardService.ts` — `visibility`, `publishedAt`, `savedFrom` and `shareSourceText` in the owner's card responses; `setVisibility`. Add `PATCH /api/cards/:id/visibility`.
- [x] **TASK-CAT-029** Create `src/services/communityService.ts`, `src/controllers/communityController.ts` and `src/routes/community.routes.ts` — `listPublicCards`, `getPublicCard`, `saveToVault` (transaction); mount at `/api/community` behind `authenticate`.
- [x] **TASK-CAT-030** Integration tests: publishing, visibility, private cards excluded, public detail, exact public key sets, search over shared text only, cross-user violations, copy ownership and provenance, notes and tags not copied, independence after edits, unpublish and delete, duplicate and simultaneous saves, unauthenticated access.
- [x] **TASK-CAT-031** Frontend data layer — `types/card.ts` (visibility, `savedFrom`), `types/community.ts`, `services/community.service.ts`, `composables/useCommunity.ts`, `setVisibility` in `catalog.service.ts` and `useCatalog.ts`.
- [x] **TASK-CAT-032** `components/catalog/CardPublishing.vue` on `pages/catalog/[id].vue`, with the confirmation step and source-text choice; visibility badge and saved-copy attribution on the card page; Public and Saved badges in `KnowledgeCard.vue`.
- [x] **TASK-CAT-033** `pages/community/index.vue` and `pages/community/[id].vue` with `components/community/CommunityCard.vue`; "Community" and "My Vault" in the primary navigation.
- [ ] **TASK-CAT-034** Manual browser check of the publishing confirmation, Save to My Vault and attribution flows (not yet done).

## Catalog Entry Identity and Structure (REQ-CAT-015)

- [x] **TASK-CAT-035** Catalog title separate from the source title (`catalog_title`, migration 007), display fallback, owner editing; facts and related concepts in the catalog layer; related-concept links on read (owner's cards / published cards); search over the new fields; public projection and saved copies updated. Verified by `tests/catalogEntry.integration.test.ts` and the updated community tests on `cardvault_test`. See AI Cataloging TASK-AI-035 to TASK-AI-042.
