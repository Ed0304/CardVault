# Authentication — Design

How to read this document:
- **Confirmed architecture**: decisions that are settled.
- **Current implementation**: what the source code does today (verified by reading source and tests).
- **Known discrepancies and outstanding work**: where the implementation does not meet the requirements.

## Confirmed architecture

- PostgreSQL is accessed through the existing `pg` connection pool with parameterized SQL. No ORM.
- The existing `users` table and its UUID identifiers are preserved. No new user fields are introduced.
- Authentication is a JWT stored in an HttpOnly cookie (`cv_token`), `SameSite=Lax`.
- Passwords are hashed with Argon2id.
- Logout is stateless for the MVP: it clears the cookie. There is no server-side revocation or denylist and no
  refresh token. A JWT copied before logout stays valid until it expires (maximum remaining lifetime 15 minutes).
  This is an accepted MVP limitation.
- Registration must not reveal whether an email is already registered (REQ-AUTH-001). See discrepancy D1.

## Current implementation

### Architecture

```
Nuxt Frontend
    │  HttpOnly cookie `cv_token` (JWT) — SameSite=Lax, Secure in production
    ▼
Express Backend (src/app.ts, mounted at /api/auth)
    ├── POST /api/auth/register
    ├── POST /api/auth/login
    ├── POST /api/auth/logout
    └── GET  /api/auth/me
    │  parameterized SQL via the pg Pool (src/lib/db.ts)
    ▼
PostgreSQL (users table)
```

### Database

The `users` table already exists and is defined in `backend/expressjs/migrations/001_create_users.sql`.
This feature does not recreate or alter it.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key, default `gen_random_uuid()` |
| username | VARCHAR(100) | Required |
| email | VARCHAR(255) | Required, unique (`users_email_key`), `CHECK (email = lower(email))` |
| password_hash | TEXT | Required, Argon2id hash |
| created_at | TIMESTAMPTZ | Required, default `now()` |

There is no `display_name` or `updated_at` column. The API returns camelCase (`createdAt`).
Source: the migration file. The live database was not inspected.

### Token strategy

- JWT signed with HS256 (`jsonwebtoken`) using `JWT_SECRET` (min 32 characters).
- Payload: standard claims only: `sub` (user UUID), `iss` (`JWT_ISSUER`, default `cardvault-api`),
  `aud` (`JWT_AUDIENCE`, default `cardvault-web`), `iat`, `exp`. Lifetime 15 minutes.
- Cookie `cv_token`: `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge` 15 minutes,
  `secure: true` when `NODE_ENV=production`.
- Verification (`src/lib/jwt.ts`) restricts algorithms to HS256 and checks issuer, audience, expiry,
  and that `sub` is a UUID.
- `authenticate` uses the `Authorization: Bearer` header if present, otherwise the cookie. It sets
  `req.user = { id }` and does not query the database. Any failure returns a generic 401.
- `GET /me` loads the user from the database and returns 401 if the account no longer exists.
- Logout clears the cookie (matching attributes). The endpoint does not require authentication.

### Password hashing

- Argon2id via `argon2`: memoryCost 19456 KiB, timeCost 2, parallelism 1 (`src/lib/password.ts`).
- Login verifies with `argon2.verify`. For unknown emails it verifies against a dummy hash so timing is similar.
- Registration hashes the password before the insert.

### API endpoints

All responses use `{ data, error, message }`. Register and login also send `Set-Cookie: cv_token=...`.
The token is not in the response body.

#### POST /api/auth/register
Request: `{ "username": "alice", "email": "user@example.com", "password": "secret123" }`
Response (201): `{ "data": { "user": { "id": "<uuid>", "username": "alice", "email": "user@example.com", "createdAt": "<ISO>" }, "expiresIn": 900 }, "error": null, "message": "Registration successful" }`

#### POST /api/auth/login
Request: `{ "email": "user@example.com", "password": "secret123" }`
Response (200): same shape as register, message "Login successful".

#### POST /api/auth/logout
Response (200): `{ "data": null, "error": null, "message": "Logged out" }`

#### GET /api/auth/me
Response (200): `{ "data": { "user": { ...same user fields } }, "error": null, "message": "Success" }`

#### Error responses (current behaviour)
| Status | error.code | When |
|---|---|---|
| 400 | VALIDATION_ERROR | Zod failure; `details: [{ field, message }]` |
| 400 | INVALID_JSON | Malformed JSON body |
| 401 | INVALID_CREDENTIALS | Wrong email or password (same message for both) |
| 401 | UNAUTHORIZED | Missing, expired or invalid token |
| 409 | EMAIL_ALREADY_REGISTERED | Duplicate email on register. **Discrepancy D1: violates REQ-AUTH-001.** |
| 413 | PAYLOAD_TOO_LARGE | Body over 10 KB |
| 500 | INTERNAL_ERROR | Unexpected error; no internals exposed |

### Zod validation (`src/schemas/auth.schemas.ts`)

- register: `username` trimmed, 3–100, `/^[A-Za-z0-9_.-]+$/`; `email` trimmed, lowercased, valid, max 255;
  `password` 8–128 characters.
- login: `email` (same normalization); `password` 1–128 characters.

### Frontend

- `app/plugins/auth.ts` restores the user on first load via `useAuth().fetchUser()` (`GET /api/auth/me`).
- `app/services/api.ts` sends `credentials: 'include'` and forwards the incoming cookie during SSR.
- Pages: `app/pages/login.vue` and `app/pages/register.vue`.
- The register page displays the server's error message, so it currently shows the duplicate-email message.

