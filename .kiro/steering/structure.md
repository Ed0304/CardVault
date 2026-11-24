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
│   ├── app.vue
│   ├── pages/             # index.vue, login.vue, register.vue,
│   │                      # catalog/{index,create,[id]}.vue, collections/index.vue
│   ├── components/        # ai/, catalog/, collections/, common/
│   ├── composables/       # useAuth.ts, useCatalog.ts, useSearch.ts
│   ├── layouts/           # auth.vue, default.vue, landing.vue
│   ├── plugins/           # auth.ts (restores the session via GET /api/auth/me)
│   ├── services/          # api.ts, auth.service.ts, catalog.service.ts, search.service.ts
│   ├── stores/            # auth.store.ts
│   ├── types/, utils/, assets/
│   └── (not yet created) middleware/auth.ts   # route guard
├── public/
├── nuxt.config.ts
├── tsconfig.json
└── package.json
```

Specs refer to these files by their real paths: card pages are `pages/catalog/{index,create,[id]}.vue`, the composable is `useCatalog.ts`, catalog components are in `components/catalog/`, AI components in `components/ai/`, and generic UI primitives in `components/common/` (there is no `ui/` or `card/` folder). `pages/index.vue` is the landing page, not the card list. Components that do not exist yet go in the same folders: `components/catalog/NotesEditor.vue`, `components/catalog/RelatedCards.vue`, `components/common/ConfirmDialog.vue`, `components/ai/AiMetadataEditor.vue`.

## Express Backend — `backend/expressjs/`

```
backend/expressjs/
├── src/
│   ├── server.ts                  # Starts the HTTP server
│   ├── app.ts                     # Builds the Express app: helmet, cors, json, cookie-parser, routers, error handlers
│   ├── routes/
│   │   ├── auth.routes.ts         # /api/auth: register, login, logout, me
│   │   └── (planned) cards.routes.ts, collections.routes.ts, tags.routes.ts, search.routes.ts
│   ├── controllers/
│   │   ├── authController.ts      # HTTP in/out; calls services
│   │   └── (planned) cardController.ts, collectionController.ts, tagController.ts
│   ├── middleware/
│   │   ├── authenticate.ts        # Verifies JWT (Bearer header or cv_token cookie), sets req.user.id
│   │   ├── errorHandler.ts        # notFoundHandler + global error handler
│   │   └── validateBody.ts        # Zod validation wrapper
│   ├── services/
│   │   ├── authService.ts
│   │   ├── userService.ts         # SQL for the users table
│   │   └── (planned) cardService.ts, collectionService.ts, tagService.ts, aiService.ts, urlIngestionService.ts, searchService.ts
│   │       (aiService.ts calls FastAPI only, never the AI provider; searchService.ts runs keyword search in the MVP and pgvector queries in the future milestone, via the pg pool)
│   ├── schemas/
│   │   ├── auth.schemas.ts        # Zod request schemas
│   │   └── (planned) cards.schemas.ts, collections.schemas.ts, tags.schemas.ts, search.schemas.ts
│   ├── lib/
│   │   ├── config.ts              # Validated environment variables (only place that reads process.env)
│   │   ├── db.ts                  # pg Pool singleton
│   │   ├── jwt.ts                 # Sign/verify access tokens (HS256)
│   │   ├── cookies.ts             # Set/clear the auth cookie
│   │   ├── password.ts            # Argon2id hash/verify
│   │   ├── errors.ts              # AppError
│   │   └── response.ts            # { data, error, message } envelope helpers
│   └── types/
│       └── express.d.ts           # Adds req.user
├── migrations/                    # Idempotent SQL files, applied in filename order
│   └── 001_create_users.sql
├── scripts/
│   └── migrate.ts                 # npm run migrate
├── tests/                         # Jest + Supertest
├── .env.example
├── jest.config.js
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

## FastAPI Backend — `backend/fastapi/` (planned; intended provider: Meta Model API)

Currently only an empty `app.py` exists. The layout below is the planned structure. The MVP needs only catalog generation and health (`routers/catalog.py`, `routers/health.py`, `services/llm.py`). The embedding files belong to the future Semantic Retrieval milestone. Provider-specific code stays in `services/` and `core/config.py`. Optional image operations (Muse Image) are not designed yet and have no router or model here. FastAPI contains no similarity search and no database access; vector similarity is Express + PostgreSQL.

```
backend/fastapi/
├── app.py                         # FastAPI entry — creates app, includes routers
├── routers/
│   ├── catalog.py                 # POST /catalog — summarize, subjects, keywords
│   ├── embeddings.py              # POST /embeddings — generate vector embedding (future Semantic Retrieval milestone)
│   └── health.py                  # GET /health
├── models/
│   ├── catalog.py                 # Pydantic models for catalog requests/responses
│   └── embeddings.py              # Pydantic models for embedding requests/responses (future milestone)
├── services/
│   ├── llm.py                     # LLM provider client (configurable)
│   └── embedder.py                # Embedding generation, local inference preferred (future milestone; not selected)
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
| Nuxt composables | camelCase with `use` prefix | `useCatalog.ts` |
| Express files | `<name>.routes.ts`, `<name>Controller.ts`, `<name>Service.ts`, `<name>.schemas.ts` | `auth.routes.ts`, `authController.ts` |
| Python modules/variables | snake_case | `card_service.py`, `user_id` |
| Python classes/Pydantic models | PascalCase | `CatalogRequest`, `CardEmbedding` |
| Database tables and columns | snake_case | `knowledge_cards`, `password_hash` |
| Environment variables | SCREAMING_SNAKE_CASE | `DATABASE_URL`, `AI_API_KEY` |

## File Organization Rules

- Request flow is route → controller → service → `pg` pool. No business logic in routes.
- No SQL and no direct `pool` access in routes or controllers — only in `src/services/`.
- No raw `fetch` in Vue components — use composables.
- Zod schemas live in `src/schemas/` — not inline in route files.
- Pydantic models live in `models/` — not inline in router files.
- Environment variables accessed only through `core/config.py` (FastAPI) or a `lib/config.ts` (Express).
- Never commit `.env` files — use `.env.example` for documentation.
- `.kiro/` must never appear in any `.gitignore`.
