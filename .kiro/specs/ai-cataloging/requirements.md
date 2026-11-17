# AI Cataloging — Requirements

## Overview

AI cataloging automatically generates structured metadata for each knowledge card: a summary, a list of subjects, and a set of keywords. This metadata improves discoverability and gives users a quick understanding of their saved content without re-reading it in full.

## Implementation Status

| Aspect | Status |
|---|---|
| Product requirements (REQ-AI-001 to REQ-AI-014) | Confirmed and in scope, except REQ-AI-013 (optional). |
| Intended runtime AI provider (decision E-1) | **Meta Model API** (Muse family), chosen by the project owner. Muse Spark (`muse-spark-1.3`) for cataloging and text/image understanding; Muse Image (`muse-image-1.0`) for optional image generation and editing. Video generation is not in scope. |
| Embedding source | **UNRESOLVED (D-12).** Meta's published model catalog lists no embedding model, so the provider for embeddings is not established. Semantic search depends on it. |
| Provider facts | Several details are documented but unverified for this project (access, region, limits, pricing). See `design.md` ("Verification Checklist"). |
| Current implementation | None. `backend/fastapi/app.py` is empty, Express has no AI service, and no card or AI tables exist yet. |

The architecture stays provider-neutral where possible: provider-specific details live in the FastAPI adapters and configuration (REQ-AI-008). Unresolved items are listed in `design.md` ("Open decisions").

## Requirements

### REQ-AI-001: Automatic Metadata Generation on Card Creation
- When a knowledge card is created and a runtime AI integration is available, Express must automatically trigger AI catalog generation (summary, subjects, keywords) and embedding generation.
- This applies equally to cards created from pasted text and cards created from a URL. URL ingestion itself is separate from AI processing (see the URL Ingestion spec).
- AI processing must be non-blocking — the card is saved and returned to the user before AI processing completes.
- Catalog generation and embedding generation are tracked by two independent statuses (REQ-AI-011).
- While no runtime AI integration is available, cards are created normally and no AI processing is started (REQ-AI-012).

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
- If the response is malformed or fails validation, the catalog status is set to `FAILED` and original content is retained unchanged.
- Validation in Express applies even when the provider offers schema-constrained output.

### REQ-AI-006: Graceful Failure
- If the FastAPI service is unreachable, returns an error, or times out, the card must remain saved. The status of the affected operation (catalog generation or embedding generation) is set to `FAILED`. The status of the other operation is not changed by that failure.
- AI failure must never cause the card creation to fail or roll back.
- The user must be able to see which operation did not complete and understand that it failed, without losing access to any valid AI metadata produced by the other operation.

### REQ-AI-007: User-Editable AI Metadata
- Users can edit the AI-generated summary, subjects, and keywords on any of their cards.
- User edits do not trigger AI re-generation.
- Edited values are persisted and displayed in place of the AI-generated originals.
- AI-generated results must never overwrite user edits. (The mechanism that guarantees this is an open decision: D-3 in `design.md`.)
- The user can view and edit AI metadata whatever the card's AI statuses are.

### REQ-AI-008: Configurable AI Provider
- The AI provider (LLM and embedding model) must be configurable via environment variables.
- No specific provider or model identifier is hardcoded in FastAPI source code. The intended provider and model identifiers (Meta Model API; `muse-spark-1.3`, `muse-image-1.0`) are configuration values, not code constants.
- Provider-specific request and response handling is isolated in FastAPI adapters (`services/llm.py`, `services/embedder.py`) so that another provider can replace it with configuration and adapter changes only.
- Express never talks to the AI provider directly; it talks only to FastAPI.

### REQ-AI-009: Embedding Generation
- In addition to summary/subjects/keywords, the AI service generates a vector embedding of the card's source text.
- The embedding is stored in a pgvector column on the card's `knowledge_cards` row. The vector dimension is not yet decided (open decision D-6).
- Embedding generation is separate from catalog metadata generation — either can succeed or fail independently, and each has its own status (REQ-AI-011).
- The embedding source is unresolved (D-12): the intended provider's published model catalog lists no embedding model.
- See the Semantic Search spec for embedding usage.

### REQ-AI-010: Prompt Injection Prevention
- Raw user-supplied text must not be inserted directly into privileged AI system prompts.
- User content must be clearly delimited and treated as data, not instructions, in all AI prompt construction.