## Known discrepancies and outstanding work

### D1. Duplicate-email registration reveals that the email exists (not satisfied; fix not yet implemented)

- Requirement: REQ-AUTH-001 (unchanged).
- Current: a unique-violation on `email` becomes `409 EMAIL_ALREADY_REGISTERED`.
- Impact: lets anyone test whether an email has an account (account enumeration).
- Constraints any fix must meet:
  - The response for an already-registered email must not be distinguishable from a normal registration outcome
    by status, body or headers.
  - The caller must never be authenticated as the existing account (no cookie issued for it).
  - The unique-violation race (two simultaneous registrations) must be handled the same way.
  - Hashing before the lookup/insert (already the case) should be kept so timing stays similar.
- Open design tension: REQ-AUTH-001 also says a successful registration logs the user in immediately. A duplicate
  cannot be logged in, so the two outcomes differ by the presence of the cookie. Resolving this needs a
  decision (see tasks: TASK-AUTH-022). The approach is not decided.
- Work: TASK-AUTH-022 (backend), TASK-AUTH-023 (tests), TASK-AUTH-024 (frontend).

### D2. Stateless logout (accepted MVP limitation, not a defect)

- Logout clears the cookie only. A copied token works until expiry (max 15 minutes), including through the
  `Authorization: Bearer` header.
- Revocation/denylist and refresh tokens are out of scope for the MVP.

### D3. `Authorization: Bearer` is accepted in addition to the cookie

- Current behaviour, used by API clients and tests. It is not part of the confirmed cookie architecture.
  Whether to keep it is an open decision.

### D4. `authenticate` does not check that the user still exists

- Only `GET /me` queries the database. For other protected routes a token for a deleted account stays valid until
  it expires. Account deletion is out of scope for the MVP.

### D5. Frontend route guard and login redirect are not implemented

- `app/middleware/auth.ts` does not exist (REQ-AUTH-007). Login always navigates to `/catalog` instead of the
  originally requested page.

### D6. Login and registration rate limits (TASK-AUTH-025)

**Code:** `src/middleware/authRateLimit.ts`, run after `validateBody` (so the email is normalized) and before any password hashing.

**Login, `POST /api/auth/login`:**
- Defaults: 30 failed logins per IP, and 10 failed logins per IP for one email address, each per 15-minute window.
- Every attempt is counted when it starts, so a parallel burst can't get past the limit. A 200 response gives the attempt back, so only failures use up the allowance.
- An attempt refused by the per-email limit does not use up the IP's shared allowance.
- A refused attempt runs no password check and issues no cookie, even with the correct password.

**Registration, `POST /api/auth/register`:** 10 attempts per IP per hour by default. Every attempt that passes validation counts, including a successful one and a duplicate email, because each one hashes a password and may create an account.

**Over a limit:** 429 `AUTH_RATE_LIMITED` with `Retry-After`, in the usual envelope. Both login limits give the same message, so the response doesn't say which applied. There are no `RateLimit-*` headers on auth routes.

**Not limited:**
- `POST /refresh` needs a 256-bit random token and runs no password check, and the app calls it on its own. Limiting it could sign out legitimate users.
- Logout and `/me` are cheap and need no credentials.
- Malformed requests (400) aren't counted; they never reach Argon2.
- There is no password reset or email verification.

**Protecting legitimate users:**
- There is no lockout and nothing permanent. Limits clear at the end of the window.
- The per-email limit is keyed by IP *and* email, never by email alone. Someone elsewhere sending a victim's address uses up only their own allowance, and the owner still logs in from their own IP.
- Successful logins don't count, so a busy shared network is limited only by its failures (30 per 15 minutes) and registrations (10 per hour).
- The trade-off: a password-guessing attack spread across many IPs is slowed per IP, not stopped. Argon2id's cost and the 15-minute window still bound it.

**Privacy:**
- Known and unknown addresses are counted and answered identically, so a 429 doesn't reveal which accounts exist.
- Emails are kept only as a SHA-256 digest with a random per-process salt.
- Nothing from the request body is logged.

**Client IP:** `req.ip` under `TRUST_PROXY_HOPS`, the same rule as the guest Community limit (discovery design D-DISC-8). Use 0 locally and 1 on Railway.

**Storage:** the existing in-memory fixed window (`lib/rateLimit.ts`, which gains `release`). Counts reset on restart, so a restart also clears an attacker's count, and they're per process. If Express is scaled to several instances, each counts separately. A shared store would be needed then, such as a PostgreSQL table with upserts or Redis. Neither is justified for one instance.

**Configuration:** `AUTH_LOGIN_IP_LIMIT`, `AUTH_LOGIN_ACCOUNT_LIMIT`, `AUTH_LOGIN_WINDOW_SECONDS` (60–86,400), `AUTH_REGISTER_IP_LIMIT`, `AUTH_REGISTER_WINDOW_SECONDS`. Invalid values stop the server at startup, like every other setting.

## Security notes

- Generic login failure message; the same 401 for wrong email and wrong password.
- Passwords and tokens are never logged or returned in response bodies.
- `userId` always comes from the verified token subject, never from request input.
- Login and registration are rate-limited per client IP (D6). Refresh tokens exist (`migrations/004`, see tech.md). There is no CSRF token beyond `SameSite=Lax`.
- Deployment-dependent settings that cannot be verified from source (real `JWT_SECRET` strength, `NODE_ENV` in
  production, database TLS, live schema) are not asserted here.
