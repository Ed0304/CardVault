# AI Cataloging — Design

## Status of This Design

| Category | Content |
|---|---|
| Confirmed architectural decisions | E-1: the intended runtime AI provider is Meta Model API (Muse family). E-2: similarity is owned by Express and PostgreSQL. E-3: two independent processing statuses. Express owns primary database access, FastAPI never accesses PostgreSQL, and the existing `pg` architecture is unchanged. Credentials stay server-side in FastAPI. |
| Currently implemented | Backend: nothing (`backend/fastapi/app.py` is empty; Express has no AI service). Frontend: status labels (`AiProcessingStatus.vue`) and a read-only metadata display (`AiMetadata.vue`) built around a single status. |
| Planned | Catalog generation with Muse Spark, optional image generation with Muse Image, FastAPI AI service, Express `aiService`, AI response schemas. |
| Unresolved | The embedding source (D-12); embedding dimension (D-6); generated-image storage (D-13); the items in "Verification Checklist" and "Open Decisions" below. |
| Known implementation gaps | The frontend uses one `aiStatus` and hides metadata unless it is `COMPLETE`. It calls endpoints that do not exist. There is no polling. |

## Intended Provider: Meta Model API

Chosen by the project owner. Facts below were read from Meta's published documentation (`dev.meta.ai`) during this documentation pass. They are not verified against a working account and must be re-checked before implementation (see the Verification Checklist).

