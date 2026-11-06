# Catalog Management — Tasks

## Database

- [ ] **TASK-CAT-001** Add `KnowledgeCard`, `Collection`, `Tag`, `CardTag`, and `AiStatus` enum to `prisma/schema.prisma`.
- [ ] **TASK-CAT-002** Enable the `pgvector` Prisma extension and add the `embedding` vector column to `KnowledgeCard`.
- [ ] **TASK-CAT-003** Run `prisma migrate dev` to apply the schema and verify the migration output.

## Express Backend

- [ ] **TASK-CAT-004** Create `src/schemas/cards.ts` — Zod schemas for `createCardSchema`, `updateNotesSchema`, `updateAiMetadataSchema`.
- [ ] **TASK-CAT-005** Create `src/schemas/collections.ts` — Zod schemas for `createCollectionSchema`, `renameCollectionSchema`.
- [ ] **TASK-CAT-006** Create `src/schemas/tags.ts` — Zod schema for `createTagSchema`.
- [ ] **TASK-CAT-007** Create `src/services/cardService.ts` — implement `createCard`, `getCards`, `getCard`, `updateNotes`, `updateAiMetadata`, `deleteCard`. All queries scoped to `userId`.
- [ ] **TASK-CAT-008** Create `src/services/collectionService.ts` — implement `getCollections`, `createCollection`, `renameCollection`, `deleteCollection`.
- [ ] **TASK-CAT-009** Create `src/services/tagService.ts` — implement `getTags`, `createTag`, `deleteTag`, `applyTagToCard`, `removeTagFromCard`.
- [ ] **TASK-CAT-010** Create `src/routes/cards.ts` — mount all card endpoints; protect with `authenticate` middleware.
- [ ] **TASK-CAT-011** Create `src/routes/collections.ts` — mount all collection endpoints; protect with `authenticate` middleware.
- [ ] **TASK-CAT-012** Create `src/routes/tags.ts` — mount all tag endpoints; protect with `authenticate` middleware.
- [ ] **TASK-CAT-013** Mount cards, collections, and tags routers in `src/index.ts`.

## Frontend

- [ ] **TASK-CAT-014** Create `app/composables/useCards.ts` — expose `cards`, `fetchCards`, `fetchCard`, `createCard`, `updateNotes`, `updateAiMetadata`, `deleteCard`.
- [ ] **TASK-CAT-015** Create `app/composables/useCollections.ts` — expose `collections`, `fetchCollections`, `createCollection`, `renameCollection`, `deleteCollection`.
- [ ] **TASK-CAT-016** Create `app/composables/useTags.ts` — expose `tags`, `fetchTags`, `createTag`, `deleteTag`, `applyTag`, `removeTag`.
- [ ] **TASK-CAT-017** Create `app/components/card/CardItem.vue` — list item showing title, aiSummary, aiSubjects, tags, and createdAt.
- [ ] **TASK-CAT-018** Create `app/components/card/AiMetadataEditor.vue` — editable fields for aiSummary, aiSubjects, aiKeywords with aiStatus badge (PENDING / COMPLETE / FAILED).
- [ ] **TASK-CAT-019** Create `app/components/card/NotesEditor.vue` — auto-saving textarea for personal notes.
- [ ] **TASK-CAT-020** Create `app/components/ui/ConfirmDialog.vue` — modal dialog with confirm/cancel props and emits.
- [ ] **TASK-CAT-021** Create `app/pages/index.vue` — card list with pagination, filter sidebar (by collection and tag), and search input.
- [ ] **TASK-CAT-022** Create `app/pages/cards/new.vue` — tabbed form for "Paste Text" and "From URL" card creation.
- [ ] **TASK-CAT-023** Create `app/pages/cards/[id].vue` — three-panel card detail: source content (read-only), notes editor, AI metadata editor with delete button using `ConfirmDialog`.
