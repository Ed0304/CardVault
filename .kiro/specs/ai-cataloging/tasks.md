# AI Cataloging — Tasks

## FastAPI Backend

- [ ] **TASK-AI-001** Create `backend/fastapi/requirements.txt` — add `fastapi`, `uvicorn`, `pydantic`, `pydantic-settings`, and the chosen AI provider SDK (e.g., `openai`).
- [ ] **TASK-AI-002** Create `backend/fastapi/core/config.py` — `Settings` class using `pydantic-settings`, loading `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_EMBEDDING_MODEL`, `AI_TIMEOUT_SECONDS` from environment.
- [ ] **TASK-AI-003** Create `backend/fastapi/models/catalog.py` — `CatalogRequest` and `CatalogResponse` Pydantic models.
- [ ] **TASK-AI-004** Create `backend/fastapi/models/embeddings.py` — `EmbeddingRequest` and `EmbeddingResponse` Pydantic models.
- [ ] **TASK-AI-005** Create `backend/fastapi/services/llm.py` — provider-agnostic LLM client; reads provider from config; implements `generate_catalog(text: str) -> CatalogResponse`.
- [ ] **TASK-AI-006** Create `backend/fastapi/services/embedder.py` — provider-agnostic embedding client; implements `generate_embedding(text: str) -> list[float]`.
- [ ] **TASK-AI-007** Implement prompt construction in `llm.py` — wrap user content in `<content>` delimiters to prevent prompt injection; parse and validate JSON response.
- [ ] **TASK-AI-008** Create `backend/fastapi/routers/catalog.py` — `POST /catalog` endpoint using `CatalogRequest` / `CatalogResponse`; call `llm.generate_catalog`.
- [ ] **TASK-AI-009** Create `backend/fastapi/routers/embeddings.py` — `POST /embeddings` endpoint; call `embedder.generate_embedding`.
- [ ] **TASK-AI-010** Create `backend/fastapi/routers/health.py` — `GET /health` endpoint returning status and configured provider name.
- [ ] **TASK-AI-011** Update `backend/fastapi/app.py` — create FastAPI app instance, include all routers, configure CORS to allow Express backend origin only.
- [ ] **TASK-AI-012** Create `backend/fastapi/.env.example` documenting `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_EMBEDDING_MODEL`, `FASTAPI_PORT`.

## Express Backend

- [ ] **TASK-AI-013** Create `src/services/aiService.ts` — implement `catalogCard(cardId, text)` and `embedCard(cardId, text)`; use `FASTAPI_URL` from env; return `null` on any failure; apply request timeout.
- [ ] **TASK-AI-014** Add Zod schema for validating FastAPI catalog response in `src/schemas/ai.ts`.
- [ ] **TASK-AI-015** Update `src/services/cardService.ts` — after inserting a card, fire-and-forget async calls to `aiService.catalogCard` and `aiService.embedCard`; update `aiStatus` based on outcome.

## Frontend

- [ ] **TASK-AI-016** Update `app/components/card/AiMetadataEditor.vue` — show a "Processing…" state when `aiStatus === 'PENDING'` and a "AI cataloging failed" notice when `aiStatus === 'FAILED'`.
- [ ] **TASK-AI-017** Update `app/pages/cards/[id].vue` — poll `GET /api/cards/:id` every 3 seconds while `aiStatus === 'PENDING'`, stop polling when status changes.
