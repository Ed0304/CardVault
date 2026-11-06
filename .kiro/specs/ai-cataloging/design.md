# AI Cataloging — Design

## Architecture

```
Express (cardService.createCard)
    │
    │  POST /catalog  (internal)
    ▼
FastAPI /catalog endpoint
    │
    │  LLM API call (provider via env)
    ▼
AI Provider (OpenAI / Anthropic / etc.)
    │
    ▼
FastAPI returns { summary, subjects, keywords }
    │
    ▼
Express validates response (Zod)
    │
    ├── Valid  → UPDATE knowledge_cards SET aiSummary, aiSubjects, aiKeywords, aiStatus=COMPLETE
    └── Invalid/Timeout → UPDATE knowledge_cards SET aiStatus=FAILED
```

Embedding generation follows the same pattern via `POST /embeddings`, storing the result in the `embedding` pgvector column.

## FastAPI Endpoints

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
{ "status": "ok", "provider": "openai" }
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

Express validates the FastAPI response before writing to the database.

## Prompt Construction (FastAPI)

The catalog prompt must treat user content as data, not instructions:

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

```python
# core/config.py
class Settings(BaseSettings):
    ai_provider: str = "openai"          # openai | anthropic | ...
    ai_api_key: str
    ai_model: str = "gpt-4o-mini"
    ai_embedding_model: str = "text-embedding-3-small"
    ai_timeout_seconds: int = 30

    class Config:
        env_file = ".env"
```

## Async Flow in Express

Card creation in `cardService.createCard`:
1. Insert card with `aiStatus: PENDING`.
2. Return the card to the route handler (and to the client).
3. After returning, fire-and-forget: call `aiService.catalogCard` and `aiService.embedCard`.
4. On success, `UPDATE` the card with AI metadata and `aiStatus: COMPLETE`.
5. On failure, `UPDATE` the card with `aiStatus: FAILED`.

This ensures card creation is never blocked or failed by AI availability.
