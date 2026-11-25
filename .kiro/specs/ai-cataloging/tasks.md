# AI Cataloging — Tasks

> **Milestone: Muse integration (owner-requested cataloging).** Verification for ticked tasks: `backend/fastapi` pytest (36 tests, fake provider), `backend/expressjs` Jest (143 tests, 29 for cataloging, isolated `cardvault_test` database and a fake AI service), backend typecheck, the frontend production build, and an end-to-end run through the Nuxt proxy, Express, FastAPI and the real `api.meta.ai` endpoint with an invalid key (rejected with 401, handled as `FAILED`).
> **Not yet verified:** a successful call to Meta Model API. No project API key exists. See TASK-AI-020.
> Tags: `[FUTURE]` belongs to the Semantic Retrieval milestone. `[OPTIONAL]` is outside the core scope. V-n and D-n are defined in `design.md`.

## MVP completion criteria

- An owner can request cataloging of a card, receive Muse's summary, subjects and keywords as a labelled draft, edit them, and save them to the card, or discard them.
- AI output never changes a card's catalog details, or a published card, without the owner's save.
- Failures, timeouts, bad output and missing configuration leave the card unchanged and set the status the user sees.
- Saved details make cards findable through vault keyword search (and community search, when published).
- `ai_embedding_status` stays `NOT_AVAILABLE`; no embedding request is made.

## Verification

- [ ] **TASK-AI-020** Create a project-specific Meta Model API key from the developer's location (do not reuse another project's key), then:
  - Run `GET /v1/models` and confirm `muse-ember-1.0` is listed (V-3).
  - Make one real catalog request and confirm the structured output is accepted with `strict: true` (V-4).
  - Record real latency and token counts from the FastAPI log (V-11, V-7).
  - Check the subject headings on 5–10 real cards. If they are weak, switch `MUSE_CATALOG_MODEL` to `muse-spark-1.3`.
- [x] **TASK-AI-024** Research the current Muse models, structured output, reasoning effort, pricing, limits, errors, data handling, availability and hackathon rules in official sources, and record them in `design.md`.

## FastAPI Backend

- [x] **TASK-AI-001** `backend/fastapi/requirements.txt` (pinned: fastapi, uvicorn, pydantic, pydantic-settings, openai) and `requirements-dev.txt` (pytest, httpx).
- [x] **TASK-AI-002** `core/config.py` — settings from the environment only. Fails fast on missing values; https-only base URL; service token at least 32 characters; secrets never in `repr`.
- [x] **TASK-AI-022** Configuration rejects Contributor-mode model ids (REQ-AI-014).
- [x] **TASK-AI-003** `models/catalog.py` — `CatalogRequest` (title, text, existing subject headings; unknown fields forbidden) and `CatalogResponse`.
- [x] **TASK-AI-005** `services/llm.py` — Muse adapter (OpenAI SDK, Chat Completions, `json_schema` strict, reasoning effort from config, timeout and retries). Classifies provider errors into unavailable, rejected and invalid output.
- [x] **TASK-AI-007** Prompt construction with delimited user content and neutralised delimiter tags; input truncation; output normalisation and validation.
- [x] **TASK-AI-008** `routers/catalog.py` — `POST /catalog` behind the service token; stable error codes only.
- [x] **TASK-AI-010** `routers/health.py` — `GET /health`, no provider call.
- [x] **TASK-AI-011** `app.py` — app, lifespan (fail-fast settings, one shared client), routers; no CORS and no interactive docs (internal service).
- [x] **TASK-AI-012** `backend/fastapi/.env.example` and `.gitignore`.
- [x] **TASK-AI-025** `tests/test_catalog.py` — success, request shape, prompt-injection delimiters, truncation, normalisation, eight malformed-output cases, eight provider error classes, service-token checks, request validation, health, settings validation.

## Express Backend

