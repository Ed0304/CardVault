# URL Ingestion — Tasks

> Verification for ticked tasks: `tests/networkPolicy.test.ts` (29 tests) and `tests/urlIngestion.integration.test.ts` (41 tests, isolated `cardvault_test` database and a local web server). The full backend suite passes (213 tests), as do the typecheck, the production `tsc` build and the frontend production build. An end-to-end run through the production Nuxt proxy against real sites passed: a Wikipedia article, example.com, cloud metadata, localhost, a Railway private host, a PDF and a 404.

## Express Backend

- [x] **TASK-URL-001** Add `@mozilla/readability` (0.6.0), `jsdom` (31.0.1), `ipaddr.js` (2.5.0) and `@types/jsdom` (pinned).
- [x] **TASK-URL-002** `createCardFromUrlSchema` in `src/schemas/cards.schemas.ts` (presence and length; the service returns the specific URL error codes).
- [x] **TASK-URL-003** `src/services/urlIngestionService.ts` — `ingestUrl` with URL validation, guarded fetch, request controls and extraction.
- [x] **TASK-URL-004** `isPublicAddress` in `src/lib/networkPolicy.ts` — allowlist of public unicast addresses (stricter than the original blocklist).
- [x] **TASK-URL-005** Redirect re-validation, at most 3 redirects.
- [x] **TASK-URL-006** Extraction with Readability and jsdom in `src/lib/pageExtraction.ts`, with plain-text conversion and metadata.
- [x] **TASK-URL-007** Content-type validation before reading the body.
- [x] **TASK-URL-008** Size limit on the transferred and decoded body, and on a declared `Content-Length`.
- [x] **TASK-URL-009** Error codes and statuses (raised as `AppError`, handled by the existing `errorHandler.ts`).
- [x] **TASK-URL-010** `POST /api/cards/from-url` (route, controller with a per-user hourly limit), `createCard` stores `source_meta`; 201 as soon as the card is saved.
- [x] **TASK-URL-014** DNS-rebinding protection: the address check runs inside the socket's lookup.
- [x] **TASK-URL-015** Tests: input validation, ten SSRF cases under the production policy, extraction and metadata, redirects, redirect re-validation, content types, 404, empty pages, three size cases, two timeout cases, unreachable host, gzip and Latin-1, truncation, rate limit, and the server-only `sourceMeta`.

## Frontend

- [x] **TASK-URL-011** `pages/catalog/create.vue` — URL field hint, "Reading the page…" loading state, server error messages; accurate "What happens next" copy (owner-requested Muse cataloging).
- [x] **TASK-URL-012** `useCatalog.createCardFromUrl` calls `POST /api/cards/from-url` (already present).
- [x] **TASK-URL-013** Error messages: written for users on the server and shown as is.
- [x] **TASK-URL-016** `pages/catalog/[id].vue` — labelled source metadata with links, and a truncation notice.

- [x] **TASK-URL-020** Explain refusals (REQ-URL-008a): `LOGIN_REQUIRED`, `SITE_BLOCKED` (403, 429, protected 503, 200 challenge pages), clearer 404; no circumvention. "Paste the text instead" on the create page keeps the URL as the source. Verified by 7 new cases in `tests/urlIngestion.integration.test.ts` (248 backend tests pass), the frontend build, and a live probe: Namu Wiki → `SITE_BLOCKED`; Know Your Meme and Wikipedia saved normally from a home connection.

- [x] **TASK-URL-021** MediaWiki API fallback for refused `/wiki/` pages (REQ-URL-008a): `/w/api.php` then `/api.php`, `action=parse`, same guarded fetch; `retrievedVia` in source metadata and on the card page. Verified by 9 new integration tests (256 backend tests pass) and live: Bulbapedia's Scream Tail article (blocked page, API 200, 13,981 characters), Fandom's Jigglypuff article, and a missing page reported as not found.

## Remaining

- [ ] **TASK-URL-017** Manual browser check of the From URL flow.
- [ ] **TASK-URL-018** Deploy the Express changes to Railway (needs approval). No migration is needed: `source_meta` already exists.
- [ ] **[FUTURE]** **TASK-URL-019** Run extraction in a worker thread so large pages never block the event loop.
