# Authentication — Requirements

## Overview

CardVault requires user accounts to enforce data isolation. Each user's knowledge cards, collections, and tags are private and inaccessible to other users. Authentication is session-based, managed entirely by the Express backend.

## Requirements

### REQ-AUTH-001: User Registration
- A new user can register with an email address and password.
- Email must be a valid format and unique across all accounts.
- Password must meet a minimum length of 8 characters.
- Passwords are stored as salted hashes — never as plaintext.
- On success, the user is automatically logged in and a session is created.
- On failure (duplicate email, invalid input), a descriptive error is returned without revealing whether the email exists.

### REQ-AUTH-002: User Login
- A registered user can log in with their email and password.
- On success, a secure session cookie is issued (HttpOnly, Secure, SameSite=Strict).
- On failure, a generic "invalid credentials" message is returned — do not distinguish between wrong email and wrong password.
- Failed login attempts must not reveal whether an account exists for the given email.

### REQ-AUTH-003: User Logout
- An authenticated user can log out.
- The server invalidates the session on logout.
- The session cookie is cleared in the response.

### REQ-AUTH-004: Session Validation
- Protected routes require a valid session.
- The `authenticate` middleware reads and validates the session on every protected request.
- The authenticated `userId` is derived from the verified session — never from the request body or query parameters.
- Expired or invalid sessions return HTTP 401.

### REQ-AUTH-005: Account Isolation
- All data queries are scoped to the authenticated user's `userId`.
- A user cannot read, modify, or delete another user's cards, collections, or tags.
- Attempting to access another user's resource returns HTTP 403 or 404 — not the actual resource.

### REQ-AUTH-006: Account Information
- An authenticated user can retrieve their own account information (email, display name, registration date).
- Users cannot retrieve or modify another user's account information.

### REQ-AUTH-007: Frontend Route Protection
- All pages except `/auth/login` and `/auth/register` require authentication.
- Unauthenticated users are redirected to `/auth/login`.
- The Nuxt `auth` middleware handles this redirect client-side and server-side.
- After login, the user is redirected to the page they originally requested.

## Out of Scope

- Password reset and email verification (post-MVP).
- OAuth / social login (post-MVP).
- Multi-factor authentication (post-MVP).
- Account deletion (post-MVP).
- Role-based access control (not required — single user role).
