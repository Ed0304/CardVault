# AI Cataloging — Requirements

## Overview

AI cataloging automatically generates structured metadata for each knowledge card: a summary, a list of subjects, and a set of keywords. This metadata improves discoverability and gives users a quick understanding of their saved content without re-reading it in full.

AI cataloging is independent of embedding generation. The MVP includes cataloging only. Embedding generation belongs to the future Semantic Retrieval milestone (REQ-AI-009).

## Scope: MVP and Future Milestone

| Requirement | Scope |
|---|---|
| REQ-AI-001 to REQ-AI-008, REQ-AI-010 to REQ-AI-012, REQ-AI-014 to REQ-AI-018 | **MVP** |
| REQ-AI-009 Embedding generation | **Future: Semantic Retrieval milestone** (preserved, not an MVP prerequisite) |
| REQ-AI-013 Optional image generation | **Optional**, outside the MVP |

## Implementation Status

| Aspect | Status |
|---|---|
| Hosted AI provider (decision E-1) | **Meta Model API** (Muse family), chosen by the project owner. **Muse Ember** (`muse-ember-1.0`, Standard mode, low reasoning effort) generates the catalog metadata; `muse-spark-1.3` is the configurable quality fallback. Muse Wonder is not used. Muse Image (`muse-image-1.0`) is for optional image generation, not pursued. No second hosted AI provider is introduced. Video generation is not in scope. |
| Embeddings | **Deferred (D-12), future milestone.** FastAPI is expected to generate embeddings; local inference is the preferred direction. No embedding model or runtime is selected. It is not an MVP prerequisite. |
| pgvector | Future milestone only. Not an MVP prerequisite. |
| Provider facts | Several details are documented but unverified for this project (access, region, limits, pricing). See `design.md` ("Verification Checklist"). |
| Current implementation | Owner-requested catalog generation: FastAPI `POST /catalog` (Muse adapter), Express `POST /api/cards/:id/catalog` with drafts, review UI, and vault keyword search. Tested with a fake provider and a fake AI service; not yet run against a live Meta account (no key exists). |

The MVP is functional without any AI result: card creation, notes, collections, tags and PostgreSQL keyword search all work without cataloging or embeddings. Provider-specific details live in the FastAPI adapters and configuration (REQ-AI-008). Unresolved items are listed in `design.md` ("Open decisions").

## Requirements

### REQ-AI-001: Owner-Requested Catalog Generation
- **Changed in the Muse integration milestone:** catalog generation is requested by the card's owner from the card page, not started automatically on creation. Automatic generation is a future option (D-15).
- Only the card's owner can request it. The request runs while the owner waits and returns the card with Muse's suggestions as a draft (REQ-AI-007).
- Card creation never waits for or depends on catalog generation, and works whether or not AI is configured.
- A card with no source text (for example a saved community copy whose author did not share the text) cannot be cataloged: 422 `NOTHING_TO_CATALOG`, and no AI call is made.
- One request runs per card at a time (409 `CATALOG_IN_PROGRESS`).
- Catalog generation does not depend on embedding generation, and embedding generation does not depend on catalog generation.
- Catalog generation and embedding generation are tracked by two independent statuses (REQ-AI-011).
- In the MVP, no embedding generation is triggered (REQ-AI-009).
- When catalog generation is not configured, the request returns 503 `AI_NOT_AVAILABLE`, no AI call is made, and nothing changes (REQ-AI-012).
- Acceptance criteria:
  - AC-AI-001-1: A successful request sets `ai_catalog_status` to `COMPLETE` and stores a draft, and leaves `ai_summary`, `ai_subjects` and `ai_keywords` unchanged.
  - AC-AI-001-2: Another user's request for the card returns 404 and makes no AI call.
  - AC-AI-001-3: Two simultaneous requests for one card produce one AI call; the other gets 409.

### REQ-AI-002: Catalog Description
- The AI service must produce a concise, original catalog description of the card's subject: 1–3 sentences, at most about 60 words.
- It states what the subject is, why it is significant, and its one or two most defining characteristics. It leaves out trivia, minor dates, lists and plot detail.
- It is written in the model's own words and does not follow the source's structure (REQ-AI-018). It uses only information in the source.

