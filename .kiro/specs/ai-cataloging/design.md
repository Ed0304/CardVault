# AI Cataloging — Design

## Status of This Design

| Category | Content |
|---|---|
| Confirmed architectural decisions | E-1: the hosted AI provider is Meta Model API (Muse family); no second hosted provider. E-2: Express and PostgreSQL own search and similarity. E-3: two independent processing statuses. Express owns all database access; FastAPI never touches PostgreSQL. Credentials stay in FastAPI. |
| MVP scope (implemented) | Owner-requested catalog generation with **Muse Ember** (`muse-ember-1.0`): summary, subjects and keywords returned as a private **draft** the owner reviews, edits and saves. Vault keyword search over the saved details. |
| Future milestone: Semantic Retrieval | Embedding generation, pgvector storage, semantic search, related cards. Preserved below; no MVP item depends on it. |
| Verified against | Meta's official documentation at `dev.meta.ai` (read November 2026). **Not** verified against a live account: no `MODEL_API_KEY` exists for this project yet (see the Verification Checklist). |

## Provider: Meta Model API (verified in the official docs)

Sources: [Models](https://dev.meta.ai/docs/models), [Choose a model](https://dev.meta.ai/docs/choose-a-model), [Muse Ember](https://dev.meta.ai/docs/muse-ember), [Pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits), [Structured output](https://dev.meta.ai/docs/structured-output), [Reasoning](https://dev.meta.ai/docs/reasoning), [SDKs](https://dev.meta.ai/docs/sdks), [Error handling](https://dev.meta.ai/docs/cookbook/error-handling-retry), [Geographic use policy](https://dev.meta.ai/legal/geographic-use-policy), [Data commitments](https://dev.meta.ai/legal/commitments).

| Item | Documented value |
|---|---|
| Base URL and auth | `https://api.meta.ai/v1`, bearer API key. Responses, Chat Completions (OpenAI-compatible) and Messages (Anthropic-compatible) |
| SDK | No Meta SDK. The official OpenAI SDK works with Meta's base URL; it does not read `MODEL_API_KEY` itself, so the key is passed explicitly |
| Reasoning models | `muse-wonder-1.0`, `muse-spark-1.3` (also 1.2, 1.1), `muse-ember-1.0`. Same request body; switching is a model id change. Inputs: text, image, video, audio, PDF; output text; 1,048,576-token context |
| Reasoning effort | `minimal` to `max` (`none` returns 400). Defaults: `max` on Wonder and Ember, `high` on Spark. Reasoning tokens are billed as output |
| Structured output | `response_format: {type: "json_schema", json_schema: {name, schema, strict}}`. Decoding is constrained to the schema. `strict: true` needs `additionalProperties: false` and every property in `required` |
| Pricing per 1M tokens (Standard) | Wonder $4.00 in / $20.00 out. Spark $1.25 in / $4.25 out. Ember $0.10 in / $0.50 out up to 200K input tokens per request, $0.30 / $1.50 above |
| Rate limits (per team) | Wonder, Spark 1.3 and Ember: 3,000 requests/min and 4,000,000 tokens/min each. 429 with `Retry-After`; back off with jitter |
| Errors | OpenAI-style envelope. Retry 429, 5xx, timeouts and connection errors; never retry 400, 401, 404 |
| Training and data | Standard mode: content is not used to train Meta models (it may be processed for abuse and safety). Contributor mode (`muse-spark-1.3-contributor`, `-1.2-contributor`) permits training; not allowed here (REQ-AI-014). Zero data retention needs separate enablement by Meta |
| Availability | Most countries where Meta AI and billing are available. Restricted territories are listed in the geographic use policy; Muse Wonder is additionally unavailable in South Korea. Circumventing geographic controls is prohibited |
| Embeddings | No embedding model in the catalog. Embeddings stay deferred (D-12) |
| Hackathon | The Kiroween rules allow third-party SDKs and APIs used in line with their terms |

## Model Selection

| Task | Model | Why |
|---|---|---|
| Catalog generation (MVP) | **`muse-ember-1.0`**, reasoning effort `low` | Bounded extraction and classification over text the request supplies: the workload Meta names Ember for. Card text is at most 100,000 characters (about 25–35K tokens), well under Ember's 200K pricing cliff. About 12× cheaper than Spark per card. Default effort is `max`, which would waste tokens, so `low` is set explicitly |
| Quality fallback | `muse-spark-1.3` | Same request body. Switch with `MUSE_CATALOG_MODEL` if subject headings are too weak in practice. **The project owner chose `muse-spark-1.3` for the Railway deployment** (≈ $0.006–$0.02 per request) |
| Not used | `muse-wonder-1.0` | Built for long-horizon agentic coding; ~40× Ember's price for no benefit on a short extraction task |
| Not used | Muse Image, Muse Voice Transcribe, SAM | CardVault cards are text and URLs; PDF, OCR, audio and video are excluded from the MVP |

Estimated cost per catalog request with Ember: 3,000–12,000 input tokens and 500–1,500 output tokens (reasoning included) ≈ $0.0005–$0.002. Spark would be ≈ $0.006–$0.02.

## AI Opportunity Assessment

| Opportunity | Decision | Reason |
|---|---|---|
| A. Summary, subjects, keywords | **MVP, one call** | One bounded structured call returns all three; separate calls would resend the same input three times |
| A. Consistent subject headings | **MVP, in the same call** | The owner's existing headings (top 50 by use) are sent so Muse reuses them, like an authority file |
| A. Catalog category / entities | Future | Collections are the owner's own categories; keywords already capture concepts and names |
| B. Community enrichment | No new AI | Published cards already expose the owner-reviewed summary, subjects and keywords, and community search uses them. AI never publishes anything itself |
| C. Keyword search | **MVP, no AI** | PostgreSQL `ILIKE` over the saved details; deterministic, instant, free |
| C. Query expansion / explanations | Future | Adds a model call to every search; poor value before semantic search exists |
| C/D. Semantic search, related cards | Future milestone | Needs embeddings (none from this provider), pgvector and storage; not realistic before the deadline |
| E. Multimodal | No | No image, PDF or audio inputs exist in CardVault |

## Architecture (implemented)

```
Nuxt  ──POST /api/cards/:id/catalog──▶  Express (catalogingService)
                                          1. authenticate; per-user hourly limit
                                          2. claim: UPDATE … SET ai_catalog_status='PENDING'
                                             WHERE id AND user_id AND has text AND not already running
                                          3. read the owner's top subject headings
                                          4. POST {FASTAPI}/catalog  (Bearer AI_SERVICE_TOKEN, timeout)
                                                 │
                                                 ▼
                                        FastAPI (services/llm.py)
                                          prompt with delimited content → Muse Ember
                                          (Chat Completions, json_schema, reasoning_effort=low)
                                          parse, normalise, validate (Pydantic)
                                                 │
                                          5. Zod-validate the response
                                          6. success: ai_catalog_draft = {...}, status COMPLETE
                                             failure: status FAILED (nothing else changes)
Nuxt  ◀── card with aiCatalogDraft ──
Owner reviews/edits → PATCH /api/cards/:id/ai-metadata (saves, clears the draft)
                  or → DELETE /api/cards/:id/catalog/draft
```

The call is synchronous within the owner's request: it is short (a few seconds at low effort), needs no job queue, and the owner is waiting for the result anyway.

## Responsibility Boundaries

| Component | Owns | Must not |
|---|---|---|
| Express | Authorization, rate limiting, the claim, reading the owner's subject headings, validation, all writes | Call the provider; hold provider credentials |
| FastAPI | Prompt construction, the provider call, retries, output normalisation, the provider key | Access PostgreSQL; accept calls without the service token |
| Nuxt | Requesting, reviewing, editing, saving or discarding | Call FastAPI or the provider |

## Data Model

`migrations/006_add_catalog_draft.sql` (additive): `ai_catalog_draft JSONB` (object or NULL) and `ai_catalog_requested_at TIMESTAMPTZ`.

Draft shape: `{ summary, subjects, keywords, model, truncated, generatedAt }`. The draft is private: it appears only in the owner's card detail, never in Community Catalog responses, and saved copies do not take it.

## Processing Status Model

`ai_catalog_status` describes the **latest owner request**:

| Status | Meaning |
|---|---|
| `NOT_AVAILABLE` | Never requested (every new card), or AI cataloging is not configured |
| `PENDING` | A request is running. Older than the service timeout + 30 s, it counts as abandoned and a new request may take over (D-1) |
| `COMPLETE` | The latest request stored a draft. Stays `COMPLETE` after the draft is saved or discarded |
| `FAILED` | The latest request stored nothing. The card and any earlier draft are unchanged. The owner may retry (D-2) |

`ai_embedding_status` stays `NOT_AVAILABLE` for every card in the MVP. User edits change neither status.

## API

### Express (public, authenticated, owner only)

| Method | Path | Result |
|---|---|---|
| GET | `/api/ai/status` | `{ catalog: { available } }`. Reveals no configuration |
| POST | `/api/cards/:id/catalog` | 200 with the card and `aiCatalogDraft`. Errors: 404 `CARD_NOT_FOUND`, 409 `CATALOG_IN_PROGRESS`, 422 `NOTHING_TO_CATALOG`, 429 `AI_RATE_LIMITED` (+`Retry-After`), 502 `AI_CATALOG_FAILED`, 503 `AI_UNAVAILABLE` (+`Retry-After: 30`), 503 `AI_NOT_AVAILABLE` |
| DELETE | `/api/cards/:id/catalog/draft` | 200 with the card, draft cleared |
| PATCH | `/api/cards/:id/ai-metadata` | Existing endpoint. Now also clears the draft: saving resolves the suggestion |
| GET | `/api/cards?q=` | Vault keyword search (D-14): title, source text, notes, summary, subjects, keywords; escaped `ILIKE`; user-scoped |

### FastAPI (internal, `Authorization: Bearer <AI_SERVICE_TOKEN>`)

`POST /catalog`
```json
{ "title": "…", "text": "…", "existing_subjects": ["Library Science"] }
```
Request model forbids unknown fields; `text` 1–100,000 characters; at most 50 headings of ≤ 100 characters.

200:
```json
{ "summary": "…", "subjects": ["…"], "keywords": ["…"], "model": "muse-ember-1.0",
  "truncated": false, "usage": { "input_tokens": 812, "output_tokens": 240 } }
```
502 `{ "error": { "code": "INVALID_MODEL_OUTPUT" | "PROVIDER_REJECTED" } }`; 503 `PROVIDER_UNAVAILABLE`; 401 without the token; 422 for invalid requests.

`GET /health` → `{ "status": "ok", "catalog_model": "…" }`. No provider call. Interactive docs and `openapi.json` are disabled.

## Prompt and Output Handling

- Fixed system prompt (library cataloguer, 2–4 factual sentences, 1–5 Title Case headings reusing existing ones, 3–15 keywords). User content goes only in the user message, inside `<headings>`, `<title>` and `<document>` tags. Any such tag inside user text is neutralised so it cannot close the block (REQ-AI-010).
- Text over `CATALOG_MAX_INPUT_CHARS` (default 40,000) is cut, the prompt says so, and the draft records `truncated: true` (V-5, D-4).
- Schema-constrained JSON (`strict: true`, `additionalProperties: false`). Counts and lengths are stated in the prompt and enforced afterwards, so the schema stays within the documented strict subset.
- Normalisation: whitespace collapsed; empty, over-long (> 100) and case-insensitive duplicate labels dropped; at most 5 subjects and 15 keywords; summary clipped to 2,000 characters at a word boundary. An empty summary, subject list or keyword list, `finish_reason: "length"`, missing content or invalid JSON is a 502.
- Express validates again with Zod before storing anything (REQ-AI-005).
- Model output is stored as plain text and rendered with Vue text interpolation; it never controls SQL, routing or other behaviour.

## Failure, Retry and Limits

| Layer | Behaviour |
|---|---|
| Model fallback | `MUSE_CATALOG_FALLBACK_MODELS` (comma-separated, optional, Contributor-mode ids rejected). Used only when Meta answers `404 model_not_found`, which a third-party report ([CLIProxyAPI #6117](https://github.com/router-for-me/CLIProxyAPI/issues/6117)) describes as intermittent for `muse-spark-1.3` while 1.2 stayed available. The draft records the model that answered. `scripts/check_models.py` lists the key's models and probes each one |
| FastAPI → Meta | OpenAI SDK: `MUSE_TIMEOUT_SECONDS` (40) per attempt, `MUSE_MAX_RETRIES` (1) retry with backoff for 429, 5xx, timeouts and connection errors. 401/403 → `PROVIDER_REJECTED` (a 403 can mean the account or region is not enabled); 400/404 → `PROVIDER_REJECTED` |
| Express → FastAPI | `AI_SERVICE_TIMEOUT_MS` (90,000). Timeout or unreachable → 503 `AI_UNAVAILABLE`; FastAPI 503 → 503; anything else → 502 `AI_CATALOG_FAILED`. Status becomes `FAILED` either way |
| Concurrency | One running request per card (atomic claim); outcome writes are guarded by the claim's timestamp |
| Abuse and cost | `AI_CATALOG_HOURLY_LIMIT` (20) requests per user per hour, in memory (one Express instance; resets on restart). Provider limits (3,000 RPM) are far above this |

## Logging

FastAPI logs model, input length, truncation, token counts, duration and error class. Express logs outcome, HTTP status and duration. Neither logs card text, prompts, model output, notes, tokens or keys.

## Configuration

FastAPI (`backend/fastapi/.env.example`): `MODEL_API_KEY`, `MODEL_API_BASE_URL` (https only), `MUSE_CATALOG_MODEL` (Contributor-mode ids rejected), `MUSE_CATALOG_REASONING_EFFORT`, `MUSE_CATALOG_MAX_OUTPUT_TOKENS`, `CATALOG_MAX_INPUT_CHARS`, `MUSE_TIMEOUT_SECONDS`, `MUSE_MAX_RETRIES`, `AI_SERVICE_TOKEN` (≥ 32 characters). Missing or invalid values stop the service at startup.

Express (`backend/expressjs/.env.example`): `AI_SERVICE_URL` and `AI_SERVICE_TOKEN` (both or neither; neither = AI cataloging off, D-9), `AI_SERVICE_TIMEOUT_MS`, `AI_CATALOG_HOURLY_LIMIT`.

## Deployment (not done; needs approval)

A fourth Railway service for `backend/fastapi` (start: `uvicorn app:app --host 0.0.0.0 --port $PORT`), reachable from Express over Railway's private network only, with its variables set there. Express gets `AI_SERVICE_URL` (private address) and `AI_SERVICE_TOKEN`. Migration 006 must run before the Express deploy.

## Verification Checklist

| ID | Item | State |
|---|---|---|
| V-1 | Access and region for this account; hackathon rules | Rules: allowed. Region: the policy lists restricted territories only; **open until a key is created from the developer's location** |
| V-2 | API surface and client | **Done:** Chat Completions through the OpenAI Python SDK 3.59.0, pinned |
| V-3 | Model ids available to the account | Documented (`muse-ember-1.0`, `muse-spark-1.3`); open for the account (`GET /v1/models`) |
| V-4 | Structured output with the catalog schema; reasoning effort | Documented; **open against the live API** (first real request) |
| V-5 | Input limit | **Done:** 40,000 characters sent (configurable); flagged as truncated |
| V-6 | Embeddings | Deferred (future) |
| V-7 | Pricing | **Done** from the official page; per-card estimate above |
| V-8 | Rate limits | **Done** from the official page; account tier open |
| V-9 | Data handling | Standard mode not used for training (documented). ZDR not enabled |
| V-10 | Image generation | Not pursued |
| V-11 | Latency and timeouts | Timeouts set (40 s per attempt, 90 s overall); real latency **open** |
| V-12 | Retryable vs permanent errors | **Done** from the official error guide |

## Open Decisions

| ID | Decision | State |
|---|---|---|
| D-1 | Stale `PENDING` | **Resolved:** abandoned after the service timeout + 30 s; the next request takes over |
| D-2 | Retry | **Resolved:** the owner retries manually; FastAPI retries transient errors once. No automatic backfill |
| D-3 | AI never overwrites user edits | **Resolved:** results are a draft; only the owner's save writes catalog fields |
| D-4 | Input length | **Resolved:** 100,000 characters stored; 40,000 sent to the model |
| D-5 | Express → FastAPI auth | **Resolved:** shared bearer token (≥ 32 chars, constant-time comparison) plus a private network |
| D-9 | How "enabled" is determined | **Resolved:** `AI_SERVICE_URL` and `AI_SERVICE_TOKEN` both set |
| D-10 | Search mode selector | **Resolved for the MVP:** hidden; keyword search only |
| D-14 | Vault keyword surface | **Resolved:** `GET /api/cards?q=`. `GET /api/search` is left for semantic search |
| D-15 | Automatic cataloging on card creation | **Open (future):** needs background jobs and polling; the MVP is owner-requested |
| D-6, D-7, D-12 | Embeddings | Future milestone |
| D-13 | Image generation | Optional; not pursued |

## Future Milestone: Semantic Retrieval (preserved)

- FastAPI `POST /embeddings` (`{ text }` → `{ embedding }`), local inference preferred (D-12); Express stores the vector in a pgvector column in the same statement as `ai_embedding_status = 'COMPLETE'`, and runs the similarity queries (see the semantic-search design). Migration numbers: the next free numbers after 006.
- Storage: one `vector(<N>)` per card (for example 768 floats ≈ 3 KB), an HNSW index, and the pgvector extension, which Railway's PostgreSQL must support (unverified).
