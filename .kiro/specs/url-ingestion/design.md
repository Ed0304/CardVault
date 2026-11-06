# URL Ingestion — Design

## Architecture

```
Nuxt Frontend
    │  POST /api/cards/from-url { url }
    ▼
Express — urlIngestionService
    ├── 1. Validate URL scheme (HTTP/HTTPS only)
    ├── 2. Resolve DNS → validate IP (SSRF blocklist)
    ├── 3. Fetch HTML (timeout 10s, max 5 MB, follow ≤3 redirects with re-validation)
    ├── 4. Validate Content-Type (HTML only)
    ├── 5. Extract text and metadata
    ├── 6. Sanitize extracted content
    └── 7. Return { sourceText, sourceUrl, sourceTitle, sourceMeta }
    │
    ▼
cardService.createCard (stores immutable source, triggers AI)
```

## API Endpoint

### POST /api/cards/from-url
Request:
```json
{ "url": "https://example.com/article" }
```
Response (201) — same shape as a regular card create response.

Error response (422):
```json
{
  "data": null,
  "error": "SSRF_BLOCKED",
  "message": "The URL resolves to a private or reserved IP address."
}
```

## URL Ingestion Service

```typescript
// src/services/urlIngestionService.ts

interface IngestionResult {
  sourceText: string
  sourceUrl: string
  sourceTitle: string | null
  sourceMeta: {
    author: string | null
    publishedAt: string | null
    siteName: string | null
    canonicalUrl: string | null
  }
}

async function ingestUrl(rawUrl: string): Promise<IngestionResult>
```

### Validation Steps

```typescript
// Step 1: Parse and validate scheme
const parsed = new URL(rawUrl)
if (!['http:', 'https:'].includes(parsed.protocol)) {
  throw new IngestionError('INVALID_SCHEME', 'Only HTTP and HTTPS URLs are supported.')
}

// Step 2: Resolve IP and check SSRF blocklist
const ip = await dns.lookup(parsed.hostname)
if (isBlockedIp(ip.address)) {
  throw new IngestionError('SSRF_BLOCKED', 'The URL resolves to a private or reserved IP address.')
}

// Step 3: Fetch with controls
// - timeout: 10_000ms
// - maxRedirects: 3 (re-validate each redirect target)
// - maxResponseSize: 5 * 1024 * 1024 bytes
// - User-Agent: 'CardVault/1.0 (+https://github.com/your-repo)'

// Step 4: Validate Content-Type
if (!contentType.includes('text/html')) {
  throw new IngestionError('UNSUPPORTED_CONTENT_TYPE', 'Only HTML pages are supported.')
}
```

### SSRF Blocklist Helper

```typescript
function isBlockedIp(ip: string): boolean
// Returns true for:
// IPv4: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
// IPv6: ::1, fe80::/10, ::
```

Use the `ipaddr.js` library for CIDR range matching.

### Content Extraction

Use the `@mozilla/readability` package (Node.js port) combined with `jsdom` for HTML parsing and readable content extraction:

```typescript
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

const dom = new JSDOM(html, { url: resolvedUrl })
const reader = new Readability(dom.window.document)
const article = reader.parse()
// article.textContent, article.title, article.byline, article.siteName
```

Sanitize `article.textContent` — strip any remaining HTML tags using a plain text extraction pass.

## Zod Validation Schema

```typescript
// src/schemas/cards.ts
export const createCardFromUrlSchema = z.object({
  url: z.string().url().max(2048),
})
```

## Error Types

| Error Code | HTTP Status | Meaning |
|---|---|---|
| `INVALID_SCHEME` | 400 | Non-HTTP/HTTPS scheme |
| `INVALID_URL` | 400 | Malformed URL |
| `SSRF_BLOCKED` | 422 | Resolved IP in blocked range |
| `TOO_MANY_REDIRECTS` | 422 | Redirect limit exceeded |
| `FETCH_TIMEOUT` | 422 | Request timed out |
| `UNSUPPORTED_CONTENT_TYPE` | 422 | Not an HTML page |
| `EXTRACTION_FAILED` | 422 | No usable text extracted |
| `RESPONSE_TOO_LARGE` | 422 | Response exceeds 5 MB |

## Frontend

- `app/pages/cards/new.vue` includes a "From URL" tab with a URL input field and submit button.
- On submission, calls `POST /api/cards/from-url`.
- Displays a loading state during ingestion (fetching + AI cataloging can take several seconds).
- Maps known error codes to user-friendly messages.
