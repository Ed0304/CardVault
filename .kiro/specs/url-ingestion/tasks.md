# URL Ingestion — Tasks

## Express Backend

- [ ] **TASK-URL-001** Add `@mozilla/readability`, `jsdom`, and `ipaddr.js` to `backend/expressjs/package.json` dependencies (install when ready to implement).
- [ ] **TASK-URL-002** Create `src/schemas/cards.schemas.ts` — add `createCardFromUrlSchema` with `z.string().url().max(2048)`.
- [ ] **TASK-URL-003** Create `src/services/urlIngestionService.ts` — implement `ingestUrl(rawUrl)` with all SSRF protections, fetch controls, and content extraction.
- [ ] **TASK-URL-004** Implement `isBlockedIp(ip)` helper using `ipaddr.js` — block loopback, private, and link-local ranges for both IPv4 and IPv6.
- [ ] **TASK-URL-005** Implement redirect re-validation in `urlIngestionService` — re-check scheme and IP on every redirect; reject after 3 redirects.
- [ ] **TASK-URL-006** Implement content extraction using `@mozilla/readability` and `jsdom` — extract `textContent`, `title`, `byline`, `siteName`.
- [ ] **TASK-URL-007** Implement Content-Type validation — reject non-HTML responses before attempting extraction.
- [ ] **TASK-URL-008** Implement response-size limit — abort the fetch if the response body exceeds 5 MB.
- [ ] **TASK-URL-009** Map all internal `IngestionError` codes to the correct HTTP status codes in `errorHandler.ts`.
- [ ] **TASK-URL-010** Add `POST /api/cards/from-url` to `src/routes/cards.routes.ts` (and its controller) — validate with `createCardFromUrlSchema`, call `urlIngestionService.ingestUrl`, then `cardService.createCard`. Respond `201` as soon as the card is saved; do not wait for AI processing (REQ-URL-011).

## Frontend

- [ ] **TASK-URL-011** Update `app/pages/catalog/create.vue` (the "From URL" tab already exists in the scaffold) — URL input field, a loading indicator that covers fetching and card creation only (not AI processing), and error message display.
- [ ] **TASK-URL-012** Ensure `app/composables/useCatalog.ts` exposes `createCardFromUrl(url: string)` calling `POST /api/cards/from-url`. The function already exists in the scaffold; the endpoint does not.
- [ ] **TASK-URL-013** Map known error codes (`SSRF_BLOCKED`, `UNSUPPORTED_CONTENT_TYPE`, `FETCH_TIMEOUT`, etc.) to user-friendly messages in the From URL form.
