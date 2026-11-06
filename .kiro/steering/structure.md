---
inclusion: always
---

# CardVault — Repository Structure

## Repository Layout

```
/ (repository root)
├── .kiro/
│   ├── steering/          # Always-on project context for Kiro
│   ├── specs/             # Feature requirements, design, and tasks
│   └── hooks/             # Automation hooks
├── backend/
│   ├── expressjs/         # Main backend — Node.js, Express v5, TypeScript
│   └── fastapi/           # AI backend — Python, FastAPI
└── frontend/
    └── cardvault/         # Frontend — Nuxt 4, Vue 3.5, TypeScript
```

## Frontend — `frontend/cardvault/`

```
frontend/cardvault/
├── app/
│   ├── app.vue                    # Root app component
│   ├── pages/                     # File-based routing (Nuxt)
│   │   ├── index.vue              # Dashboard / card list
│   │   ├── auth/
│   │   │   ├── login.vue
│   │   │   └── register.vue
│   │   └── cards/
│   │       ├── new.vue
│   │       └── [id].vue
│   ├── components/                # Reusable Vue components
│   │   ├── card/                  # Card-specific components
│   │   ├── layout/                # Navigation, header, sidebar
│   │   └── ui/                    # Generic UI primitives
│   ├── composables/               # Shared reactive logic
│   │   ├── useAuth.ts
│   │   ├── useCards.ts
│   │   └── useSearch.ts
│   ├── layouts/
│   │   ├── default.vue            # Authenticated app layout
│   │   └── auth.vue               # Unauthenticated layout
│   └── middleware/
│       └── auth.ts                # Route guard
├── public/
├── nuxt.config.ts
├── tsconfig.json
└── package.json
```

## Express Backend — `backend/expressjs/`

```
backend/expressjs/
├── src/
│   ├── index.ts                   # Server entry — sets up middleware and mounts routers
│   ├── routes/
│   │   ├── auth.ts                # POST /auth/register, /auth/login, /auth/logout
│   │   ├── cards.ts               # CRUD /cards
│   │   ├── collections.ts         # CRUD /collections
│   │   ├── tags.ts                # /tags
│   │   └── search.ts              # GET /search
│   ├── middleware/
│   │   ├── authenticate.ts        # Session/token verification
│   │   ├── errorHandler.ts        # Global error handler
│   │   └── validateBody.ts        # Zod validation wrapper
│   ├── services/
│   │   ├── authService.ts
│   │   ├── cardService.ts
│   │   ├── aiService.ts           # HTTP client to FastAPI
│   │   └── urlIngestionService.ts
│   ├── schemas/                   # Zod request validation schemas
│   ├── lib/
│   │   └── prisma.ts              # Prisma client singleton
│   └── types/                     # Shared TypeScript types
├── prisma/
│   └── schema.prisma              # Database schema
├── package.json
└── tsconfig.json
```

## FastAPI Backend — `backend/fastapi/`

```
backend/fastapi/
├── app.py                         # FastAPI entry — creates app, includes routers
├── routers/
│   ├── catalog.py                 # POST /catalog — summarize, subjects, keywords
│   ├── embeddings.py              # POST /embeddings — generate vector embedding
│   ├── search.py                  # POST /search/similar — nearest-neighbour candidates
│   └── health.py                  # GET /health
├── models/
│   ├── catalog.py                 # Pydantic models for catalog requests/responses
│   ├── embeddings.py              # Pydantic models for embedding requests/responses
│   └── search.py                  # Pydantic models for search requests/responses
├── services/
│   ├── llm.py                     # LLM provider client (configurable)
│   └── embedder.py                # Embedding provider client (configurable)
├── core/
│   └── config.py                  # Settings loaded from environment variables
└── requirements.txt               # Python dependencies (to be created)
```

## Naming Conventions

| Context | Convention | Example |
|---|---|---|
| TypeScript variables/functions | camelCase | `fetchCards`, `userId` |
| TypeScript interfaces/types | PascalCase | `KnowledgeCard`, `UserSession` |
| Vue components | PascalCase | `CardItem.vue`, `ConfirmDialog.vue` |
| Vue pages | kebab-case filename | `new.vue`, `[id].vue` |
| Nuxt composables | camelCase with `use` prefix | `useCards.ts` |
| Express route files | camelCase | `cards.ts`, `authService.ts` |
| Python modules/variables | snake_case | `card_service.py`, `user_id` |
| Python classes/Pydantic models | PascalCase | `CatalogRequest`, `CardEmbedding` |
| Database tables | snake_case (Prisma convention) | `knowledge_cards`, `user_collections` |
| Environment variables | SCREAMING_SNAKE_CASE | `DATABASE_URL`, `AI_API_KEY` |

## File Organization Rules

- No business logic in route files — delegate to service functions.
- No direct Prisma calls in routes — use service layer.
- No raw `fetch` in Vue components — use composables.
- Zod schemas live in `src/schemas/` — not inline in route files.
- Pydantic models live in `models/` — not inline in router files.
- Environment variables accessed only through `core/config.py` (FastAPI) or a `lib/config.ts` (Express).
- Never commit `.env` files — use `.env.example` for documentation.
- `.kiro/` must never appear in any `.gitignore`.
