# Semantic Search — Design

## Status of This Design

| Category | Content |
|---|---|
| Confirmed decisions | E-2: Express and PostgreSQL own similarity. E-3: two independent processing statuses. Express uses the `pg` pool; no Prisma. The architecture is provider-neutral. |
| Runtime AI provider | E-1: the intended provider is Meta Model API (catalog generation). Its published model catalog lists no embedding model, so the embedding source is unresolved (D-12). Semantic search and related cards remain in scope. |
| Currently implemented | Nothing in the backend. The frontend has `useSearch.ts` and `search.service.ts` calling `GET /api/search`, which does not exist. |
| Planned but blocked | Query embedding, semantic search, related cards. |
| Blocking dependency | An established embedding source (D-12) and the embedding dimension (D-6). |

## Responsibility Boundaries

| Component | Owns |
|---|---|
| Express | `GET /api/search` and `GET /api/cards/:id/related`, query validation, authentication, `user_id` scoping, running the similarity queries through the `pg` pool |
| PostgreSQL + pgvector | Vector storage, similarity calculation and ranking |
| FastAPI (planned) | Producing a query embedding through a provider-neutral integration. It does not search, does not access the database, and exposes no similarity endpoint |

## Architecture

```
Nuxt Frontend
    │  GET /api/search?q=...&mode=semantic
    ▼
Express — searchService
    ├── 1. Call FastAPI POST /embeddings { text: query }   [BLOCKED: D-12]
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
- `mode` — `semantic` | `keyword` | `auto` (default: `auto`; **disputed, see D-11**: the requirements name `semantic`)
- `page` — page number (default: 1)
- `pageSize` — results per page (default: 20, max: 50)

Response (200):
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

### GET /api/cards/:id/related
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

## pgvector Query Design

All queries run through the shared `pg` pool with parameterized values. A vector parameter is sent as text (for example `'[0.1,0.2]'`) and cast with `::vector`. Column names are snake_case. Every query is scoped by `user_id`.

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

### Keyword Fallback

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

## Database Index

Added as a plain SQL migration in `backend/expressjs/migrations/`. Migration files re-run on every `npm run migrate`, so it must be idempotent:
```sql
CREATE INDEX IF NOT EXISTS knowledge_cards_embedding_hnsw
ON knowledge_cards USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

This migration is blocked: it needs the `embedding` column to exist with a fixed dimension, which is undecided (D-6).

## AI Backend Boundary (BLOCKED: D-12)

Express needs a query embedding from the AI backend boundary. The `POST /embeddings` contract documented in the ai-cataloging design is planned and not implemented, and it currently requires a `card_id` that a search query does not have (D-7). No similarity-search endpoint exists or is planned in FastAPI.

## Service Layer

```typescript
// src/services/searchService.ts
async function semanticSearch(userId: string, query: string, limit: number): Promise<SearchResult[]>
async function keywordSearch(userId: string, query: string, limit: number): Promise<SearchResult[]>
async function getRelatedCards(userId: string, cardId: string, limit: number): Promise<SearchResult[]>
```

## Frontend

- `app/pages/catalog/index.vue` — search bar at the top (through `app/components/catalog/CatalogSearch.vue`); triggers `GET /api/search` on submit; displays mode and fallback indicator. These exist in the scaffold. `app/pages/index.vue` is the landing page, not the card list.
- `app/composables/useSearch.ts` — expose `search(query, mode)`, `results`, `isLoading`, `isFallback`. (Exists in the scaffold.)
- `app/pages/catalog/[id].vue` — "Related Cards" section at the bottom; calls `GET /api/cards/:id/related` on page load. (The page exists; the section does not.)
- `app/components/catalog/RelatedCards.vue` — horizontal list of up to 5 related card items. (Not yet created.)

## Open Decisions

### D-11: Default search mode

| Mode | Meaning in the existing specification |
|---|---|
| `semantic` | Embed the query and rank by vector similarity only (REQ-SEM-001, REQ-SEM-002) |
| `keyword` | Case-insensitive contains search over title, source text and summary, plus an exact keyword match (REQ-SEM-003; Keyword Fallback SQL) |
| `auto` | Semantic search first; if it returns no results, run keyword search and set `fallback: true` (REQ-SEM-004; TASK-SEM-008) |

Every occurrence of a default:

| Where | Default stated |
|---|---|
| `requirements.md` REQ-SEM-004 | `semantic` |
| `design.md` GET /api/search parameters | `auto` |
| `design.md` architecture sketch and example response | `semantic` (examples only, not a default) |
| `app/composables/useSearch.ts`, `app/services/search.service.ts` | `auto` (implementation) |
| `app/components/catalog/CatalogSearch.vue` | `auto` selected initially (implementation) |

Evidence does not settle it. The requirement (normative) says `semantic`. The design and the existing frontend say `auto`. REQ-SEM-003 describes the keyword fallback as general system behaviour, which only happens by default under `auto`, and REQ-SEM-003 and REQ-SEM-004 disagree on whether `semantic` mode also falls back. Nothing in `product.md` names a default.

Recommendation (not applied): make `auto` the default and amend REQ-SEM-004 to say so. Reasons: it matches REQ-SEM-003's fallback behaviour, the design and the frontend already built; it still returns useful results when no embeddings exist (today, and for cards whose embedding failed), where a `semantic` default would return nothing; and `semantic` and `keyword` stay selectable. The decision belongs to you because it changes what the requirement says.

### D-12: Embedding source

The intended provider's published model catalog lists no embedding model. Semantic search and related cards cannot work until the source of embeddings is established and its dimension is known (D-6). Keyword search is unaffected.