- [x] **TASK-AI-013** `src/services/aiService.ts` — FastAPI client with bearer token and timeout; outcomes returned as values, never thrown. `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, `AI_SERVICE_TIMEOUT_MS`, `AI_CATALOG_HOURLY_LIMIT` in `src/lib/config.ts` and `.env.example`.
- [x] **TASK-AI-014** `src/schemas/ai.schemas.ts` — Zod validation of the FastAPI response.
- [x] **TASK-AI-026** `migrations/006_add_catalog_draft.sql` — `ai_catalog_draft`, `ai_catalog_requested_at` (applied twice to `cardvault_test`).
- [x] **TASK-AI-015** `src/services/catalogingService.ts` — owner check, per-user hourly limit, atomic claim with stale-request takeover, existing subject headings, draft storage, `FAILED` on any failure; `discardDraft`. Routes `POST /api/cards/:id/catalog`, `DELETE /api/cards/:id/catalog/draft`, `GET /api/ai/status`. Saving AI metadata clears the draft.
- [x] **TASK-AI-027** Vault keyword search: `q` on `GET /api/cards` over title, source text, notes and saved catalog details (D-14).
- [x] **TASK-AI-028** `tests/cataloging.integration.test.ts` — 29 tests: authentication, availability, draft storage, request body and privacy, accept and discard, no overwrite, no source text, cross-user, public-card privacy, seven failure modes, timeout, unreachable service, retry, concurrency, stale takeover, rate limit, search.
- [ ] **TASK-AI-029** Run `npm run migrate` on the local development database and on Railway (Railway needs approval). Required before deploying the Express changes.

## Frontend

- [x] **TASK-AI-016** `components/ai/AiCatalogPanel.vue` and `components/ai/AiMetadataEditor.vue` — Catalog with Muse, a draft review labelled with the model, save or discard, manual editing, warnings for published and truncated cards, loading and error states. `AiProcessingStatus.vue` labels updated for owner-requested cataloging.
- [x] **TASK-AI-030** `pages/catalog/index.vue` — vault keyword search through `GET /api/cards?q=`; the mode selector is hidden (D-10).
- [ ] **TASK-AI-017** Polling while `PENDING` — not needed for the synchronous MVP flow (the request returns the result). Needed only if automatic cataloging (D-15) is added.
- [ ] **TASK-AI-031** Manual browser check of the catalog, review, save, discard and search flows (not yet done).

## Deployment (needs approval)

- [ ] **TASK-AI-032** Add a Railway service for `backend/fastapi` on the private network (start: `uvicorn app:app --host 0.0.0.0 --port $PORT`) with its variables. Set `AI_SERVICE_URL` and `AI_SERVICE_TOKEN` on the Express service. No public domain for the AI service.

## Richer Catalog Entries (REQ-AI-017, REQ-AI-018)

> Verification: `backend/fastapi` pytest 69 tests (21 new in `tests/test_catalog_entry.py`, fake provider, domain-neutral sample); `backend/expressjs` Jest 241 tests (new `tests/catalogEntry.integration.test.ts`, extended cataloging and community tests) on `cardvault_test`; typecheck; frontend production build. Not verified against a live Meta account: output quality on real sources (for example a Wikipedia article) still needs a manual check (TASK-AI-041).

- [x] **TASK-AI-035** Prompt rewrite: original wording, grounded fields, concise description (≤ 60 words), catalog title, facts, specific headings, keywords that don't repeat the title or headings, grounded related concepts; domain-neutral examples. Strict schema with nested objects.
- [x] **TASK-AI-036** `normalise()` checks: title fallback from the source title, fact grounding, related-concept grounding (name must appear in the source), duplicate and length limits, copy check (12 consecutive source words rejects the description).
- [x] **TASK-AI-037** Pydantic `Fact`, `RelatedConcept` and the extended `CatalogResponse`; older answers without the new fields still parse.
- [x] **TASK-AI-038** `migrations/007_add_catalog_entry_fields.sql` (`catalog_title`, `ai_facts`, `ai_related`; applied twice to `cardvault_test`). Zod schemas for the response and for owner edits; draft mapping; owner and public projections; related-concept links computed on read; search over the new fields; saved copies take them.
- [x] **TASK-AI-039** Frontend: catalog title as the page heading with the most specific heading in the eyebrow; the catalog entry first (description, facts, headings, keywords, related concepts with links), the original source after it under its own title; editor for the title, facts and related concepts; list items show the catalog title.
- [x] **TASK-AI-040** Tests listed in the verification note above.
- [ ] **TASK-AI-041** Manual check on real sources (a Wikipedia article and a non-encyclopedia page) with the deployed model: description length and originality, specific headings, facts and related concepts. Tune the prompt if needed.
- [ ] **TASK-AI-042** Run migration 007 on the local development database and on Railway before deploying (Railway needs approval).

## Status Model (done earlier)

- [x] **TASK-AI-018** New cards get `ai_catalog_status` and `ai_embedding_status` `NOT_AVAILABLE`.
- [x] **TASK-AI-019** Frontend uses the two statuses and shows metadata whenever it exists.

## Future

- [ ] **[FUTURE: D-15]** **TASK-AI-033** Automatic cataloging after card creation (background job, polling, backfill).
- [ ] **[FUTURE]** **TASK-AI-034** Suggest one of the owner's collections for a card.
- [ ] **[FUTURE; needs D-7, D-12]** **TASK-AI-004** `models/embeddings.py`.
- [ ] **[FUTURE; needs D-12]** **TASK-AI-006** `services/embedder.py` (local inference preferred).
- [ ] **[FUTURE; needs D-12]** **TASK-AI-009** `routers/embeddings.py`.
- [ ] **[FUTURE; needs D-6, D-7, D-12]** **TASK-AI-023** `embedCard` in `aiService.ts`, embedding validation, and an independent embedding operation.
- [ ] **[OPTIONAL; BLOCKED: D-13, V-10]** **TASK-AI-021** Optional image generation with Muse Image.
