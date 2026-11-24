# Search — Requirements (MVP keyword search and future semantic retrieval)

## Overview

This spec covers finding knowledge cards. It has two parts:
- **MVP:** PostgreSQL keyword search. It works without embeddings, pgvector, FastAPI or any AI result.
- **Future milestone, Semantic Retrieval:** embedding generation, vector storage, semantic similarity search and related-card recommendations. These requirements are preserved but are not MVP prerequisites. No MVP requirement or task depends on them.

Semantic search allows users to find knowledge cards using natural language queries, even when the query does not contain exact keywords present in the card. It also powers related card discovery — surfacing cards that are conceptually similar to the one currently being viewed.

In the future milestone, semantic search is backed by pgvector in PostgreSQL. Express owns the search endpoints and the database operations, and runs the similarity queries; PostgreSQL ranks results by vector similarity. FastAPI generates the embeddings (local inference is the preferred direction; no embedding provider or model is selected). FastAPI does not search and does not access the database.

## Scope: MVP and Future Milestone

| Requirement | Scope |
|---|---|
| REQ-SEM-010 Keyword Search | **MVP** |
| REQ-SEM-007 User Scope Enforcement | **MVP** for keyword search; also applies to vector queries in the future milestone |
| REQ-SEM-009 Responsibility Boundaries | **MVP** (a rule that applies now and later) |
| REQ-SEM-001 Semantic Search Query | **Future milestone** |
| REQ-SEM-002 Search Results (semantic) | **Future milestone** |
| REQ-SEM-003 Keyword Search Fallback | **Future milestone** (needs semantic search). Keyword search itself is REQ-SEM-010 |
| REQ-SEM-004 Combined Search Endpoint | **Future milestone.** In the MVP only keyword search exists; the MVP API shape is open (D-10) |
| REQ-SEM-005 Related Card Discovery | **Future milestone** |
| REQ-SEM-006 Embedding Freshness | **Future milestone** |
| REQ-SEM-008 Performance (vector index) | **Future milestone** |

## Implementation Status

| Aspect | Status |
|---|---|
| MVP keyword search | In scope. Not implemented. Needs no AI and no pgvector |
| Semantic search and related cards | **Future milestone.** Preserved, not blocked work for the MVP |
| Embedding provider | **Deferred (D-12).** Local inference in FastAPI is the preferred direction; nothing is selected. Meta's published model catalog lists no embedding model |
| Default search mode | **Resolved by the project owner (D-11):** `auto` is the intended future default. The MVP shape is open (D-10) |
| Current implementation | None. The frontend has a search form that offers `auto`, `semantic` and `keyword` modes, which does not match the MVP |

## Requirements

### REQ-SEM-010: Keyword Search (MVP)
- An authenticated user can search their own knowledge cards by keyword.
- The search matches the card's `sourceText`, `sourceTitle`, `aiSummary` and `aiKeywords` (including values the user edited).
- Only the authenticated user's own cards are searched and returned — results from other users are never returned (REQ-SEM-007).
- Each result includes: card id, title, summary, subjects and createdAt. A similarity score is not part of keyword results.
- It works with no embeddings, no pgvector extension and no AI service. A card with no AI metadata is still found by its source text and title.
- Results do not depend on the card's AI statuses.
- Acceptance criteria:
  - AC-SEM-010-1: A query matching a card's source text returns that card, even when the card has no AI metadata.
  - AC-SEM-010-2: A query returns none of another user's cards, whatever they contain.
  - AC-SEM-010-3: Search works on a database where the pgvector extension and the `embedding` column do not exist.
  - AC-SEM-010-4: Search works while FastAPI and the AI provider are not running.
  - AC-SEM-010-5: A card with embedding status `NOT_AVAILABLE` and any catalog status appears in results when its text matches.

### REQ-SEM-001: Semantic Search Query (Future milestone)
- An authenticated user can submit a natural language search query.
- Express obtains a query embedding from the AI backend boundary (FastAPI). Deferred with the embedding provider (D-12).
- The query embedding is used to perform a vector similarity search (cosine or inner product) against stored card embeddings.
- Only the authenticated user's own cards are searched — results from other users are never returned.

### REQ-SEM-002: Search Results (Future milestone)
- Semantic search returns a ranked list of the user's cards ordered by similarity score.
- Each result includes: card id, title, summary, subjects, similarity score, and createdAt.
- A maximum of 20 results is returned per query.
- Cards with no stored embedding are excluded from semantic search results. Such cards have an embedding status other than `COMPLETE` (`PENDING`, `FAILED` or `NOT_AVAILABLE`). The catalog status does not affect eligibility.

### REQ-SEM-003: Keyword Search Fallback (Future milestone)
- If semantic search returns zero results (as in `auto` mode, REQ-SEM-004), the system falls back to a keyword-based full-text search against `sourceText`, `sourceTitle`, `aiSummary`, and `aiKeywords` (REQ-SEM-010).
- The fallback result set is indicated in the response so the frontend can display "No semantic results found — showing keyword matches."

### REQ-SEM-004: Combined Search Endpoint (Future milestone)
- A single search endpoint handles both keyword and semantic search.
- Query parameter `mode` accepts `semantic`, `keyword`, or `auto` (semantic with keyword fallback).
- The default mode is `auto` (decision D-11, resolved by the project owner). This replaces the earlier text that named `semantic`.
- In the MVP only keyword search exists. How the endpoint and UI behave before the milestone is open (D-10).

### REQ-SEM-005: Related Card Discovery (Future milestone)
- When viewing a card detail, the application surfaces up to 5 related cards.
- Related cards are the nearest neighbors by vector similarity to the current card's embedding.
- The current card itself is excluded from the results.
- Cards without embeddings are excluded.
- Related cards belong only to the authenticated user.

### REQ-SEM-006: Embedding Freshness (Future milestone)
- Embeddings are generated when a card is created.
- If a card's embedding is absent (creation failed or embedding generation was not available), related card discovery and semantic search exclude that card.
- There is no automatic re-embedding trigger in the MVP.
- Cards created while embedding generation is not available (embedding status `NOT_AVAILABLE`, which includes every card created before the milestone) have no embedding. Whether they are processed later is an open decision (D-2). The statement above about automatic re-embedding is unchanged.

### REQ-SEM-007: User Scope Enforcement
- All search queries, including keyword queries, must include a `user_id` filter taken from the authenticated session.
- Future milestone: the pgvector similarity query must be constructed so it never returns another user's cards regardless of similarity score.

### REQ-SEM-008: Performance (Future milestone)
- Semantic search must complete within a reasonable time for a personal knowledge base (target: < 2 seconds for up to 10,000 cards).
- An HNSW or IVFFlat index on the embedding column is required for performance at scale.

### REQ-SEM-009: Responsibility Boundaries
- Express owns the search endpoints, query validation, authentication, user-ownership filtering and the search and similarity queries.
- PostgreSQL runs keyword search (MVP) and, in the future milestone, stores vectors and calculates and ranks similarity with pgvector.
- FastAPI does not access the primary database, has no similarity-search implementation, and exposes no similarity-search endpoint. Its only future role is generating embeddings.
- Acceptance criterion AC-SEM-009-1: No FastAPI route performs or claims to perform similarity search.

## Out of Scope

- Cross-user federated search.
- Real-time search-as-you-type with semantic matching.
- Hybrid dense + sparse retrieval (BM25 + vector).
- Re-ranking with a cross-encoder model.
