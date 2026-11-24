# Search — Design (MVP keyword search and future semantic retrieval)

## Status of This Design

| Category | Content |
|---|---|
| Confirmed decisions | E-2: Express and PostgreSQL own search and similarity. E-3: two independent processing statuses. Express uses the `pg` pool; no Prisma. D-11: `auto` is the intended future default mode. D-12: embedding provider deferred, local inference in FastAPI preferred. |
| MVP scope | PostgreSQL keyword search. It needs no embeddings, pgvector, FastAPI or AI result. |
| Future milestone: Semantic Retrieval | Embedding generation (FastAPI), vector storage (pgvector), semantic similarity search, related-card recommendations. Preserved below; not MVP prerequisites. |
| Currently implemented | Nothing in the backend. The frontend has `useSearch.ts`, `search.service.ts` and a search form calling `GET /api/search`, which does not exist. The form offers `auto`, `semantic` and `keyword` modes, defaulting to `auto`. |
| Blocking dependency for the MVP | None. |
| Blocking dependency for the future milestone | An embedding provider (D-12) and the embedding dimension (D-6). |

## Responsibility Boundaries

| Component | Owns |
|---|---|
| Express | `GET /api/search` (and in the future `GET /api/cards/:id/related`), query validation, authentication, `user_id` scoping, running the search queries through the `pg` pool |
| PostgreSQL | Keyword search (MVP). In the future milestone also vector storage, similarity calculation and ranking with pgvector |
| FastAPI | Nothing in search. In the future milestone it may generate embeddings. It does not search, does not access the database, and exposes no similarity endpoint |

## Architecture

MVP (keyword search):

```
Nuxt Frontend
    │  GET /api/search?q=...
    ▼
Express — searchService.keywordSearch
    └── Run keyword query against PostgreSQL (user-scoped)
        No FastAPI call, no embedding, no pgvector
```

Future milestone (semantic retrieval):

```
Nuxt Frontend
    │  GET /api/search?q=...&mode=auto
    ▼
Express — searchService
    ├── 1. Call FastAPI POST /embeddings { text: query }   [FUTURE: D-12]
    ├── 2. Receive query embedding vector
    ├── 3. Run pgvector similarity query (user-scoped; PostgreSQL computes and ranks)
    └── 4. Return ranked results (fallback to keyword if empty)

Nuxt Frontend (card detail page)
    │  GET /api/cards/:id/related
    ▼
Express — searchService.getRelatedCards
    ├── 1. Fetch current card's embedding from DB
    └── 2. Run pgvector nearest-neighbour query (user-scoped, exclude self)
```

## API Endpoints

### GET /api/search
Query parameters:
- `q` — search query string (required, min 1 char, max 500 chars)
- `mode` — `semantic` | `keyword` | `auto` (future default: `auto`, decision D-11). In the MVP only keyword search exists; how the endpoint treats `mode` before the milestone is open (D-10).
- `page` — page number (default: 1)
- `pageSize` — results per page (default: 20, max: 50)

Response (200), future full shape:
```json
{
  "data": {
    "items": [
      {
        "id": "...",
        "sourceTitle": "...",
        "aiSummary": "...",
        "aiSubjects": ["..."],
        "similarityScore": 0.87,
        "createdAt": "..."
      }
    ],
    "total": 8,
    "mode": "semantic",
    "fallback": false,
    "page": 1,
    "pageSize": 20
  },
  "error": null,
  "message": "OK"
}
```
MVP keyword results carry the same fields without `similarityScore`.

### GET /api/cards/:id/related  (future milestone)
Response (200):
```json
{
  "data": {
    "items": [
      { "id": "...", "sourceTitle": "...", "aiSummary": "...", "similarityScore": 0.91 }
    ]
  },
  "error": null,
  "message": "OK"
}
```

## MVP: Keyword Search

All queries run through the shared `pg` pool with parameterized values, snake_case column names, and a `user_id` scope.

```sql
SELECT id, source_title, ai_summary, ai_subjects, created_at
FROM knowledge_cards
WHERE user_id = $1
  AND (
    source_title ILIKE $2 ESCAPE '\'
    OR source_text ILIKE $2 ESCAPE '\'
    OR ai_summary ILIKE $2 ESCAPE '\'
    OR $3 = ANY (ai_keywords)
  )
LIMIT $4;
```

`$2` is `'%' || q || '%'` with `\`, `%` and `_` in `q` escaped. `$3` is `q` (exact, case-sensitive match against the keyword array, as in the original design). The ordering of keyword results is not yet specified and is not changed here.

Properties:
- Needs only the `knowledge_cards` table from the catalog migration. No pgvector extension, no `embedding` column, no AI call.
- Finds a card by its source text and title even when the card has no AI metadata. AI summary and keywords (and the user's edits to them) widen the matches when present.
- Independent of both AI statuses.

## Future Milestone: pgvector Query Design

Vector parameters are sent as text (for example `'[0.1,0.2]'`) and cast with `::vector`.

### Semantic Search

```sql
SELECT id, source_title, ai_summary, ai_subjects, created_at,
       1 - (embedding <=> $1::vector) AS similarity_score
