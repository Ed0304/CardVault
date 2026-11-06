# AI Cataloging — Requirements

## Overview

AI cataloging automatically generates structured metadata for each knowledge card: a summary, a list of subjects, and a set of keywords. This metadata improves discoverability and gives users a quick understanding of their saved content without re-reading it in full.

## Requirements

### REQ-AI-001: Automatic Metadata Generation on Card Creation
- When a knowledge card is created, Express must automatically trigger AI metadata generation.
- AI metadata generation must be non-blocking — the card is saved and returned to the user before AI processing completes.
- The card's `aiStatus` is set to `PENDING` on creation, `COMPLETE` on success, and `FAILED` on failure.

### REQ-AI-002: AI-Generated Summary
- The AI service must produce a concise summary of the card's source text.
- The summary must be factual and derived from the source content.
- Summary length should be appropriate for display in a card list item (target: 2–4 sentences).

### REQ-AI-003: AI-Generated Subjects
- The AI service must return a list of broad subject labels (e.g., "Machine Learning", "Climate Science", "Personal Finance").
- Subject count: 1–5 labels per card.
- Subjects are used for filtering and browsing.

### REQ-AI-004: AI-Generated Keywords
- The AI service must return a list of specific keywords or phrases extracted from the content.
- Keyword count: 3–15 per card.
- Keywords are used for keyword search indexing.

### REQ-AI-005: Structured Response Validation
- Express must validate the AI service's JSON response against an expected schema before persisting.
- If the response is malformed or fails validation, the card is marked `aiStatus: FAILED` and original content is retained unchanged.

### REQ-AI-006: Graceful Failure
- If the FastAPI service is unreachable, returns an error, or times out, the card must remain saved with `aiStatus: FAILED`.
- AI failure must never cause the card creation to fail or roll back.
- The user must be able to see cards with `aiStatus: FAILED` and understand that AI cataloging did not complete.

### REQ-AI-007: User-Editable AI Metadata
- Users can edit the AI-generated summary, subjects, and keywords on any of their cards.
- User edits do not trigger AI re-generation.
- Edited values are persisted and displayed in place of the AI-generated originals.

### REQ-AI-008: Configurable AI Provider
- The AI provider (LLM and embedding model) must be configurable via environment variables.
- No specific provider must be hardcoded in the FastAPI service.
- Switching providers must require only environment variable changes, not code changes.

### REQ-AI-009: Embedding Generation
- In addition to summary/subjects/keywords, the AI service generates a vector embedding of the card's source text.
- The embedding is stored in the `embedding` column (pgvector) on the `KnowledgeCard` record.
- Embedding generation is separate from catalog metadata generation — either can fail independently.
- See the Semantic Search spec for embedding usage.

### REQ-AI-010: Prompt Injection Prevention
- Raw user-supplied text must not be inserted directly into privileged AI system prompts.
- User content must be clearly delimited and treated as data, not instructions, in all AI prompt construction.

## Out of Scope

- Manual AI re-cataloging triggered by the user (post-MVP).
- AI-generated card titles (post-MVP).
- AI-generated related card suggestions at creation time (handled by semantic search).
- Fine-tuning or training custom models.
