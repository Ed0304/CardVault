# AI Cataloging — Tasks

> **Status: NO TASK IS COMPLETE.** The intended runtime AI provider is Meta Model API (decision E-1). Provider facts are documented in `design.md` but not verified against a working account.
> Tags: `[READY]` can start now. `[READY AFTER V-n / TASK-…]` can start once the named verification item or task is done. `[BLOCKED: …]` cannot start until the named decision is resolved. `[OPTIONAL]` is outside the core scope. `[INDEPENDENT]` does not depend on the AI provider.
> Verification items V-1 to V-12 and decisions D-1 to D-13 are defined in `design.md`.

## Verification (no code)

- [ ] **[READY]** **TASK-AI-020** Work through the Verification Checklist in `design.md` (V-1 to V-12) against a real Meta Model API account, and record the results in `design.md`. Create a project-specific API key; do not reuse files or keys from another project.

## FastAPI Backend

- [ ] **[READY AFTER V-2]** **TASK-AI-001** Create `backend/fastapi/requirements.txt` — add `fastapi`, `uvicorn`, `pydantic`, `pydantic-settings`, and the HTTP client or SDK chosen in V-2.
- [ ] **[READY AFTER V-2]** **TASK-AI-002** Create `backend/fastapi/core/config.py` — `Settings` class using `pydantic-settings`. Provider credential, base URL, text model identifier, image model identifier and timeouts come from environment variables; setting names are provisional (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_EMBEDDING_MODEL`, `AI_TIMEOUT_SECONDS`).
- [ ] **[READY]** **TASK-AI-003** Create `backend/fastapi/models/catalog.py` — `CatalogRequest` and `CatalogResponse` Pydantic models.
- [ ] **[BLOCKED: D-12, D-7]** **TASK-AI-004** Create `backend/fastapi/models/embeddings.py` — `EmbeddingRequest` and `EmbeddingResponse` Pydantic models.
- [ ] **[READY AFTER V-2, V-4]** **TASK-AI-005** Create `backend/fastapi/services/llm.py` — LLM client adapter for Muse Spark; reads provider settings from config; implements `generate_catalog(text: str) -> CatalogResponse`. Provider-specific code stays in this adapter.
- [ ] **[BLOCKED: D-12]** **TASK-AI-006** Create `backend/fastapi/services/embedder.py` — embedding client adapter; implements `generate_embedding(text: str) -> list[float]`.
- [ ] **[READY AFTER V-4]** **TASK-AI-007** Implement prompt construction in `llm.py` — wrap user content in `<content>` delimiters to prevent prompt injection; use the provider's schema-constrained output; parse and validate the JSON response.
- [ ] **[READY AFTER TASK-AI-005]** **TASK-AI-008** Create `backend/fastapi/routers/catalog.py` — `POST /catalog` endpoint using `CatalogRequest` / `CatalogResponse`; call `llm.generate_catalog`.
- [ ] **[BLOCKED: D-12]** **TASK-AI-009** Create `backend/fastapi/routers/embeddings.py` — `POST /embeddings` endpoint; call `embedder.generate_embedding`.
- [ ] **[READY AFTER TASK-AI-002]** **TASK-AI-010** Create `backend/fastapi/routers/health.py` — `GET /health` endpoint returning status and configured provider name.
- [ ] **[READY; CORS and authentication wording depends on D-5]** **TASK-AI-011** Update `backend/fastapi/app.py` — create FastAPI app instance, include all routers, configure CORS to allow Express backend origin only.
- [ ] **[READY AFTER V-2]** **TASK-AI-012** Create `backend/fastapi/.env.example` documenting the provider settings (placeholders only, no real values) and `FASTAPI_PORT`. Names provisional.
- [ ] **[READY AFTER TASK-AI-002]** **TASK-AI-022** Add configuration validation in `core/config.py` that rejects Contributor-mode model identifiers (REQ-AI-014).

## Express Backend

- [ ] **[READY AFTER TASK-AI-008 for `catalogCard`; BLOCKED: D-12 for `embedCard`; timeout value D-1]** **TASK-AI-013** Create `src/services/aiService.ts` — implement `catalogCard(cardId, text)` and `embedCard(cardId, text)`; use `FASTAPI_URL` from env (added to `src/lib/config.ts` and `.env.example`); return `null` on any failure; apply request timeout.
- [ ] **[READY]** **TASK-AI-014** Add Zod schema for validating the FastAPI catalog response in `src/schemas/ai.schemas.ts`. (The embedding response schema is blocked on D-12 and D-7.)
- [ ] **[BLOCKED in part: D-1, D-3; depends on TASK-CAT-007, TASK-AI-013]** **TASK-AI-015** Update `src/services/cardService.ts` — when a runtime AI integration is available, start `aiService.catalogCard` and `aiService.embedCard` as two independent operations after the insert; update `ai_catalog_status` and `ai_embedding_status` independently based on each outcome.

## Frontend

- [ ] **[INDEPENDENT]** **TASK-AI-016** Create `app/components/ai/AiMetadataEditor.vue` (beside the existing read-only `AiMetadata.vue`) — show one status indicator per operation: a "Processing…" state for `PENDING`, a failure notice for `FAILED`, and neutral wording for `NOT_AVAILABLE`. Always show metadata that exists, whatever the statuses are.
- [ ] **[READY AFTER TASK-AI-015; limit D-1]** **TASK-AI-017** Update `app/pages/catalog/[id].vue` — poll `GET /api/cards/:id` every 3 seconds while either status is `PENDING`, stop when neither is `PENDING`.

## Status Model and Unavailable-Integration Handling (independent of the AI provider)

- [ ] **[INDEPENDENT; needs D-8, D-9]** **TASK-AI-018** In `cardService.createCard`, set `ai_catalog_status` and `ai_embedding_status` to `NOT_AVAILABLE` and make no AI call while no runtime AI integration is available. Depends on TASK-CAT-002 and TASK-CAT-007.
- [ ] **[INDEPENDENT; needs D-8]** **TASK-AI-019** Update the frontend types and components that use a single `aiStatus` (`types/card.ts`, `components/ai/AiProcessingStatus.vue`, `components/ai/AiMetadata.vue`, `components/catalog/KnowledgeCard.vue`, `pages/catalog/[id].vue`) to use the two statuses and to show metadata whenever it exists.

## Optional Image Generation (not core; needs a product decision)

- [ ] **[OPTIONAL; BLOCKED: D-13, V-10]** **TASK-AI-021** Design and implement optional image generation and editing with Muse Image (REQ-AI-013): FastAPI image adapter and endpoints, Express endpoints, storage of generated images, and the UI. Not designed yet. Video generation is out of scope.
