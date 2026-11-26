# Authentication — Tasks

## Backend

- [x] **TASK-AUTH-001** Express TypeScript project: scripts `dev`, `build`, `start`, `typecheck`, `migrate`, `test`; dependencies `express`, `pg`, `zod`, `argon2`, `jsonwebtoken`, `cookie-parser`, `helmet`, `cors`, `dotenv`; dev tool `tsx`.
- [x] **TASK-AUTH-002** `src/app.ts` (helmet, CORS, JSON, cookie-parser, routers under `/api/auth`, 404 and global error handler) and `src/server.ts` (starts the server).
- [x] **TASK-AUTH-003** `migrations/001_create_users.sql` (existing `users` table; do not modify) and `scripts/migrate.ts`.
- [x] **TASK-AUTH-004** `src/lib/db.ts` (pg Pool singleton) and `src/lib/config.ts` (validated env).
- [x] **TASK-AUTH-005** `src/schemas/auth.schemas.ts` — `registerSchema`, `loginSchema`.
- [x] **TASK-AUTH-006** `src/middleware/authenticate.ts` — verify JWT from cookie or Bearer header, set `req.user.id`, return 401 otherwise (no database lookup).
- [x] **TASK-AUTH-007** Create `backend/expressjs/src/middleware/validateBody.ts` — generic Zod validation wrapper middleware.
- [x] **TASK-AUTH-008** `src/middleware/errorHandler.ts` — returns `{ data: null, error: { code, details? }, message }`.
- [ ] **TASK-AUTH-009** `src/services/authService.ts` (`registerUser`, `loginUser`, `getCurrentUser`) and `src/services/userService.ts` (parameterized SQL). Partially complete: `registerUser` does not meet REQ-AUTH-001 (duplicate email returns 409). Complete after TASK-AUTH-022.
- [ ] **TASK-AUTH-010** `src/routes/auth.routes.ts` and `src/controllers/authController.ts` — register, login, logout, me. Partially complete: register behaviour per TASK-AUTH-022.
- [x] **TASK-AUTH-011** JWT, cookie and password helpers: `src/lib/jwt.ts` (HS256, iss/aud/exp), `src/lib/cookies.ts` (`cv_token`), `src/lib/password.ts` (Argon2id).
- [x] **TASK-AUTH-012** `backend/expressjs/.env.example` documenting `DATABASE_URL`, `JWT_SECRET`, `PORT`, `JWT_ISSUER`, `JWT_AUDIENCE`. (`FASTAPI_URL` is added when `aiService` exists.)
- [x] **TASK-AUTH-021** `tests/auth.test.ts` — Jest + Supertest, 24 tests with the user service mocked. Note: one test currently asserts the 409 behaviour (see TASK-AUTH-023). No test runs against a real PostgreSQL.
- [ ] **TASK-AUTH-022** Fix duplicate-email registration so it does not reveal that the email is registered (REQ-AUTH-001). Blocked on a decision about the approach (see design D1). Must: never issue a cookie for the existing account; return a response indistinguishable from the normal outcome; handle the unique-violation race the same way; keep hashing before the insert. Remove `EMAIL_ALREADY_REGISTERED` from the register path. Touches `authService.ts`, `authController.ts`.
- [x] **TASK-AUTH-025** Rate-limit login and registration per client IP (design D6):
  - `src/middleware/authRateLimit.ts`, mounted after validation on `POST /api/auth/login` and `POST /api/auth/register`.
  - Failed logins are limited per IP and per IP plus salted email digest. Successful logins give their attempt back. Every registration attempt counts.
  - Over a limit: 429 `AUTH_RATE_LIMITED` with `Retry-After`. Configured by `AUTH_*` variables, validated at startup.
  - The login page shows the 429 message.
  - Verified on 2026-11-25 by 25 DB-free tests (`tests/authRateLimit.test.ts`) and the full Express suite, 350/350 against `cardvault_test`.
  - Does not address the duplicate-email 409 (TASK-AUTH-022), though it slows how fast that can be probed.
- [ ] **TASK-AUTH-026** When deploying TASK-AUTH-025, confirm `TRUST_PROXY_HOPS=1` is set on the Railway Express service (as for TASK-DISC-027). Otherwise every visitor shares one login and registration allowance.
- [x] **TASK-AUTH-027** Unique usernames, ignoring case:
  - `migrations/009_unique_username.sql` adds a unique index on `lower(username)`. If duplicates already exist, it stops with an error and changes nothing.
  - `authService.registerUser` answers 409 `USERNAME_TAKEN` for that index and keeps `EMAIL_ALREADY_REGISTERED` for the email constraint.
  - Applied to `cardvault_test` only. Verified on 2026-11-25 by 2 unit tests, 5 integration tests (`tests/registration.integration.test.ts`, including a simultaneous-registration race) and the full Express suite, 357/357.
  - Follow-up, 2026-11-25. Each unique violation is now mapped by the column PostgreSQL names in its error (constraint name or detail), not by one index name. A username rule under any name gives `USERNAME_TAKEN`, and an unrecognised rule gives a neutral 409 `ACCOUNT_CONFLICT` instead of the email message.
    - Reported by the project owner: a duplicate username with a new email showed "email already exists".
    - Verified by 5 more unit tests and the full suite, 362/362.
- [ ] **TASK-AUTH-028** Resolve existing duplicate usernames, then run migration 009 on each database. Needs the project owner: renaming accounts is a data decision.
  - The local development database has 2 usernames shared by 6 accounts (read-only check, 2026-11-25).
  - Railway was not checked.
  - The query to find duplicates is at the top of the migration.
  - Deploy the Express change after 009 has run. Until then, a duplicate username is still accepted, and is answered with the email message only if the email is also taken.
- [ ] **TASK-AUTH-023** Update `tests/auth.test.ts`: replace "rejects a duplicate email with 409" with a test of the corrected behaviour, including that no auth cookie is issued for an existing account. Depends on TASK-AUTH-022.
- [ ] **TASK-AUTH-024** Update `app/pages/register.vue` (and `useAuth` register flow if the success path changes) to match the corrected registration behaviour. Depends on TASK-AUTH-022.

## Frontend

- [x] **TASK-AUTH-013** `app/composables/useAuth.ts` and `app/plugins/auth.ts` — restore the user via `/api/auth/me`; expose `user`, `login()`, `logout()`, `register()`.
- [ ] **TASK-AUTH-014** Create `app/middleware/auth.ts` — redirect unauthenticated users to `/login`. Not implemented (no `app/middleware/` directory).
- [ ] **TASK-AUTH-015** Create `app/layouts/auth.vue` — minimal unauthenticated layout (centered card, no nav). (File exists; not reviewed.)
- [ ] **TASK-AUTH-016** Create `app/layouts/default.vue` — authenticated app layout with top navigation and user menu. (File exists; not reviewed.)
- [x] **TASK-AUTH-017** `app/pages/register.vue` — username, email, password; shows server validation messages. (Duplicate-email handling: TASK-AUTH-024.)
- [ ] **TASK-AUTH-018** `app/pages/login.vue` — form implemented; redirect to the originally requested page is not (always goes to `/catalog`).
- [ ] **TASK-AUTH-019** Update `app/app.vue` — remove the default `NuxtWelcome` component, wire up `NuxtLayout` and `NuxtPage`. (Not reviewed.)
- [x] **TASK-AUTH-020** `nuxt.config.ts` — `runtimeConfig.public.apiBase = http://localhost:5000/api` (override with `NUXT_PUBLIC_API_BASE`).
