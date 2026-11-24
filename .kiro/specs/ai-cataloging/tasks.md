# AI Cataloging — Tasks

> **Status: NO TASK IS COMPLETE.** The hosted AI provider is Meta Model API (decision E-1). Provider facts are documented in `design.md` but not verified against a working account.
> **MVP vs future:** every task is MVP unless tagged `[FUTURE]` or `[OPTIONAL]`. No MVP task depends on a `[FUTURE]` task, on pgvector, or on any embedding work. The MVP is complete without them.
> Tags: `[READY]` can start now. `[READY AFTER V-n / TASK-…]` can start once the named verification item or task is done. `[BLOCKED: …]` waits for the named decision. `[FUTURE]` belongs to the Semantic Retrieval milestone. `[OPTIONAL]` is outside the core scope. `[INDEPENDENT]` does not depend on the AI provider.
> Verification items V-1 to V-12 and decisions D-1 to D-14 are defined in `design.md`.

## MVP completion criteria

The MVP AI work is complete when all of the following hold:
- TASK-AI-020, 001, 002, 003, 005, 007, 008, 010, 011, 012, 022 (FastAPI catalog service), TASK-AI-013, 014, 015 (Express) and TASK-AI-016, 017, 018, 019 (frontend and status handling) are done.
- Creating a card returns without waiting for catalog generation, and a failed or unavailable catalog generation never fails card creation.
- A card gets catalog metadata from Muse Spark and `ai_catalog_status` follows `PENDING` to `COMPLETE` or `FAILED`; with generation not enabled the status is `NOT_AVAILABLE` and no outbound request is made.
- `ai_embedding_status` is `NOT_AVAILABLE` for every card, no embedding request is made, and no card is marked `FAILED` because embeddings are deferred.
- Keyword search works with no embeddings, no pgvector and no FastAPI running.

## Verification (no code)

- [ ] **[READY]** **TASK-AI-020** Work through the MVP items of the Verification Checklist in `design.md` (V-1 to V-5, V-7 to V-9, V-11, V-12; V-10 only if images are pursued) against a real Meta Model API account, and record the results in `design.md`. Create a project-specific API key; do not reuse files or keys from another project.

## FastAPI Backend (MVP)

