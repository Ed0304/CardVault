# Tech Stack Reference

## Frontend — Nuxt 4 + Vue 3.5

- Use `<script setup lang="ts">` in all Vue components
- Auto-imports are enabled — no need to manually import `ref`, `computed`, `useRoute`, etc.
- Place pages in `app/pages/`, components in `app/components/`, composables in `app/composables/`
- Use `useFetch` or `$fetch` for API calls — avoid raw `axios` unless added as a module

## Backend A — Express.js v5

- Entry point: `backend/expressjs/index.js` (create if missing)
- Organise routes under `backend/expressjs/routes/`
- Use `express.Router()` for each resource (e.g., `cards`, `users`)
- Middleware goes in `backend/expressjs/middleware/`
- Use `app.use(express.json())` for JSON body parsing (built-in, no `body-parser` needed)

## Backend B — FastAPI (Python)

- Entry point: `backend/fastapi/app.py`
- Define Pydantic models in `backend/fastapi/models/`
- Organise routers in `backend/fastapi/routers/`
- Use `APIRouter` for resource grouping, include them in the main `app.py`
- Type-annotate all route functions

## Shared Conventions

- All API responses follow: `{ "data": ..., "error": null, "message": "..." }`
- HTTP status codes must be explicit and meaningful (200, 201, 400, 404, 422, 500)
- CORS must be enabled on both backends for the Nuxt dev server (`http://localhost:3000`)
