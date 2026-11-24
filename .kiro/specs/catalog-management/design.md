# Catalog Management — Design

## Database Schema

Raw PostgreSQL, applied by `npm run migrate` from SQL files in `backend/expressjs/migrations/`.
Every file must be idempotent because all files run on every migrate. The existing `users` table
(`001_create_users.sql`, UUID primary key) is referenced and never altered.

The MVP schema needs neither the pgvector extension nor an embedding column. Those belong to the future Semantic Retrieval milestone (see "Future milestone schema" below).

```sql
-- 003_create_catalog_tables.sql
CREATE TABLE IF NOT EXISTS collections (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES users(id),
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT collections_user_name_key UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS tags (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES users(id),
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT tags_user_name_key UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS knowledge_cards (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id),
    -- Original source layer (immutable after creation)
    source_text   TEXT  NOT NULL,
    source_url    TEXT,
    source_title  TEXT,
    source_meta   JSONB,
    -- Personal notes layer
    notes         TEXT,
    -- AI catalog layer
    ai_summary    TEXT,
    ai_subjects   TEXT[] NOT NULL DEFAULT '{}',
    ai_keywords   TEXT[] NOT NULL DEFAULT '{}',
    -- The embedding column is intentionally omitted: it belongs to the future Semantic Retrieval
    -- milestone (TASK-CAT-024), and its dimension is an open decision (D-6).
    -- Two independent AI processing statuses (proposed, pending decision D-8). No default:
    -- the service sets the initial value explicitly (D-9). In the MVP the embedding status is
    -- always NOT_AVAILABLE (not implemented), which is not a processing failure.
    ai_catalog_status   TEXT NOT NULL
                        CHECK (ai_catalog_status IN ('PENDING', 'COMPLETE', 'FAILED', 'NOT_AVAILABLE')),
    ai_embedding_status TEXT NOT NULL
                        CHECK (ai_embedding_status IN ('PENDING', 'COMPLETE', 'FAILED', 'NOT_AVAILABLE')),
    -- Organisation
    collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS knowledge_cards_user_id_idx       ON knowledge_cards (user_id);
CREATE INDEX IF NOT EXISTS knowledge_cards_collection_id_idx ON knowledge_cards (collection_id);

CREATE TABLE IF NOT EXISTS card_tags (
    card_id UUID NOT NULL REFERENCES knowledge_cards(id) ON DELETE CASCADE,
    tag_id  UUID NOT NULL REFERENCES tags(id)            ON DELETE CASCADE,
    PRIMARY KEY (card_id, tag_id)
);
```

Notes:
- IDs are UUIDs to match `users.id`. The earlier `cuid()` ids are dropped.
- `updated_at` has no automatic trigger: services set `updated_at = now()` in every UPDATE.
- Source immutability is enforced in the service layer: no UPDATE statement touches `source_*` columns.
- Ownership of `collection_id` and tag assignments is verified in the service (`user_id` match), not by a composite foreign key.
- JSON responses keep the camelCase field names below (`sourceTitle`, `aiSummary`, ...). Services map from snake_case columns.
- `ai_catalog_status` tracks summary, subjects and keywords. `ai_embedding_status` tracks the embedding. They are independent. User edits change neither.
- Proposed invariant (future milestone): `ai_embedding_status = 'COMPLETE'` if and only if an embedding is stored.

### Future milestone schema (Semantic Retrieval; not an MVP prerequisite)

```sql
-- 002_enable_pgvector.sql  (TASK-CAT-001)
CREATE EXTENSION IF NOT EXISTS vector;

-- 004_add_embedding_column.sql  (TASK-CAT-024)
ALTER TABLE knowledge_cards ADD COLUMN IF NOT EXISTS embedding vector(<N>);
```

- `<N>` is the embedding dimension, an open decision (D-6) that depends on the embedding provider (D-12, deferred).
- The extension migration needs pgvector installed on the server (unverified). Migration numbers are provisional; all migration files re-run in filename order and are idempotent, so adding a file numbered `002` later is harmless.
- The future vector index is described in the semantic-search design.
- The MVP `/api/cards?q=` filter and `GET /api/search` keyword search work without these migrations.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/cards | Paginated card list (filter: collectionId, tagId, q). Whether the `q` keyword filter or `GET /api/search` is the MVP keyword search is open (D-14) |
| POST | /api/cards | Create card from text |
| GET | /api/cards/:id | Full card detail |
| PATCH | /api/cards/:id/notes | Update personal notes |
| PATCH | /api/cards/:id/ai-metadata | Update AI summary/subjects/keywords |
| DELETE | /api/cards/:id | Delete a card |
| GET | /api/collections | List user's collections |
| POST | /api/collections | Create a collection |
| PATCH | /api/collections/:id | Rename a collection |
| DELETE | /api/collections/:id | Delete a collection (cards become uncollected) |
| GET | /api/tags | List user's tags |
| POST | /api/tags | Create a tag |
| DELETE | /api/tags/:id | Delete a tag |
| POST | /api/cards/:id/tags/:tagId | Apply a tag to a card |
| DELETE | /api/cards/:id/tags/:tagId | Remove a tag from a card |