- [ ] **[READY AFTER V-2]** **TASK-AI-001** Create `backend/fastapi/requirements.txt` — add `fastapi`, `uvicorn`, `pydantic`, `pydantic-settings`, and the HTTP client or SDK chosen in V-2. No embedding or inference libraries.
- [ ] **[READY AFTER V-2]** **TASK-AI-002** Create `backend/fastapi/core/config.py` — `Settings` class using `pydantic-settings`. Provider credential, base URL, text model identifier and timeouts come from environment variables; setting names are provisional (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_SECONDS`). Embedding settings are not part of the MVP.
- [ ] **[READY]** **TASK-AI-003** Create `backend/fastapi/models/catalog.py` — `CatalogRequest` and `CatalogResponse` Pydantic models.
- [ ] **[READY AFTER V-2, V-4]** **TASK-AI-005** Create `backend/fastapi/services/llm.py` — LLM client adapter for Muse Spark; reads provider settings from config; implements `generate_catalog(text: str) -> CatalogResponse`. Provider-specific code stays in this adapter.
- [ ] **[READY AFTER V-4]** **TASK-AI-007** Implement prompt construction in `llm.py` — wrap user content in `<content>` delimiters to prevent prompt injection; use the provider's schema-constrained output; parse and validate the JSON response.
- [ ] **[READY AFTER TASK-AI-005]** **TASK-AI-008** Create `backend/fastapi/routers/catalog.py` — `POST /catalog` endpoint using `CatalogRequest` / `CatalogResponse`; call `llm.generate_catalog`.
- [ ] **[READY AFTER TASK-AI-002]** **TASK-AI-010** Create `backend/fastapi/routers/health.py` — `GET /health` endpoint returning status and configured provider name.
- [ ] **[READY; CORS and authentication wording depends on D-5]** **TASK-AI-011** Update `backend/fastapi/app.py` — create FastAPI app instance, include the catalog and health routers, configure CORS to allow Express backend origin only. The embeddings router is not included until the future milestone.
- [ ] **[READY AFTER V-2]** **TASK-AI-012** Create `backend/fastapi/.env.example` documenting the provider settings (placeholders only, no real values) and `FASTAPI_PORT`. Names provisional.
- [ ] **[READY AFTER TASK-AI-002]** **TASK-AI-022** Add configuration validation in `core/config.py` that rejects Contributor-mode model identifiers (REQ-AI-014).

## Express Backend (MVP)

- [ ] **[READY AFTER TASK-AI-008; timeout value D-1]** **TASK-AI-013** Create `src/services/aiService.ts` — implement `catalogCard(cardId, text)`; use `FASTAPI_URL` from env (added to `src/lib/config.ts` and `.env.example`); return `null` on any failure; apply request timeout. `embedCard` is not part of this task (see TASK-AI-023).
- [ ] **[READY]** **TASK-AI-014** Add Zod schema for validating the FastAPI catalog response in `src/schemas/ai.schemas.ts`.
- [ ] **[BLOCKED in part: D-1, D-3; depends on TASK-CAT-007, TASK-AI-013]** **TASK-AI-015** Update `src/services/cardService.ts` — when catalog generation is enabled, start `aiService.catalogCard` after the insert without making `createCard` wait; update `ai_catalog_status` from the outcome. Do not start any embedding operation.

## Frontend (MVP)

- [ ] **[INDEPENDENT]** **TASK-AI-016** Create `app/components/ai/AiMetadataEditor.vue` (beside the existing read-only `AiMetadata.vue`) — show a status indicator per operation: a "Processing…" state for `PENDING`, a failure notice for `FAILED`, and neutral wording for `NOT_AVAILABLE`. Always show metadata that exists, whatever the statuses are.
- [ ] **[READY AFTER TASK-AI-015; limit D-1]** **TASK-AI-017** Update `app/pages/catalog/[id].vue` — poll `GET /api/cards/:id` every 3 seconds while either status is `PENDING`, stop when neither is `PENDING`.

## Status Model and Unavailable-Operation Handling (MVP, independent of the AI provider)

- [x] **[INDEPENDENT; D-8, D-9 resolved]** **TASK-AI-018** In `cardService.createCard`, set `ai_embedding_status` to `NOT_AVAILABLE` for every card. Set `ai_catalog_status` to `PENDING` when catalog generation is enabled and to `NOT_AVAILABLE` when it is not implemented or not enabled; make no AI call in the latter case. Depends on TASK-CAT-002 and TASK-CAT-007.
- [x] **[INDEPENDENT; D-8 resolved]** **TASK-AI-019** Update the frontend types and components that use a single `aiStatus` (`types/card.ts`, `components/ai/AiProcessingStatus.vue`, `components/ai/AiMetadata.vue`, `components/catalog/KnowledgeCard.vue`, `pages/catalog/[id].vue`) to use the two statuses and to show metadata whenever it exists.

## Future Milestone: Semantic Retrieval (not an MVP prerequisite)

- [ ] **[FUTURE; needs D-7, D-12]** **TASK-AI-004** Create `backend/fastapi/models/embeddings.py` — `EmbeddingRequest` and `EmbeddingResponse` Pydantic models.
- [ ] **[FUTURE; needs D-12]** **TASK-AI-006** Create `backend/fastapi/services/embedder.py` — embedding generation in FastAPI (local inference is the preferred direction; no model or runtime is selected); implements `generate_embedding(text: str) -> list[float]`.
- [ ] **[FUTURE; needs D-12]** **TASK-AI-009** Create `backend/fastapi/routers/embeddings.py` — `POST /embeddings` endpoint; call `embedder.generate_embedding`; include it in `app.py`.
- [ ] **[FUTURE; needs D-6, D-7, D-12; depends on TASK-CAT-001, TASK-CAT-024, TASK-AI-009]** **TASK-AI-023** Add `embedCard(cardId, text)` to `src/services/aiService.ts`, an embedding response schema in `src/schemas/ai.schemas.ts` (including dimension checks), and an independent embedding operation started after the card insert in `cardService.ts`. It updates only `embedding` and `ai_embedding_status`, and never delays card creation.

## Optional Image Generation (not core; needs a product decision)

- [ ] **[OPTIONAL; BLOCKED: D-13, V-10]** **TASK-AI-021** Design and implement optional image generation and editing with Muse Image (REQ-AI-013): FastAPI image adapter and endpoints, Express endpoints, storage of generated images, and the UI. Not designed yet. Video generation is out of scope.