### REQ-AI-011: Independent Processing Statuses
- Each card has two independent AI processing statuses:
  - Catalog status: tracks generation of the summary, subjects and keywords.
  - Embedding status: tracks generation and availability of the vector embedding.
- Each status is one of `PENDING`, `COMPLETE`, `FAILED` or `NOT_AVAILABLE` (state set proposed; see D-8).
  - `PENDING`: the operation was requested and has not finished.
  - `COMPLETE`: the operation finished and its result was stored.
  - `FAILED`: the operation was attempted and no result was stored.
  - `NOT_AVAILABLE`: no runtime AI integration was available for the operation, so it was not attempted.
- The statuses do not constrain each other. Any combination is valid, for example catalog `COMPLETE` with embedding `FAILED`, or catalog `FAILED` with embedding `COMPLETE`.
- A status describes the AI operation, not whether data is present. AI metadata must be shown whenever it exists, whatever the statuses are (for example metadata entered by the user on a card whose catalog status is `FAILED` or `NOT_AVAILABLE`).
- The embedding status is `COMPLETE` only if an embedding is stored for the card. (Proposed invariant.)
- Image generation (REQ-AI-013) has no effect on either status.
- Acceptance criteria:
  - AC-AI-011-1: A failure of embedding generation leaves the catalog status and the stored summary, subjects and keywords unchanged.
  - AC-AI-011-2: A failure of catalog generation leaves the embedding status and any stored embedding unchanged.
  - AC-AI-011-3: A card whose catalog status is `FAILED` or `NOT_AVAILABLE` and that has user-entered metadata shows that metadata in the card detail.
  - AC-AI-011-4: Neither status becomes `COMPLETE` unless its result was stored.

### REQ-AI-012: Unavailable Runtime AI Integration
- While the runtime AI integration is not operational (not yet implemented, not configured, or not permitted in the deployment region), CardVault creates, edits, searches by keyword and deletes cards without AI processing.
- When Express determines that no runtime AI integration is available, both statuses of a new card are `NOT_AVAILABLE`. The UI must not describe this as a failure. (How Express determines this is open: D-9.)
- Whether `NOT_AVAILABLE` cards are processed later is an open decision (D-2).
- Acceptance criteria:
  - AC-AI-012-1: With no runtime AI integration available, creating a card succeeds, both statuses are `NOT_AVAILABLE`, and no outbound AI request is made.
  - AC-AI-012-2: The card detail does not say "failed" for a `NOT_AVAILABLE` status.

### REQ-AI-013: Optional AI Image Generation
- Status: OPTIONAL. This is not part of the core catalog and does not replace any core catalog function. It is not listed in the MVP scope of `product.md` and needs a product decision before implementation.
- A user may request an AI-generated image associated with a knowledge card, generated or edited by Muse Image through FastAPI.
- Image generation is independent of catalog and embedding generation. It does not change `ai_catalog_status` or `ai_embedding_status`, and its failure never affects the card.
- Generated images are AI-generated content. They never modify or replace the original source or personal notes, and they are clearly identified as AI-generated.
- The storage of generated images, and any status tracking for image requests, are open decisions (D-13). No new status model is defined here.
- Video generation is not part of this requirement or of CardVault's scope.

### REQ-AI-014: Content Handling with the AI Provider
- Card text and search queries reach the AI provider only from FastAPI, server-side. Provider credentials exist only in FastAPI's environment and are never exposed to Nuxt, never returned in Express responses, and never logged.
- Only provider modes that do not use submitted content to train models may be configured. With Meta Model API this means Standard-mode model identifiers; the Contributor-mode variants (documented as permitting training on content) must not be configured.
- Acceptance criteria:
  - AC-AI-014-1: FastAPI configuration validation rejects a model identifier that the provider designates as Contributor mode.
  - AC-AI-014-2: No provider credential appears in any Express or Nuxt response, log or client bundle.

## Out of Scope

- Manual AI re-cataloging triggered by the user (post-MVP).
- AI-generated card titles (post-MVP).
- AI-generated related card suggestions at creation time (handled by semantic search).
- Fine-tuning or training custom models.
- Video generation and video understanding.
