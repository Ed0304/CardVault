# URL Ingestion — Requirements

## Overview

URL ingestion allows users to create a knowledge card by providing a public URL. CardVault fetches the page, extracts the readable text content and metadata, stores it as the immutable original source, and then triggers AI cataloging. Because URL fetching involves user-supplied input and outbound HTTP requests, security controls are mandatory.

## Requirements

### REQ-URL-001: URL Input
- An authenticated user can submit a public HTTP or HTTPS URL to create a card.
- Only HTTP and HTTPS schemes are permitted. All other schemes (ftp, file, javascript, data, etc.) must be rejected with HTTP 400.

### REQ-URL-002: SSRF Prevention — Scheme Validation
- The URL scheme must be validated before any DNS resolution or connection attempt.
- Non-HTTP/HTTPS schemes are rejected immediately.

### REQ-URL-003: SSRF Prevention — IP Address Validation
- After DNS resolution, the resolved IP address must be checked against a blocklist.
- Blocked ranges: loopback (127.0.0.0/8, ::1), private networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), link-local (169.254.0.0/16, fe80::/10), and the IPv6 unspecified address.
- If the resolved IP falls within a blocked range, the request must be rejected with HTTP 422.

### REQ-URL-004: SSRF Prevention — Redirect Validation
- If the server returns an HTTP redirect, the redirect target URL must be re-validated (scheme and IP) before following.
- A maximum of 3 redirects are followed. Exceeding this limit returns HTTP 422.

### REQ-URL-005: Request Controls
- Each outbound URL fetch has a timeout of 10 seconds.
- The response body size is limited to 5 MB. Responses exceeding this limit are truncated or rejected.
- A descriptive User-Agent header is sent identifying CardVault as the requester.

### REQ-URL-006: Content Extraction
- Readable text content is extracted from the HTML response using a purpose-built extraction library (e.g., `readability-lxml` or equivalent).
- Extracted content must be treated as untrusted input — sanitize before storage.
- The raw HTML is not stored — only the extracted text.
- Source metadata extracted where available: page title, author, publication date, site name, canonical URL.

### REQ-URL-007: Source Preservation
- The extracted text, source URL, and source metadata are stored as the immutable original source layer of the card.
- The submitted URL is stored even if content extraction partially fails, as long as some text was retrieved.

### REQ-URL-008: Extraction Failure Handling
- If the URL is unreachable, returns a non-200 status, or extraction produces no usable text, the card creation must fail with an informative error message.
- Partial extraction (text retrieved but metadata missing) is acceptable — missing fields default to null.

### REQ-URL-009: Content Type Validation
- Only HTML content types are supported for text extraction.
- Non-HTML responses (PDF, images, binary files) must be rejected with a clear error message.
- Checking the `Content-Type` response header is sufficient for this validation.

### REQ-URL-010: Untrusted Content Handling
- Extracted webpage text must not be passed directly into privileged AI prompts without sanitization and delimiting.
- See the AI Cataloging spec for prompt injection prevention requirements.

## Out of Scope

- PDF text extraction (post-MVP).
- Authenticated or paywalled URLs.
- Web crawling or link following.
- Scheduled re-fetching or content updates.
- JavaScript rendering (fetching server-rendered HTML only).
