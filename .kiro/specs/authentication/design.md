# Authentication — Design

## Architecture

```
Nuxt Frontend
    │  Cookie (HttpOnly, Secure, SameSite=Strict)
    ▼
Express Backend
    ├── POST /api/auth/register
    ├── POST /api/auth/login
    ├── POST /api/auth/logout
    └── GET  /api/auth/me
    │
    ▼
PostgreSQL (users table via Prisma)
```

## Database Schema

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  displayName  String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  cards        KnowledgeCard[]
  collections  Collection[]
  tags         Tag[]
}
```

## Session Strategy

- Use `express-session` with a PostgreSQL session store (e.g., `connect-pg-simple`).
- Session ID stored in a signed, HttpOnly cookie.
- `req.session.userId` is set on login and cleared on logout.
- The `authenticate` middleware reads `req.session.userId` — rejects if absent or invalid.

## Password Hashing

- Use `bcrypt` with a cost factor of 12.
- Hash on registration; compare on login using `bcrypt.compare`.

## API Endpoints

### POST /api/auth/register
Request:
```json
{ "email": "user@example.com", "password": "secret123", "displayName": "Alice" }
```
Response (201):
```json
{ "data": { "id": "...", "email": "user@example.com", "displayName": "Alice" }, "error": null, "message": "Account created" }
```

### POST /api/auth/login
Request:
```json
{ "email": "user@example.com", "password": "secret123" }
```
Response (200):
```json
{ "data": { "id": "...", "email": "user@example.com", "displayName": "Alice" }, "error": null, "message": "Logged in" }
```

### POST /api/auth/logout
Response (200):
```json
{ "data": null, "error": null, "message": "Logged out" }
```

### GET /api/auth/me
Response (200):
```json
{ "data": { "id": "...", "email": "user@example.com", "displayName": "Alice", "createdAt": "..." }, "error": null, "message": "OK" }
```

## Zod Validation Schemas

```typescript
// src/schemas/auth.ts
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100).optional(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
```

## Nuxt Auth Middleware

```typescript
// app/middleware/auth.ts
export default defineNuxtRouteMiddleware(() => {
  const { user } = useAuth()
  if (!user.value) {
    return navigateTo('/auth/login')
  }
})
```

The `useAuth` composable calls `GET /api/auth/me` on app load and caches the result. A null response means unauthenticated.

## Security Notes

- Generic error messages on login failure — never "email not found" vs "wrong password".
- Session cookie attributes: `httpOnly: true`, `secure: true` (production), `sameSite: 'strict'`.
- Passwords never logged or included in API responses.
- `userId` for all data operations comes from `req.session.userId`, not from request body.