| Item | Documented value |
|---|---|
| Base URL and auth | `https://api.meta.ai/v1`, bearer API key (Meta's examples name it `MODEL_API_KEY`) |
| API styles | Responses and Chat Completions (OpenAI-compatible), Messages (Anthropic-compatible) |
| Text and understanding model | `muse-spark-1.3`: inputs text, image, video, audio, PDF; output text; 1,048,576-token context; structured output via JSON schema |
| Image model | `muse-image-1.0`: inputs text and image; output image; endpoints Responses, `/v1/images/generations`, `/v1/images/edits` |
| Standard vs Contributor | `muse-spark-1.3` is Standard mode (content not used for training). `muse-spark-1.3-contributor` is cheaper but permits training on content, so it must not be used (REQ-AI-014) |
| Pricing (pay-as-you-go) | `muse-spark-1.3` Standard: $1.25 per 1M input tokens, $0.15 per 1M cached input, $4.25 per 1M output. `muse-image-1.0`: $0.01 per generated image |
| Rate limits (per team) | `muse-spark-1.3`: 3,000 requests/min and 4,000,000 tokens/min. `muse-image-1.0`: 150 requests/min. HTTP 429 with `Retry-After`; `x-ratelimit-*` headers |
| Availability | Public preview; not available in all jurisdictions; the geographic use policy lists restricted territories |
| Embeddings | No embedding model appears in the published model catalog (D-12) |

Provider-specific details appear only in this section, the FastAPI adapters and configuration. Requirements stay provider-neutral where possible.

## AI Operations by Model

| Operation | Model | Path | Status |
|---|---|---|---|
| Catalog generation (summary, subjects, keywords) | Muse Spark (`muse-spark-1.3`, Standard) with schema-constrained JSON output | Express → FastAPI `POST /catalog` → Meta Model API | Planned |
| Embedding generation | **Unresolved (D-12)** | Express → FastAPI `POST /embeddings` | Contract documented; source blocked |
| Image understanding | Muse Spark (accepts image input) | None | No current requirement. CardVault excludes PDF, OCR, audio and video processing, and cards are text/URL based. Any use needs a new requirement |
| Image generation and editing | Muse Image (`muse-image-1.0`) | Express → FastAPI (endpoints not designed) → Meta Model API | OPTIONAL (REQ-AI-013); not designed |
| Video generation | None | None | Out of scope |

Muse Spark text operations and Muse Image operations are separate: different models, different limits, different pricing, and independent failure. Image requests never touch the two card statuses.

## Architecture

```
Express (cardService.createCard)
    │
    │  POST /catalog  (internal)
    ▼
FastAPI /catalog endpoint
    │
    │  Muse Spark (muse-spark-1.3, Standard mode) via Meta Model API
    ▼
FastAPI returns { summary, subjects, keywords }
    │
    ▼
Express validates response (Zod)
    │
    ├── Valid  → UPDATE knowledge_cards SET ai_summary, ai_subjects, ai_keywords, ai_catalog_status='COMPLETE'
    └── Invalid/Timeout → UPDATE knowledge_cards SET ai_catalog_status='FAILED'
```

Embedding generation is a separate operation (`POST /embeddings`, source unresolved: D-12). It stores its result in the `embedding` pgvector column and updates only `ai_embedding_status`. This design currently documents two endpoints; whether they stay separate at the API level is an open decision (D-7). The two statuses are independent either way.

## Responsibility Boundaries

| Component | Owns | Must not |
|---|---|---|
| Express | AI orchestration, response validation, all writes to PostgreSQL, search endpoints, authentication, user scoping | Trust a user id from the request body; talk to the AI provider directly; hold provider credentials |
| PostgreSQL + pgvector | Vector storage; similarity calculation and ranking | n/a |
| FastAPI | Calling Meta Model API; producing summaries, subjects, keywords (and later embeddings, optional images) from text sent by Express; holding provider credentials | Access PostgreSQL; implement or expose similarity search |
| Nuxt | UI only | Call FastAPI or the provider; ever see provider credentials |

## Processing Status Model (proposed)

Two independent columns per card (names proposed, D-8): `ai_catalog_status` and `ai_embedding_status`.

| State | Meaning |
|---|---|
| `PENDING` | Operation requested, not finished |
| `COMPLETE` | Operation finished and its result was stored |
| `FAILED` | Operation attempted, no result stored |
| `NOT_AVAILABLE` | No runtime AI integration was available for the operation, so it was not attempted |

Illustrative combinations (not a transition specification):

| Catalog | Embedding | Meaning |
|---|---|---|
| `COMPLETE` | `COMPLETE` | Both operations succeeded |
| `COMPLETE` | `FAILED` | Metadata exists, embedding generation failed |
| `FAILED` | `COMPLETE` | Metadata generation failed, an embedding exists |
| `PENDING` | `PENDING` | Both pending |
| `NOT_AVAILABLE` | `NOT_AVAILABLE` | No runtime AI integration, nothing attempted |

Proposed invariants:
- `ai_embedding_status = 'COMPLETE'` if and only if an embedding is stored; the vector and the status are written in one statement.
- User edits never change either status and never trigger generation.
- The catalog job writes only catalog columns and its status. The embedding job writes only the embedding and its status.
- Image generation never changes either status.

Not decided: transitions out of `FAILED`, `NOT_AVAILABLE` or a stale `PENDING` (D-1, D-2). `NOT_STARTED` is not proposed because it overlaps `PENDING` and `NOT_AVAILABLE`.

## Frontend Representation

- Show summary, subjects and keywords whenever they exist, whatever the statuses are.
- Show one indicator per operation, so partial success is visible (for example catalog complete, embedding failed). Labels are illustrative.
- `NOT_AVAILABLE` uses neutral wording and is never presented as a failure.
- A compact list indicator may summarise the two statuses but must not hide a partial success or a failure.
- Polling, if used, continues while either status is `PENDING`, with a limit set by D-1.
- Generated images (optional) are labelled as AI-generated and shown apart from the original source and notes.

## FastAPI Endpoints

*(Planned. None is implemented.)*

### POST /catalog
Request:
```json
{
  "card_id": "clx...",
  "text": "Source content to be cataloged..."
}
```
Response (200):
```json
{
  "card_id": "clx...",
  "summary": "Two to four sentence summary of the content.",
  "subjects": ["Machine Learning", "Neural Networks"],
  "keywords": ["transformer", "attention mechanism", "fine-tuning"]
}
```

### POST /embeddings
*(Contract only. Embedding source unresolved: D-12.)*
Request:
```json
{
  "card_id": "clx...",
  "text": "Source content to embed..."
}
```
Response (200):
```json
{
  "card_id": "clx...",
  "embedding": [0.021, -0.043, ...]
}
```

### GET /health
Response (200):
```json
{ "status": "ok", "provider": "<configured provider id>" }
```

## Pydantic Models

```python
# models/catalog.py
class CatalogRequest(BaseModel):
    card_id: str
    text: str

class CatalogResponse(BaseModel):
    card_id: str
    summary: str
    subjects: list[str] = Field(min_length=1, max_length=5)
    keywords: list[str] = Field(min_length=1, max_length=15)

# models/embeddings.py
class EmbeddingRequest(BaseModel):
    card_id: str
    text: str

class EmbeddingResponse(BaseModel):
    card_id: str
    embedding: list[float]
```

## Express AI Service Client

```typescript
// src/services/aiService.ts
async function catalogCard(cardId: string, text: string): Promise<CatalogResult | null>
async function embedCard(cardId: string, text: string): Promise<number[] | null>
```

Both functions catch all exceptions and return `null` on failure — callers must handle null.

## Zod Response Validation (Express side)

```typescript
const catalogResponseSchema = z.object({
  card_id: z.string(),
  summary: z.string().min(1),
  subjects: z.array(z.string()).min(1).max(5),
  keywords: z.array(z.string()).min(1).max(15),
})
```

Express validates the FastAPI response before writing to the database, even though the provider documents schema-constrained output.

## Prompt Construction (FastAPI)

The catalog prompt must treat user content as data, not instructions. The provider documents JSON-schema structured output; the schema would carry the same bounds as the models above.

```python
SYSTEM_PROMPT = """You are a knowledge cataloging assistant.
Analyze the provided text and return a JSON object with:
- summary: a 2-4 sentence factual summary
- subjects: 1-5 broad subject labels
- keywords: 3-15 specific keywords or phrases

Return only valid JSON. Do not include any other text."""

USER_PROMPT = f"""Catalog the following text:

<content>
{text}
</content>"""
```

The `<content>` delimiters ensure the model treats the text as data rather than instructions.

## Configuration (FastAPI)

Configuration is loaded only from environment variables through `core/config.py` (REQ-AI-008). It must cover the provider credential, the base URL, the text model identifier, the image model identifier and timeouts. Setting names are not fixed yet (Meta's own examples use `MODEL_API_KEY`). The intended values are `muse-spark-1.3` and `muse-image-1.0`; they are configuration, not code constants.

Rules:
- The credential lives only in FastAPI's environment. It is never in source, never in `.env.example` with a real value, never returned or logged, and never available to Nuxt or Express.
- Configuration validation rejects Contributor-mode model identifiers (REQ-AI-014).
- Do not copy credentials or configuration files from other projects; create the key for this project and never commit it.

## Async Flow in Express

Target flow once the runtime AI integration is operational, in `cardService.createCard`:
1. Insert the card with `ai_catalog_status = 'PENDING'` and `ai_embedding_status = 'PENDING'`.
2. Return the card to the route handler (and to the client).
3. After returning, start catalog generation (`aiService.catalogCard`) and embedding generation (`aiService.embedCard`) as two independent operations.
4. Catalog success: update only the catalog fields and set `ai_catalog_status = 'COMPLETE'`. Catalog failure: set only `ai_catalog_status = 'FAILED'`.
5. Embedding success: update only `embedding` and set `ai_embedding_status = 'COMPLETE'` in the same statement. Embedding failure: set only `ai_embedding_status = 'FAILED'`.
6. AI results must never overwrite user edits (mechanism: D-3).

Behaviour while no runtime AI integration is available:
1. Insert the card with both statuses `NOT_AVAILABLE`.
2. Return the card. No request is made to FastAPI.

Card creation is never blocked or failed by AI availability. The execution mechanism, timeouts, stale-`PENDING` recovery and retries are open (D-1, D-2). The provider's documented rate limits and `Retry-After` behaviour inform that work.

## Verification Checklist

Required before the dependent tasks start. "Documented" means read in Meta's docs, not proven with this project's account.

| ID | Item | State |
|---|---|---|
| V-1 | Access and region: the project's account, the developer location and end-user locations are permitted by the geographic use policy; the hackathon rules allow an external AI service | Open |
| V-2 | API surface: base URL, bearer auth, Responses vs Chat Completions; choose an OpenAI-compatible SDK or direct HTTP; pin the version | Documented; client choice open |
| V-3 | Model identifiers `muse-spark-1.3` and `muse-image-1.0` available to the account; deprecation and version-pinning policy | Documented; open for the account |
| V-4 | Structured output works on the chosen endpoint with the catalog schema (array bounds, nesting); reasoning-effort setting for cost and latency | Documented; open |
| V-5 | Practical input limit per card (context is documented as 1,048,576 tokens) and the truncation policy (feeds D-4) | Open |
| V-6 | Embeddings: confirm whether Meta Model API offers any embedding model; if not, resolve D-12 | Not found in the model catalog; open |
| V-7 | Pricing: free tier or credits, estimated cost per card, whether reasoning tokens are billed as output, price stability | Documented rates; rest open |
| V-8 | Rate limits for this account: documented per-team limits, 429 handling, preview-tier differences | Documented; open for the account |
| V-9 | Data handling: retention and zero-data-retention terms for Standard mode; user disclosure (privacy-first) | Standard mode documented as not used for training; rest open |
| V-10 | Image generation: response format (URL or base64), sizes, URL expiry, safety filtering, usage rights, provenance marking | Open |
| V-11 | Typical latency and the timeout values to use (feeds D-1) | Open |
| V-12 | Error codes that separate retryable from permanent failures (feeds D-2) | Open |

## Open Decisions

Not decided by this document.

| ID | Decision |
|---|---|
| E-1 | Resolved in direction (Meta Model API). Remaining work is the Verification Checklist |
| D-1 | Stale `PENDING` recovery and timeout policy |
| D-2 | Retry for `FAILED`; backfill of `NOT_AVAILABLE` cards |
| D-3 | Mechanism preventing AI results from overwriting user edits |
| D-4 | Maximum text input length |
| D-5 | Internal Express-to-FastAPI authentication |
| D-6 | Embedding dimension and vector schema (depends on D-12) |
| D-7 | Whether embedding generation is independent of catalog generation at the API level, including the `card_id` contract for query embeddings |
| D-8 | Status value set, column names, nullability and defaults |
| D-9 | How Express determines that no runtime AI integration is available, and the initial status of a new card |
| D-10 | Semantic search behaviour while no embeddings exist |
| D-11 | Default search mode: `semantic` or `auto` (see the semantic-search design) |
| D-12 | Embedding source, because the intended provider lists no embedding model |
| D-13 | Optional image feature: whether it is in scope, where generated images are stored (PostgreSQL is the only datastore), and any request status tracking |
