# Semantic Search — Design

## Architecture

```
Nuxt Frontend
    │  GET /api/search?q=...&mode=semantic
    ▼
Express — searchService
    ├── 1. Call FastAPI POST /embeddings { text: query }
    ├── 2. Receive query embedding vector
    ├── 3. Run pgvector similarity query (user-scoped)
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
- `mode` — `semantic` | `keyword` | `auto` (default: `auto`)
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

### Semantic Search

```sql
SELECT id, "sourceTitle", "aiSummary", "aiSubjects", "createdAt",
       1 - (embedding <=> $1::vector) AS similarity_score
FROM knowledge_cards
WHERE "userId" = $2
  AND embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT $3;
```

Prisma raw query equivalent:
```typescript
const results = await prisma.$queryRaw`
  SELECT id, "sourceTitle", "aiSummary", "aiSubjects", "createdAt",
         1 - (embedding <=> ${queryVector}::vector) AS similarity_score
  FROM knowledge_cards
  WHERE "userId" = ${userId}
    AND embedding IS NOT NULL
  ORDER BY embedding <=> ${queryVector}::vector
  LIMIT ${limit}
`
```

The `<=>` operator is cosine distance. `1 - distance` gives a similarity score in [0, 1].

### Related Cards

```typescript
const related = await prisma.$queryRaw`
  SELECT id, "sourceTitle", "aiSummary",
         1 - (embedding <=> ${cardEmbedding}::vector) AS similarity_score
  FROM knowledge_cards
  WHERE "userId" = ${userId}
    AND id != ${cardId}
    AND embedding IS NOT NULL
  ORDER BY embedding <=> ${cardEmbedding}::vector
  LIMIT 5
`
```

### Keyword Fallback

```typescript
await prisma.knowledgeCard.findMany({
  where: {
    userId,
    OR: [
      { sourceTitle: { contains: q, mode: 'insensitive' } },
      { sourceText: { contains: q, mode: 'insensitive' } },
      { aiSummary: { contains: q, mode: 'insensitive' } },
      { aiKeywords: { has: q } },
    ],
  },
  take: limit,
})
```

## Database Index

Add to Prisma schema migration (raw SQL):
```sql
CREATE INDEX knowledge_cards_embedding_hnsw
ON knowledge_cards USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

This is added as a Prisma custom migration since HNSW index creation is not yet expressible in the Prisma schema DSL.

## FastAPI Endpoint Used

`POST /embeddings` — sends the user's query string, receives the embedding vector. Same endpoint used for card creation.

## Service Layer

```typescript
// src/services/searchService.ts
async function semanticSearch(userId: string, query: string, limit: number): Promise<SearchResult[]>
async function keywordSearch(userId: string, query: string, limit: number): Promise<SearchResult[]>
async function getRelatedCards(userId: string, cardId: string, limit: number): Promise<SearchResult[]>
```

## Frontend

- `app/pages/index.vue` — search bar at the top; triggers `GET /api/search` on submit; displays mode and fallback indicator.
- `app/composables/useSearch.ts` — expose `search(query, mode)`, `results`, `isLoading`, `isFallback`.
- `app/pages/cards/[id].vue` — "Related Cards" section at the bottom; calls `GET /api/cards/:id/related` on page load.
- `app/components/card/RelatedCards.vue` — horizontal list of up to 5 related card items.
