# Authentication — Requirements

## Overview

CardVault requires user accounts to enforce data isolation. Each user's knowledge cards, collections, and tags are private and inaccessible to other users. Authentication is token-based: a short-lived JWT stored in an HttpOnly cookie, issued and verified entirely by the Express backend.

## Requirements

### REQ-AUTH-001: User Registration
- A new user can register with a username, an email address and a password.
- Username is 3–100 characters (letters, numbers, `_`, `.`, `-`).
- Email must be a valid format and unique across all accounts.
- Password must meet a minimum length of 8 characters.
- Passwords are stored as Argon2id hashes — never as plaintext.
- On success, the user is automatically logged in: the auth cookie is issued in the response.
- On failure (duplicate email, invalid input), a descriptive error is returned without revealing whether the email exists.

> **Implementation status: NOT SATISFIED.** The current implementation returns `409 EMAIL_ALREADY_REGISTERED`
> for a duplicate email, which reveals that the email is registered. The requirement above is unchanged.
> See `design.md` ("Known discrepancies") and TASK-AUTH-022.

### REQ-AUTH-002: User Login
- A registered user can log in with their email and password.
- On success, a JWT access token with a 15-minute lifetime is issued in the `cv_token` cookie: HttpOnly, SameSite=Lax, and Secure in production.
- On failure, a generic "invalid credentials" message is returned — do not distinguish between wrong email and wrong password.
- Failed login attempts must not reveal whether an account exists for the given email.

### REQ-AUTH-003: User Logout
- An authenticated user can log out.
- Logout clears the `cv_token` authentication cookie in the response.
- Authentication is stateless for the MVP: there is no server-side token revocation or denylist.
- **Known limitation:** a JWT copied before logout remains valid until it expires. Its maximum remaining lifetime is 15 minutes.

### REQ-AUTH-004: Session Validation
- Protected routes require a valid JWT (signature, expiry, issuer, audience; HS256 only).
- The `authenticate` middleware reads and verifies the token on every protected request.
- The authenticated `userId` is the verified token subject (`sub`) — never taken from the request body or query parameters.
- Missing, expired or invalid tokens return HTTP 401.

### REQ-AUTH-005: Account Isolation
- All data queries are scoped to the authenticated user's `userId`.
- A user cannot read, modify, or delete another user's cards, collections, or tags.
- Attempting to access another user's resource returns HTTP 403 or 404 — not the actual resource.

### REQ-AUTH-006: Account Information
- An authenticated user can retrieve their own account information (username, email, registration date).
- Users cannot retrieve or modify another user's account information.

### REQ-AUTH-007: Frontend Route Protection
- All pages except `/login` and `/register` require authentication.
- Unauthenticated users are redirected to `/login`.
- The Nuxt `auth` middleware handles this redirect client-side and server-side.
- After login, the user is redirected to the page they originally requested.

## Out of Scope

- Password reset and email verification (post-MVP).
- OAuth / social login (post-MVP).
- Multi-factor authentication (post-MVP).
- Account deletion (post-MVP).
- Role-based access control (not required — single user role).
- Server-side token revocation or denylist (post-MVP).
- Refresh tokens (post-MVP).
