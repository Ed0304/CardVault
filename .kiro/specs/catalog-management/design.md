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

### Catalog entry fields (`007_add_catalog_entry_fields.sql`, REQ-CAT-015)

`catalog_title TEXT` (NULL or 1–200 characters), `ai_facts JSONB` and `ai_related JSONB` (arrays of at most 8, default `[]`). Additive; existing cards keep NULL and empty lists. API fields: `catalogTitle` (summaries and detail), `aiFacts`, `aiRelated` (detail; each related item carries a computed `cardId` or null). `PATCH /api/cards/:id/ai-metadata` accepts `catalogTitle` (empty or null clears it), `aiFacts` and `aiRelated`, and still changes only the fields sent. Design details: AI Cataloging design, "Catalog Entry Structure".

### Publishing and provenance (`005_add_card_publishing.sql`, REQ-CAT-011 to REQ-CAT-014)

Additive only. Existing cards become `PRIVATE` through the column default.

```sql
ALTER TABLE knowledge_cards
    ADD COLUMN IF NOT EXISTS visibility         TEXT        NOT NULL DEFAULT 'PRIVATE',
    ADD COLUMN IF NOT EXISTS published_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS share_source_text  BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS saved_from_card_id UUID,
    ADD COLUMN IF NOT EXISTS saved_from_author  TEXT;
-- Added idempotently in a DO block (checked against pg_constraint):
--   knowledge_cards_visibility_check   CHECK (visibility IN ('PRIVATE', 'PUBLIC'))
--   knowledge_cards_published_at_check CHECK ((visibility = 'PUBLIC') = (published_at IS NOT NULL))
--   knowledge_cards_saved_from_check   CHECK ((saved_from_card_id IS NULL) = (saved_from_author IS NULL))
CREATE INDEX IF NOT EXISTS knowledge_cards_public_idx
    ON knowledge_cards (published_at DESC, id DESC) WHERE visibility = 'PUBLIC';
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_cards_user_saved_from_key
    ON knowledge_cards (user_id, saved_from_card_id) WHERE saved_from_card_id IS NOT NULL;
```

Provenance design:
- Provenance lives on the copy's own row, so the copy and its provenance are written by one `INSERT`, inside a transaction that also locks the original (`FOR SHARE`) from the read until commit.
- `saved_from_card_id` has **no foreign key**, by design. `ON DELETE CASCADE` would delete copies with the original. `SET NULL` would erase the provenance. `RESTRICT` would stop owners deleting their own cards. The column is a historical record of where the copy came from, not a live link.
- `saved_from_author` is a snapshot of the author's `username` when the copy was made, so attribution survives the original being unpublished or deleted. No email or user id is stored or exposed. Usernames are not unique (`users` has no such constraint), so attribution identifies a display name, not an account.
- The partial unique index allows one copy per user per original and rejects simultaneous duplicate saves. Deleting the copy frees the slot.
- A copy whose author did not share the source text stores `source_text = ''` (the column is `NOT NULL`; REQ-CAT-010 allows an empty layer).

### Future milestone schema (Semantic Retrieval; not an MVP prerequisite)

```sql
-- 002_enable_pgvector.sql  (TASK-CAT-001)
CREATE EXTENSION IF NOT EXISTS vector;

-- 006_add_embedding_column.sql  (TASK-CAT-024; 004 and 005 are taken by refresh tokens and publishing)
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
| PATCH | /api/cards/:id/collection | Put the card in one of the user's collections (`{ collectionId }`), or remove it (`{ collectionId: null }`) |
| PATCH | /api/cards/:id/visibility | Publish (`{ visibility: "PUBLIC", shareSourceText: boolean }`) or unpublish (`{ visibility: "PRIVATE" }`) an owned card. 409 `SAVED_COPY_NOT_PUBLISHABLE` for saved copies |
| GET | /api/community/cards | Published cards, newest published first (`q`, `page`, `pageSize`) |
| GET | /api/community/cards/:id | One published card (public fields and `viewer`) |
| POST | /api/community/cards/:id/save | Save an independent private copy (201). 404 if not published; 409 `CANNOT_SAVE_OWN_CARD` or `CARD_ALREADY_SAVED` |
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
        "visibility": "PRIVATE",
        "publishedAt": null,
        "savedFrom": { "cardId": "...", "authorUsername": "...", "originalAvailable": true },
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
    "visibility": "PUBLIC",
    "publishedAt": "...",
    "shareSourceText": false,
    "savedFrom": null,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "error": null,
  "message": "OK"
}
```

`savedFrom` is `null` for the user's own cards. For a saved copy, `originalAvailable` says whether the original is still published, so the UI can link to it.

## Public Card Responses (Community Catalog)

List item (`GET /api/community/cards`, inside the same `{ items, total, page, pageSize }` page shape):

```json
{
  "id": "...",
  "sourceTitle": "...",
  "sourceUrl": "...",
  "aiSummary": "...",
  "aiSubjects": ["..."],
  "aiKeywords": ["..."],
  "hasSourceText": false,
  "author": { "username": "..." },
  "publishedAt": "..."
}
```

Detail (`GET /api/community/cards/:id`) adds `"sourceText": "..." | null` (null unless shared) and `"viewer": { "isOwner": false, "savedCardId": "..." | null }`.

These are the only fields. The integration tests assert the exact key sets.

## Service Layer

