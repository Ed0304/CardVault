# Authentication — Tasks

## Backend

- [ ] **TASK-AUTH-001** Initialize Express TypeScript project — add `tsconfig.json`, `package.json` scripts (`dev`, `build`, `start`), and install core dependencies (`express`, `typescript`, `ts-node`, `@types/express`).
- [ ] **TASK-AUTH-002** Create `backend/expressjs/src/index.ts` — configure Express with JSON middleware, cookie parser, session middleware, CORS, and the global error handler. Mount all routers under `/api`.
- [ ] **TASK-AUTH-003** Create `backend/expressjs/prisma/schema.prisma` — define the `User` model with `id`, `email`, `passwordHash`, `displayName`, `createdAt`, `updatedAt`.
- [ ] **TASK-AUTH-004** Create `backend/expressjs/src/lib/prisma.ts` — export a Prisma client singleton.
- [ ] **TASK-AUTH-005** Create `backend/expressjs/src/schemas/auth.ts` — define `registerSchema` and `loginSchema` with Zod.
- [ ] **TASK-AUTH-006** Create `backend/expressjs/src/middleware/authenticate.ts` — read `req.session.userId`, query the user, attach to `req.user`, return 401 if missing.
- [ ] **TASK-AUTH-007** Create `backend/expressjs/src/middleware/validateBody.ts` — generic Zod validation wrapper middleware.
- [ ] **TASK-AUTH-008** Create `backend/expressjs/src/middleware/errorHandler.ts` — catch-all Express error handler returning `{ data: null, error: string, message: string }`.
- [ ] **TASK-AUTH-009** Create `backend/expressjs/src/services/authService.ts` — implement `registerUser`, `loginUser`, `getUserById`.
- [ ] **TASK-AUTH-010** Create `backend/expressjs/src/routes/auth.ts` — implement `POST /register`, `POST /login`, `POST /logout`, `GET /me` using `authService`.
- [ ] **TASK-AUTH-011** Configure `express-session` with `connect-pg-simple` store pointing to the PostgreSQL `DATABASE_URL`.
- [ ] **TASK-AUTH-012** Create `backend/expressjs/.env.example` documenting `DATABASE_URL`, `SESSION_SECRET`, `PORT`, `FASTAPI_URL`.

## Frontend

- [ ] **TASK-AUTH-013** Create `app/composables/useAuth.ts` — fetch `/api/auth/me` on load, expose `user`, `login()`, `logout()`, `register()`.
- [ ] **TASK-AUTH-014** Create `app/middleware/auth.ts` — redirect unauthenticated users to `/auth/login`.
- [ ] **TASK-AUTH-015** Create `app/layouts/auth.vue` — minimal unauthenticated layout (centered card, no nav).
- [ ] **TASK-AUTH-016** Create `app/layouts/default.vue` — authenticated app layout with top navigation and user menu.
- [ ] **TASK-AUTH-017** Create `app/pages/auth/register.vue` — registration form using `useAuth().register()`.
- [ ] **TASK-AUTH-018** Create `app/pages/auth/login.vue` — login form using `useAuth().login()`, redirect to intended page on success.
- [ ] **TASK-AUTH-019** Update `app/app.vue` — remove the default `NuxtWelcome` component, wire up `NuxtLayout` and `NuxtPage`.
- [ ] **TASK-AUTH-020** Update `frontend/cardvault/nuxt.config.ts` — add `runtimeConfig.public.apiBase` pointing to the Express backend URL.