FROM knowledge_cards
WHERE user_id = $2
  AND embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT $3;
```

The `<=>` operator is cosine distance. `1 - distance` gives a similarity score in [0, 1].

### Related Cards

`$1` is the current card's embedding, read first with `WHERE id = $1 AND user_id = $2`.

```sql
SELECT id, source_title, ai_summary,
       1 - (embedding <=> $1::vector) AS similarity_score
FROM knowledge_cards
WHERE user_id = $2
  AND id <> $3
  AND embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

### Database Index

Added as a plain SQL migration in `backend/expressjs/migrations/`. Migration files re-run on every `npm run migrate`, so it must be idempotent:
```sql
CREATE INDEX IF NOT EXISTS knowledge_cards_embedding_hnsw
ON knowledge_cards USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

This migration needs the `embedding` column to exist with a fixed dimension, which is undecided (D-6). It is future-milestone work, not an MVP prerequisite.

## AI Backend Boundary (future milestone)

Express needs a query embedding from the AI backend boundary. FastAPI would generate it; local inference is the preferred direction and nothing is selected (D-12). The `POST /embeddings` contract documented in the ai-cataloging design is planned and not implemented, and it currently requires a `card_id` that a search query does not have (D-7). No similarity-search endpoint exists or is planned in FastAPI.

## Service Layer

```typescript
// src/services/searchService.ts
async function keywordSearch(userId: string, query: string, limit: number): Promise<SearchResult[]>        // MVP
async function semanticSearch(userId: string, query: string, limit: number): Promise<SearchResult[]>       // future milestone
async function getRelatedCards(userId: string, cardId: string, limit: number): Promise<SearchResult[]>     // future milestone
```

## Frontend

- `app/pages/catalog/index.vue` — search bar at the top (through `app/components/catalog/CatalogSearch.vue`); triggers `GET /api/search` on submit. These exist in the scaffold. `app/pages/index.vue` is the landing page, not the card list. MVP: keyword results only. The scaffold's mode selector (`auto`, `semantic`, `keyword`) and its "No semantic results found" fallback notice do not match the MVP; what to show before the milestone is open (D-10).
- `app/composables/useSearch.ts` — expose `search(query, mode)`, `results`, `isLoading`, `isFallback`. (Exists in the scaffold.) `isFallback` is meaningful only in the future milestone.
- Future milestone: `app/pages/catalog/[id].vue` gets a "Related Cards" section at the bottom, which calls `GET /api/cards/:id/related` on page load, and `app/components/catalog/RelatedCards.vue` is a horizontal list of up to 5 related card items. (The page exists; the section and component do not.)

## Open Decisions

### D-10: MVP search API and UI shape (open)
While only keyword search exists: does `GET /api/search` accept `mode`, and what do `semantic` and `auto` do before the milestone? What does the frontend mode selector show? The scaffold defaults to `auto` and offers `semantic`, neither of which can work in the MVP. Not decided.

### D-11: Default search mode (resolved by the project owner)

| Mode | Meaning in the specification |
|---|---|
| `semantic` | Embed the query and rank by vector similarity only (REQ-SEM-001, REQ-SEM-002) |
| `keyword` | Case-insensitive contains search over title, source text and summary, plus an exact keyword match (REQ-SEM-010) |
| `auto` | Semantic search first; if it returns no results, run keyword search and set `fallback: true` (REQ-SEM-004; TASK-SEM-008) |

The project owner decided that `auto` is the intended future default. REQ-SEM-004 and this design now agree, and the existing frontend scaffold already defaults to `auto`. The decision applies when semantic search exists. The MVP default is covered by D-10.

### D-12: Embedding provider (deferred)
Deferred to the future milestone. Local inference in FastAPI is the preferred direction, which keeps card text off a second hosted provider. No embedding model or runtime is selected. The embedding dimension (D-6) depends on it.

### D-14: Two keyword surfaces (open)
REQ-CAT-003 and the catalog design give `GET /api/cards` a `q` keyword filter, and this spec defines `GET /api/search`. Which one is the MVP keyword search, and whether both exist, is not decided.

Separate from D-14: the Community Catalog has its own keyword search, `GET /api/community/cards?q=` (catalog-management REQ-CAT-012), implemented in `communityService.ts`. It searches published cards only, matches subjects and keywords case-insensitively, and matches source text only where the author shared it. Neither vault search surface exists yet. When one is built, it can reuse the same escaped `ILIKE` approach, scoped to `user_id`.