## Card List Response

```json
{
  "data": {
    "items": [
      {
        "id": "...",
        "sourceTitle": "...",
        "sourceUrl": "...",
        "aiSummary": "...",
        "aiSubjects": ["..."],
        "aiCatalogStatus": "COMPLETE",
        "aiEmbeddingStatus": "COMPLETE",
        "collection": { "id": "...", "name": "..." },
        "tags": [{ "id": "...", "name": "..." }],
        "createdAt": "..."
      }
    ],
    "total": 42,
    "page": 1,
    "pageSize": 20
  },
  "error": null,
  "message": "OK"
}
```

## Card Detail Response

```json
{
  "data": {
    "id": "...",
    "sourceText": "...",
    "sourceUrl": "...",
    "sourceTitle": "...",
    "sourceMeta": {},
    "notes": "...",
    "aiSummary": "...",
    "aiSubjects": ["..."],
    "aiKeywords": ["..."],
    "aiCatalogStatus": "COMPLETE",
    "aiEmbeddingStatus": "COMPLETE",
    "collection": { "id": "...", "name": "..." },
    "tags": [{ "id": "...", "name": "..." }],
    "createdAt": "...",
    "updatedAt": "..."
  },
  "error": null,
  "message": "OK"
}
```

## Service Layer

`cardService.ts` responsibilities:
- `createCard(userId, input)` — insert the card with its initial AI statuses and return without waiting for any AI work. The catalog status is `PENDING` when catalog generation is enabled and `NOT_AVAILABLE` when it is not implemented or not enabled (mechanism D-9). The embedding status is `NOT_AVAILABLE` throughout the MVP. When catalog generation is enabled, start it via `aiService` after the insert (TASK-AI-015). Embedding generation is future-milestone work.
- `getCards(userId, filters, pagination)` — scoped list query.
- `getCard(userId, cardId)` — scoped detail query; throw 404 if not found or wrong user.
- `updateNotes(userId, cardId, notes)` — scoped update of `notes` field only.
- `updateAiMetadata(userId, cardId, patch)` — scoped update of `aiSummary`, `aiSubjects`, `aiKeywords`. Does not change either AI status and does not trigger generation. AI results must never overwrite these edits (mechanism D-3).
- `deleteCard(userId, cardId)` — scoped delete.

All methods verify `userId` ownership at the database query level — never rely on a pre-fetched record for authorization.

Data access: services use the shared `pool` from `src/lib/db.ts` and parameterized SQL. Every statement
that reads or writes card, collection or tag data includes `user_id = $n` in the same query (for example
`UPDATE knowledge_cards SET notes = $1, updated_at = now() WHERE id = $2 AND user_id = $3`). The list
endpoint runs a `COUNT(*)` with the same `WHERE` clause as the page query. `userId` comes from `req.user.id`.

## Frontend Pages

Paths follow the existing Nuxt 4 scaffold (`app/pages/catalog/`, `app/components/catalog/`, `app/components/ai/`, `app/components/common/`). `app/pages/index.vue` is the landing page.

- `app/pages/catalog/index.vue` — card list with pagination, filter sidebar (collections, tags), search bar. (Exists; pagination and the filter sidebar are not built.)
- `app/pages/catalog/create.vue` — tabbed input: "Paste Text" and "From URL". (Exists.)
- `app/pages/catalog/[id].vue` — three-panel detail: source content, personal notes editor, AI metadata editor. (Exists with a read-only notes and AI display.)

## Frontend Components

- `app/components/catalog/KnowledgeCard.vue` — card list item showing title, summary, subjects, tags. (Exists; the earlier spec name was `CardItem.vue`.)
- Card detail view with all three layers — currently inline in `app/pages/catalog/[id].vue`. Extracting it into a component such as `app/components/catalog/CardDetail.vue` is optional.
- Text/URL input form — currently inline in `app/pages/catalog/create.vue`. Extracting it into a component such as `app/components/catalog/CardForm.vue` is optional.
- `app/components/ai/AiMetadataEditor.vue` — editable summary, subjects, keywords with one status indicator per AI operation (catalog and embedding). Metadata is shown whenever it exists, whatever the statuses are.
- `app/components/catalog/NotesEditor.vue` — textarea for personal notes. (Not yet created.)
- `app/components/common/ConfirmDialog.vue` — reusable confirmation modal. (Not yet created; generic UI primitives live in `components/common/`.)