`cardService.ts` responsibilities:
- `createCard(userId, input)` — insert the card with both AI statuses `NOT_AVAILABLE` and return. No AI work starts; cataloging is requested by the owner later (`catalogingService.requestCatalog`, AI Cataloging design).
- `listCards(userId, query)` — scoped list query, with optional `collectionId`, `tagId` and keyword `q` (escaped `ILIKE` over title, source text, notes, summary, subjects and keywords; D-14).
- `getCard(userId, cardId)` — scoped detail query; throw 404 if not found or wrong user.
- `updateNotes(userId, cardId, notes)` — scoped update of `notes` field only.
- `updateAiMetadata(userId, cardId, patch)` — scoped update of `aiSummary`, `aiSubjects`, `aiKeywords`. Does not change either AI status and does not trigger generation. Also clears any pending AI draft. AI results are only ever stored as that draft, so they never overwrite these edits (D-3).
- `deleteCard(userId, cardId)` — scoped delete.

- `setCollection(userId, cardId, { collectionId })` — the collection's ownership is checked inside the same `UPDATE`.
- `setVisibility(userId, cardId, input)` — publish or unpublish in one scoped `UPDATE`. Publishing keeps an existing `published_at` and refuses saved copies (`AND saved_from_card_id IS NULL`). Unpublishing clears `published_at` and `share_source_text`.

All methods verify `userId` ownership at the database query level — never rely on a pre-fetched record for authorization.

`communityService.ts` responsibilities (REQ-CAT-012 to REQ-CAT-014):
- `listPublicCards(query)` — `WHERE visibility = 'PUBLIC'`, optional keyword condition, `ORDER BY published_at DESC, id DESC`, with a `COUNT(*)` under the same `WHERE`. The keyword condition is `ILIKE $n ESCAPE '\'` (with `\`, `%` and `_` in `q` escaped) over `source_title`, `ai_summary`, `array_to_string(ai_subjects, ' ')` and `array_to_string(ai_keywords, ' ')`, plus `source_text` only `AND share_source_text`, so search cannot reveal unshared text.
- `getPublicCard(viewerId, cardId)` — the same public columns, `CASE WHEN share_source_text THEN source_text END`, and the viewer facts.
- `saveToVault(userId, cardId)` — `BEGIN`; read the original `WHERE id = $1 AND visibility = 'PUBLIC' FOR SHARE OF c`; reject the owner; `INSERT` the copy with the initial AI statuses and the provenance columns; `COMMIT`. A unique violation becomes 409 `CARD_ALREADY_SAVED`.

The read queries are the one place not scoped to `user_id`: they are scoped to `visibility = 'PUBLIC'` and select an explicit list of public columns (`PUBLIC_COLUMNS`). The insert is scoped to the signed-in user.

Data access: services use the shared `pool` from `src/lib/db.ts` and parameterized SQL. Every statement
that reads or writes card, collection or tag data includes `user_id = $n` in the same query (for example
`UPDATE knowledge_cards SET notes = $1, updated_at = now() WHERE id = $2 AND user_id = $3`). The list
endpoint runs a `COUNT(*)` with the same `WHERE` clause as the page query. `userId` comes from `req.user.id`.

## Frontend Pages

Paths follow the existing Nuxt 4 scaffold (`app/pages/catalog/`, `app/components/catalog/`, `app/components/ai/`, `app/components/common/`). `app/pages/index.vue` is the landing page.

- `app/pages/catalog/index.vue` — card list with pagination, filter sidebar (collections, tags), search bar. (Exists; pagination and the filter sidebar are not built.)
- `app/pages/catalog/create.vue` — tabbed input: "Paste Text" and "From URL". (Exists.)
- `app/pages/catalog/[id].vue` — three-panel detail: source content, personal notes editor, AI metadata editor. (Exists with a read-only notes and AI display.) Also shows the visibility badge, the attribution notice on saved copies, and the publishing panel.
- `app/pages/community/index.vue` — Community Catalog: keyword search (`q` and `page` in the URL), card grid, pager, loading, error and empty states. (Exists.)
- `app/pages/community/[id].vue` — public card detail with author, source, catalog details, and Save to My Vault, or a link to the viewer's copy or own card. (Exists.)

The primary navigation labels the vault "My Vault" and adds "Community". Both require sign-in.

## Frontend Components

- `app/components/catalog/KnowledgeCard.vue` — card list item showing title, summary, subjects, tags. (Exists; the earlier spec name was `CardItem.vue`.)
- Card detail view with all three layers — currently inline in `app/pages/catalog/[id].vue`. Extracting it into a component such as `app/components/catalog/CardDetail.vue` is optional.
- Text/URL input form — currently inline in `app/pages/catalog/create.vue`. Extracting it into a component such as `app/components/catalog/CardForm.vue` is optional.
- `app/components/ai/AiMetadataEditor.vue` — editable summary, subjects, keywords with one status indicator per AI operation (catalog and embedding). Metadata is shown whenever it exists, whatever the statuses are.
- `app/components/catalog/NotesEditor.vue` — textarea for personal notes. (Not yet created.)
- `app/components/catalog/CardPublishing.vue` — publish / unpublish panel. Publishing opens an inline confirmation listing what becomes public and what stays private, with an unticked "Also share the original text" checkbox. Unpublishing confirms with `window.confirm`. Saved copies show why they can't be published. (Exists.)
- `app/components/community/CommunityCard.vue` — Community Catalog list item: title, source host, summary, subjects, author, publication date. (Exists.)
- `app/composables/useCommunity.ts` and `app/services/community.service.ts` — list, detail and save; a `CARD_ALREADY_SAVED` response reloads the card to show the existing copy. (Exist.)
- `app/components/common/ConfirmDialog.vue` — reusable confirmation modal. (Not yet created; generic UI primitives live in `components/common/`.)