### REQ-AI-003: Library-Style Subject Headings
- The AI service must return 2–5 specific subject headings (1 is accepted), most specific first, that name the card's actual topic, narrowed to it (for example "Impressionist painting" rather than "Art").
- Broad categories ("Science", "Popular culture", "Video games") are avoided on their own. When one of the owner's existing headings fits precisely, it is reused exactly.
- Headings are used for filtering, browsing and search, and are editable by the owner.

### REQ-AI-004: AI-Generated Keywords
- The AI service must return 3–12 specific search terms (at most 15 are accepted): names, concepts, methods, places or works central to the source.
- Keywords do not repeat the catalog title or a subject heading (removed when other keywords remain).
- Keywords are used for keyword search.

### REQ-AI-005: Structured Response Validation
- Express must validate the AI service's JSON response against an expected schema before persisting.
- If the response is malformed or fails validation, the catalog status is set to `FAILED` and original content is retained unchanged.
- Validation in Express applies even when the provider offers schema-constrained output.

### REQ-AI-006: Graceful Failure
- If the FastAPI service is unreachable, returns an error, or times out, the card must remain saved. The status of the affected operation (catalog generation, or embedding generation in the future milestone) is set to `FAILED`. The status of the other operation is not changed by that failure.
- AI failure must never cause the card creation to fail or roll back.
- The user must be able to see which operation did not complete and understand that it failed, without losing access to any valid AI metadata produced by the other operation.
- An operation that is not implemented or not enabled is not a failure; its status is `NOT_AVAILABLE` (REQ-AI-011).

### REQ-AI-007: User-Editable AI Metadata
- Users can edit the AI-generated summary, subjects, and keywords on any of their cards.
- User edits do not trigger AI re-generation.
- Edited values are persisted and displayed in place of the AI-generated originals.
- AI-generated results must never overwrite user edits. **Mechanism (D-3, resolved):** Muse's results are stored only as a draft (`ai_catalog_draft`). The draft is labelled as AI-generated, with the model that wrote it. The catalog fields change only when the owner saves (accepting the draft as it is or edited), and saving clears the draft. The owner can also discard it.
- The user can view and edit AI metadata whatever the card's AI statuses are.
- Acceptance criteria:
  - AC-AI-007-1: A card with existing catalog details keeps them unchanged after a successful catalog request.
  - AC-AI-007-2: Saving catalog details clears the draft; discarding the draft leaves the catalog details unchanged.

### REQ-AI-008: Configurable AI Provider
- The AI provider and model for catalog generation must be configurable via environment variables.
- No specific provider or model identifier is hardcoded in FastAPI source code. The provider base URL and model identifier (`MODEL_API_BASE_URL`, `MUSE_CATALOG_MODEL`, intended value `muse-ember-1.0`) are required configuration values, not code constants.
- Provider-specific request and response handling is isolated in FastAPI adapters (`services/llm.py`) so that another provider can replace it with configuration and adapter changes only.
- Express never talks to the AI provider directly; it talks only to FastAPI.
- No second hosted AI provider is introduced. The embedding model and runtime (future milestone) are not selected here.

### REQ-AI-009: Embedding Generation (Future: Semantic Retrieval milestone)
- Status: **future milestone.** Preserved here; not an MVP prerequisite. No MVP requirement or task depends on it.
- FastAPI generates a vector embedding of the card's source text. Local inference is the preferred direction. The embedding provider, model and runtime are deferred (D-12).
- Express owns the database operations: it stores the embedding in a pgvector column on the card's `knowledge_cards` row and runs the PostgreSQL similarity queries. FastAPI does not access PostgreSQL.
- The vector dimension is not yet decided (D-6).
- Embedding generation is separate from catalog generation. Either can succeed or fail independently, and each has its own status (REQ-AI-011). Card creation does not wait for embedding generation.
- Embeddings are generated by FastAPI; no second hosted AI provider is used.
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
  - `NOT_AVAILABLE`: the operation is not implemented or not enabled, so it was not attempted. This is not a processing failure.
