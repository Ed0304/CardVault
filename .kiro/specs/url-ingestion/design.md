# URL Ingestion — Design (implemented)

## Architecture

```
Nuxt  ──POST /api/cards/from-url { url }──▶  Express
                                               cardController.createFromUrl
                                                 1. authenticate; per-user hourly limit (429)
                                                 2. urlIngestionService.ingestUrl
                                                    a. validate URL: http/https, ports 80/443,
                                                       no credentials (400)
                                                    b. fetch with the address checked inside the
                                                       socket's DNS lookup (422 SSRF_BLOCKED)
                                                    c. ≤ 3 redirects, each re-validated
                                                    d. 200 only; HTML content types only
                                                    e. byte limit on transferred and decoded body
                                                    f. decode charset; extract text and metadata
                                                 3. cardService.createCard (source layer + meta)
Nuxt  ◀── 201 card (private, AI statuses NOT_AVAILABLE) ──
```

AI cataloging is not part of ingestion. The owner requests it afterwards from the card page (AI Cataloging REQ-AI-001). The fetched text reaches Muse only inside the delimited prompt (REQ-URL-010).

## Server-Side Request Forgery Protection

| Control | Implementation |
|---|---|
| Scheme | `http:` and `https:` only (`INVALID_SCHEME`, 400) |
| Port | 80 and 443 only (`UNSUPPORTED_PORT`, 400). Stops CardVault being used to probe other services on public hosts |
| Credentials | `user:pass@` URLs rejected (`INVALID_URL`, 400) |
| Address policy | `src/lib/networkPolicy.ts`: an **allowlist** of globally routable unicast addresses (`ipaddr.js` `range() === "unicast"` after unwrapping IPv4-mapped IPv6). Blocks everything in the original blocklist, plus carrier-grade NAT, multicast, broadcast, reserved, documentation, IPv6 unique-local (including Railway's `fd12:…` private network), and the 6to4, NAT64 and Teredo ranges |
| DNS rebinding | The check runs inside the `lookup` function that the socket uses, so the address that is checked is the address that is connected to. If any resolved address is not allowed, the request is refused. IP literals are checked before connecting (Node skips the lookup for them) |
| Redirects | Manual. Each `Location` is resolved and validated like a submitted URL, then fetched through the same guarded lookup. A fourth redirect gives `TOO_MANY_REDIRECTS` (422); an invalid target gives `REDIRECT_NOT_ALLOWED` (422) |
| Connections | `agent: false` (no pooled sockets), no proxy |

The original design checked DNS with `dns.lookup` and then fetched. That leaves a gap between the check and the connection, which a hostname switching from a public to a private address could exploit. It was replaced by the guarded lookup above.

## Request Controls

| Control | Value |
|---|---|
| Deadline | `URL_FETCH_TIMEOUT_MS` (10,000): one deadline covering every redirect and the body (`FETCH_TIMEOUT`, 422) |
| Size | `URL_FETCH_MAX_BYTES` (5 MB) on both the transferred and the decompressed body, so a compressed "bomb" is stopped; a larger declared `Content-Length` is refused before reading (`RESPONSE_TOO_LARGE`, 422) |
| Encodings | gzip, deflate and br decoded; other encodings refused |
| Status | 200 only (`FETCH_FAILED`, 422, names the status) |
| Content type | `text/html` and `application/xhtml+xml` only; a missing type is refused (`UNSUPPORTED_CONTENT_TYPE`, 422) |
| User-Agent | `CardVault/1.0 (+https://github.com/Ed0304/CardVault; knowledge-card ingestion)` |
| Rate limit | `URL_INGEST_HOURLY_LIMIT` (30) pages per user per hour, in memory (`URL_RATE_LIMITED`, 429 with `Retry-After`) |
| Logging | Error class or code only; never the URL or page content |

## Extraction (`src/lib/pageExtraction.ts`)

- Charset from the `Content-Type` header, else a `<meta charset>` in the first 4 KB, else UTF-8.
- `jsdom` with its defaults (scripts not run, no subresources loaded) and a silent virtual console; `@mozilla/readability` on a copy of the document.
- Plain text built from the article's DOM, keeping paragraph breaks and list items (`- `). Scripts, styles, forms and embedded content are skipped. When Readability finds less than 200 characters, the whole body is used instead, without navigation, header, footer and aside.
- Control characters (including U+0000, which PostgreSQL rejects) are removed. No HTML is stored.
- Less than 50 non-space characters gives `EXTRACTION_FAILED` (422; for example pages that need JavaScript).
- Text longer than 100,000 characters (`MAX_SOURCE_TEXT_LENGTH`) is cut at a word boundary and `sourceMeta.truncated` is set.

## Stored Card

- `source_url`: the URL the user submitted (fragment removed).
- `source_title`: Readability title, else `og:title`, else `<title>` (≤ 300 characters); without one the card uses its first line.
- `source_meta` (JSONB): `siteName`, `author`, `publishedAt` (ISO), `canonicalUrl` (http/https only), `finalUrl` (after redirects), `fetchedAt`, `truncated`. Set only by the server; the text endpoint's schema has no such field.
- Visibility `PRIVATE`; both AI statuses `NOT_AVAILABLE`.

## API

`POST /api/cards/from-url` with body `{ "url": "…" }` (1–2,048 characters) returns 201 with the card. The error envelope is the standard one: `{ "data": null, "error": { "code": "SSRF_BLOCKED" }, "message": "…" }`.

| Code | Status |
|---|---|
| `VALIDATION_ERROR` | 400 (missing, empty or over-long `url`) |
| `INVALID_URL`, `INVALID_SCHEME`, `UNSUPPORTED_PORT` | 400 |
| `SSRF_BLOCKED`, `REDIRECT_NOT_ALLOWED`, `TOO_MANY_REDIRECTS` | 422 |
| `FETCH_TIMEOUT`, `FETCH_FAILED`, `RESPONSE_TOO_LARGE` | 422 |
| `UNSUPPORTED_CONTENT_TYPE`, `EXTRACTION_FAILED` | 422 |
| `SITE_BLOCKED` (403, 429, 503 from Cloudflare/Akamai/Sucuri/DDoS-Guard, or a 200 challenge page), `LOGIN_REQUIRED` (401, 407) | 422 |
| `URL_RATE_LIMITED` | 429 |

Every message is written for the user; the frontend shows it as is.

## Frontend

- `pages/catalog/create.vue`: the "From URL" tab explains what is saved and what can't be read; the button reads "Reading the page…" while waiting; server messages are shown in the existing error alert.
- `pages/catalog/[id].vue`: source metadata with readable labels (Site, Author, Published, Saved from the web, Canonical address, Read from) and links; a notice when the text was cut.

## Known Limits

- Parsing runs on the Express event loop. Pages up to the 5 MB limit can take a moment to parse; the rate limit bounds the abuse. Moving extraction to a worker thread is a future option.
- Pages rendered by JavaScript, behind logins, or behind bot protection cannot be read.
