# CardVault

> Save information once. Let CardVault organize it and help you rediscover it.

CardVault is an AI-powered personal knowledge catalog that revives the traditional physical library card catalog through modern web technologies and artificial intelligence. It is a **private, personal knowledge management system** — not a bookmarking tool, a social network, or a public archive.

Built for the **Kiro Hackathon** — Category: **Resurrection**.

---

## What It Does

CardVault lets you preserve useful information, organize it into digital knowledge cards, and rediscover it through AI-powered semantic search.

Every piece of saved content becomes a **knowledge card** with three independent layers:

| Layer | Contents | Editable |
|---|---|---|
| Original source | Extracted text, source URL, metadata | Immutable after creation |
| Personal notes | Your observations and annotations | You |
| AI catalog | Summary, subjects, keywords, embeddings | AI-generated; you can edit |

AI metadata never overwrites original content or personal notes.

### Core Features

- **Save from text** — paste any text and receive an AI-cataloged knowledge card
- **Save from URL** — provide a public URL; CardVault extracts and preserves the content
- **AI cataloging** — automatic summary, subjects, and keywords generated on save
- **Personal notes** — annotate any card with your own observations
- **Collections & tags** — organize cards into named groups
- **Keyword search** — find cards by title, content, or keywords
- **Semantic search** — natural language queries powered by vector similarity
- **Related cards** — surface conceptually similar cards from your vault

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Nuxt 4, Vue 3.5, TypeScript, Tailwind CSS |
| Main Backend | Node.js, Express.js v5, TypeScript, Zod, Prisma |
| AI Backend | Python, FastAPI |
| Database | PostgreSQL + pgvector |

### Architecture

```
Browser (Nuxt 4)
    │  REST API (HTTP)
    ▼
Express.js  ──────────────────────────────────────────────
    │  Auth, card CRUD, collections, tags, search         │
    │  Prisma ORM                                         │
    ▼                                                     │
PostgreSQL + pgvector                          Internal HTTP
    (user data, cards, embeddings)                        │
                                                          ▼
                                                     FastAPI
                                              (LLM integration,
                                           summarization, embeddings,
                                            semantic search support)
```

- Nuxt communicates with Express only — never directly with FastAPI.
- FastAPI is an internal AI service; it does not modify the database directly.
- A single PostgreSQL instance handles both relational data and vector embeddings via pgvector.

---

## Project Structure

```
/
├── .kiro/                     # Kiro development environment
│   ├── steering/              # Project-wide guidelines (product, tech, structure)
│   ├── specs/                 # Feature specs (requirements, design, tasks)
│   │   ├── authentication/
│   │   ├── catalog-management/
│   │   ├── ai-cataloging/
│   │   ├── url-ingestion/
│   │   └── semantic-search/
│   └── hooks/                 # Automation hooks (type checks, syntax checks)
├── backend/
│   ├── expressjs/             # Main API — Node.js, Express v5, TypeScript
│   └── fastapi/               # AI service — Python, FastAPI
└── frontend/
    └── cardvault/             # Nuxt 4 application
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 15+ with the [pgvector](https://github.com/pgvector/pgvector) extension

### Frontend

```bash
cd frontend/cardvault
npm install
npm run dev
# → http://localhost:3000
```

### Express Backend

```bash
cd backend/expressjs
npm install
# Copy and fill in environment variables
cp .env.example .env
npm run dev
# → http://localhost:4000
```

Required environment variables (`backend/expressjs/.env`):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/cardvault
SESSION_SECRET=your-secret-here
PORT=4000
FASTAPI_URL=http://localhost:8000
```

### FastAPI AI Backend

```bash
cd backend/fastapi
python -m venv .venv
.venv\Scripts\activate     # Windows
pip install -r requirements.txt
# Copy and fill in environment variables
cp .env.example .env
uvicorn app:app --reload --port 8000
# → http://localhost:8000
```

Required environment variables (`backend/fastapi/.env`):

```env
AI_PROVIDER=openai
AI_API_KEY=your-api-key-here
AI_MODEL=gpt-4o-mini
AI_EMBEDDING_MODEL=text-embedding-3-small
FASTAPI_PORT=8000
```

### Database Setup

```bash
cd backend/expressjs
npx prisma migrate dev
```

Ensure the pgvector extension is enabled in your PostgreSQL instance:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Design

**Modern first. Archival second. AI throughout.**

| Token | Color |
|---|---|
| Parchment | `#F5F0E6` |
| Ivory | `#FFFEFA` |
| Antique Beige | `#D8C6A5` |
| Archive Brown | `#8B7355` |
| Ink | `#33312D` |
| Terracotta | `#B66A4B` |

Typography: **Newsreader** for editorial headings · **Inter / Geist Sans** for interface · **Geist Mono** for catalog identifiers and metadata.

---

## Kiro Development Environment

This project uses [Kiro](https://kiro.dev) as its AI development environment. The `.kiro/` directory contains:

- **Steering files** — always-on context that guides Kiro across all sessions
- **Feature specs** — requirements, design decisions, and implementation task lists for each feature
- **Hooks** — automated TypeScript and Python checks triggered on file save

The `.kiro/` directory is intentionally committed and must not be added to `.gitignore`.

---

## MVP Scope

**In scope:** Authentication · Card creation (text + URL) · AI cataloging · Personal notes · Collections & tags · Keyword search · Semantic search · Related cards · Responsive UI

**Out of scope:** Collaboration · Public libraries · Browser extensions · Native apps · PDF/OCR/media processing · Web crawling · Billing

---

## License

MIT