- The statuses do not constrain each other. Any combination is valid, for example catalog `COMPLETE` with embedding `NOT_AVAILABLE`, or (in the future milestone) catalog `FAILED` with embedding `COMPLETE`.
- In the MVP the embedding status is `NOT_AVAILABLE` for every card, because embedding generation is not implemented. It is never `FAILED` for that reason.
- A status describes the AI operation, not whether data is present. AI metadata must be shown whenever it exists, whatever the statuses are (for example metadata entered by the user on a card whose catalog status is `FAILED` or `NOT_AVAILABLE`).
- Future milestone: the embedding status is `COMPLETE` only if an embedding is stored for the card. (Proposed invariant.)
- Image generation (REQ-AI-013) has no effect on either status.
- Acceptance criteria:
  - AC-AI-011-1: A failure of embedding generation (future milestone) leaves the catalog status and the stored summary, subjects and keywords unchanged.
  - AC-AI-011-2: A failure of catalog generation leaves the embedding status and any stored embedding unchanged.
  - AC-AI-011-3: A card whose catalog status is `FAILED` or `NOT_AVAILABLE` and that has user-entered metadata shows that metadata in the card detail.
  - AC-AI-011-4: Neither status becomes `COMPLETE` unless its result was stored.
  - AC-AI-011-5: In the MVP every new card has embedding status `NOT_AVAILABLE`, whether or not catalog generation is enabled, and no card is marked `FAILED` because embeddings are deferred.

### REQ-AI-012: Operations Not Implemented or Not Enabled
- While catalog generation is not implemented, not configured, or not permitted in the deployment region, CardVault creates, edits, searches by keyword and deletes cards without AI processing.
- When Express determines that catalog generation is not available, the catalog status of a new card is `NOT_AVAILABLE`. The UI must not describe this as a failure. (How Express determines this is open: D-9.)
- In the MVP the embedding status of a new card is `NOT_AVAILABLE` regardless of the catalog setting.
- Whether `NOT_AVAILABLE` cards are processed later is an open decision (D-2).
- Acceptance criteria:
  - AC-AI-012-1: With catalog generation not available, creating a card succeeds, both statuses are `NOT_AVAILABLE`, and no outbound AI request is made.
  - AC-AI-012-2: The card detail does not say "failed" for a `NOT_AVAILABLE` status.
  - AC-AI-012-3: With catalog generation enabled, creating a card makes no embedding request, and the embedding status stays `NOT_AVAILABLE`.
  - AC-AI-012-4: Creating a card returns without waiting for catalog generation or embedding generation.

### REQ-AI-013: Optional AI Image Generation
- Status: OPTIONAL. This is not part of the core catalog and does not replace any core catalog function. It is not listed in the MVP scope of `product.md` and needs a product decision before implementation.
- A user may request an AI-generated image associated with a knowledge card, generated or edited by Muse Image through FastAPI. This uses the same hosted provider as cataloging; no second hosted AI provider is introduced.
- Image generation is independent of catalog and embedding generation. It does not change `ai_catalog_status` or `ai_embedding_status`, and its failure never affects the card.
- Generated images are AI-generated content. They never modify or replace the original source or personal notes, and they are clearly identified as AI-generated.
- The storage of generated images, and any status tracking for image requests, are open decisions (D-13). No new status model is defined here.
- Video generation is not part of this requirement or of CardVault's scope.

### REQ-AI-014: Content Handling with the AI Provider
- Card text reaches the hosted AI provider only from FastAPI, server-side. Provider credentials exist only in FastAPI's environment and are never exposed to Nuxt, never returned in Express responses, and never logged.
- Only provider modes that do not use submitted content to train models may be configured. With Meta Model API this means Standard-mode model identifiers; the Contributor-mode variants (documented as permitting training on content) must not be configured.
- Acceptance criteria:
  - AC-AI-014-1: FastAPI configuration validation rejects a model identifier that the provider designates as Contributor mode.
  - AC-AI-014-2: No provider credential appears in any Express or Nuxt response, log or client bundle.

