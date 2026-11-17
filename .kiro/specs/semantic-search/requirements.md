# Semantic Search — Requirements

## Overview

Semantic search allows users to find knowledge cards using natural language queries, even when the query does not contain exact keywords present in the card. It also powers related card discovery — surfacing cards that are conceptually similar to the one currently being viewed.

Semantic search is backed by pgvector in PostgreSQL. Express orchestrates the search and PostgreSQL ranks results by vector similarity. Embeddings are to be produced through the AI backend boundary (FastAPI) once an embedding source is established (D-12). FastAPI does not search and does not access the database.

## Implementation Status

| Aspect | Status |
|---|---|
| Requirements REQ-SEM-001 to REQ-SEM-009 | Confirmed and in scope. |
| Runtime AI provider (decision E-1) | Intended provider is Meta Model API, used for catalog generation. |
| Embedding source | **UNRESOLVED (D-12).** Meta's published model catalog lists no embedding model. |
| Semantic search and related cards | **BLOCKED** until an embedding source is established (D-12) and the vector dimension is decided (D-6). |
| Keyword search (REQ-SEM-003 fallback path) | Independent of runtime AI. |
| Current implementation | None. |

## Requirements

### REQ-SEM-001: Semantic Search Query
- An authenticated user can submit a natural language search query.
- Express obtains a query embedding from the AI backend boundary (FastAPI). Blocked until an embedding source is established (D-12).
- The query embedding is used to perform a vector similarity search (cosine or inner product) against stored card embeddings.
- Only the authenticated user's own cards are searched — results from other users are never returned.

### REQ-SEM-002: Search Results
- Semantic search returns a ranked list of the user's cards ordered by similarity score.
- Each result includes: card id, title, summary, subjects, similarity score, and createdAt.
- A maximum of 20 results is returned per query.
- Cards with no stored embedding are excluded from semantic search results. Such cards have an embedding status other than `COMPLETE` (`PENDING`, `FAILED` or `NOT_AVAILABLE`). The catalog status does not affect eligibility.

### REQ-SEM-003: Keyword Search Fallback
- If semantic search returns zero results, the system falls back to a keyword-based full-text search against `sourceText`, `sourceTitle`, `aiSummary`, and `aiKeywords`.
- The fallback result set is indicated in the response so the frontend can display "No semantic results found — showing keyword matches."

### REQ-SEM-004: Combined Search Endpoint
- A single search endpoint handles both keyword and semantic search.
- Query parameter `mode` accepts `semantic` (default; **disputed, see D-11**), `keyword`, or `auto` (semantic with keyword fallback).
- Open decision D-11: this requirement names `semantic` as the default, while the design and the frontend scaffold use `auto`. See the semantic-search design ("Open Decisions") for the analysis and a recommendation. Until it is resolved, no document should be treated as authoritative on the default.

### REQ-SEM-005: Related Card Discovery
- When viewing a card detail, the application surfaces up to 5 related cards.
- Related cards are the nearest neighbors by vector similarity to the current card's embedding.
- The current card itself is excluded from the results.
- Cards without embeddings are excluded.
- Related cards belong only to the authenticated user.

### REQ-SEM-006: Embedding Freshness
- Embeddings are generated when a card is created.
- If a card's embedding is absent (creation failed or AI was unavailable), related card discovery and semantic search exclude that card.
- There is no automatic re-embedding trigger in the MVP.
- Cards created while embedding generation is not available (embedding status `NOT_AVAILABLE`) have no embedding. Whether they are processed later is an open decision (D-2). The statement above about automatic re-embedding is unchanged.

### REQ-SEM-007: User Scope Enforcement
- All vector similarity queries must include a `userId` filter.
- The pgvector similarity query must be constructed so it never returns another user's cards regardless of similarity score.

### REQ-SEM-008: Performance
- Semantic search must complete within a reasonable time for a personal knowledge base (target: < 2 seconds for up to 10,000 cards).
- An HNSW or IVFFlat index on the embedding column is required for performance at scale.

### REQ-SEM-009: Responsibility Boundaries
- Express owns the search endpoints, query validation, authentication, user-ownership filtering and the similarity queries.
- PostgreSQL with pgvector stores vectors and calculates and ranks similarity.
- FastAPI does not access the primary database, has no similarity-search implementation, and exposes no similarity-search endpoint.
- Acceptance criterion AC-SEM-009-1: No FastAPI route performs or claims to perform similarity search.

## Out of Scope

- Cross-user federated search.
- Real-time search-as-you-type with semantic matching.
- Hybrid dense + sparse retrieval (BM25 + vector).
- Re-ranking with a cross-encoder model.