### REQ-AI-017: Structured Catalog Entry
- Besides the description, headings and keywords, the AI service returns:
  - **title:** the name of the entry's central subject as a catalog heading (for example "Marie Curie"), without site names or taglines; at most 200 characters. When the model gives none, the source title without a trailing " - Site" part is used; when there is no source title either, it is empty and the card keeps showing its source title.
  - **facts:** up to 8 `{label, value}` pairs that the source states plainly (label ≤ 60, value ≤ 200 characters). Labels are free-text attribute names suited to the subject ("Author", "First published", "Type"). There are no domain-specific fields.
  - **related:** up to 8 `{name, relation}` pairs for concepts the source explicitly connects to the subject (name ≤ 100, relation ≤ 60 characters), with a short relation label ("Successor", "Created by").
- Every field may be empty except the description, headings and keywords. The model is told to leave a field out rather than guess.
- **Grounding checks (FastAPI):** a related concept is kept only if its name appears in the text the model was given; a fact is kept only if its value shares a significant word (3+ letters or a number) with that text; the subject itself, duplicates (case-insensitive), blanks and over-long items are dropped.
- The owner can edit all of it, including the title. An empty title returns to the source title.
- Acceptance criteria:
  - AC-AI-017-1: A related concept not named in the source is not returned.
  - AC-AI-017-2: A fact whose value has no significant word in the source is not returned.
  - AC-AI-017-3: An answer without the new fields (an older shape) is still accepted, with empty facts and related concepts.

### REQ-AI-018: Original, Copyright-Safe Catalog Text
- Catalog text is written in the model's own words. The prompt forbids copying sentences or distinctive phrases and following the source's structure.
- **Copy check (FastAPI):** a description that repeats 12 or more consecutive words of the source is rejected as invalid output (502; the card is unchanged and the owner can retry).
- The source text stays in the card's source layer and is published only when the owner explicitly shares it (REQ-CAT-011). The public catalog entry is the owner-reviewed description, facts, headings, keywords and related concepts, plus the source's title and link as attribution.
- Acceptance criteria:
  - AC-AI-018-1: A description containing 12 consecutive source words is rejected; one sharing 11 is accepted.
  - AC-AI-018-2: A published card without shared source text exposes no source text, notes or draft through public endpoints.

### REQ-AI-015: Draft Privacy and Publication Consent
- A draft is visible only to the card's owner. It never appears in Community Catalog responses, and saved copies never take it.
- AI output never reaches a published card on its own. A published card's public summary, subjects and keywords change only when the owner saves catalog details, and the UI warns that saved details will appear publicly.
- What is sent to the AI service: the card's title, its source text (cut to `CATALOG_MAX_INPUT_CHARS`), and the owner's own existing subject headings. Personal notes, collections, tags, other users' data and account details are never sent.
- Acceptance criteria:
  - AC-AI-015-1: After a catalog request on a published card, the public card detail is unchanged and contains no draft.
  - AC-AI-015-2: The AI service request body contains exactly `title`, `text` and `existing_subjects`, and no notes.

### REQ-AI-016: Abuse and Cost Protection
- Each user may make at most `AI_CATALOG_HOURLY_LIMIT` (default 20) catalog requests per hour; beyond that, 429 `AI_RATE_LIMITED` with `Retry-After`.
- Every call to the AI service has a timeout (`AI_SERVICE_TIMEOUT_MS`), and every provider attempt has one (`MUSE_TIMEOUT_SECONDS`). Transient provider errors are retried at most `MUSE_MAX_RETRIES` times.
- A temporary failure returns 503 `AI_UNAVAILABLE` with `Retry-After`; any other failure returns 502 `AI_CATALOG_FAILED`. Both set the catalog status to `FAILED` and change nothing else.
- The AI service accepts requests only with the shared service token.

## Out of Scope

- Automatic cataloging on card creation (future, D-15).
- AI-generated card titles (post-MVP).
- AI-generated related card suggestions at creation time (handled by semantic search, future milestone).
- Fine-tuning or training custom models.
- Video generation and video understanding.
