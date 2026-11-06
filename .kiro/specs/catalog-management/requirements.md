# Catalog Management — Requirements

## Overview

Catalog management covers creating, reading, updating, and deleting knowledge cards, as well as organizing them into collections and tagging them. This is the core CRUD layer of CardVault.

## Knowledge Card Requirements

### REQ-CAT-001: Create a Card from Text
- An authenticated user can create a knowledge card by submitting raw text content.
- The submitted text is stored as the immutable original source content.
- An optional source URL may be provided at creation time.
- Title defaults to the first line of the content if not provided explicitly.
- On creation, Express triggers AI cataloging asynchronously — card creation must not block on AI availability.

### REQ-CAT-002: Create a Card from URL
- An authenticated user can create a card by providing a public URL.
- URL ingestion (content extraction, SSRF validation) is handled by a separate URL ingestion service — see the URL Ingestion spec.
- The extracted text and URL metadata are stored as the immutable original source content.

### REQ-CAT-003: View Card List
- An authenticated user can retrieve a paginated list of their own knowledge cards.
- Each item in the list includes: id, title, summary (if available), subjects, tags, collection, createdAt.
- Cards from other users are never returned.
- Supports filtering by collection, tag, and a keyword search parameter.

### REQ-CAT-004: View Card Detail
- An authenticated user can retrieve the full detail of one of their cards.
- Response includes all three information layers: original source, personal notes, and AI catalog metadata.
- Attempting to access another user's card returns HTTP 404.

### REQ-CAT-005: Edit Personal Notes
- An authenticated user can add or update the personal notes on any of their cards.
- Editing notes does not modify the original source content or trigger AI re-cataloging.

### REQ-CAT-006: Edit AI Metadata
- An authenticated user can edit the AI-generated summary, subjects, and keywords on their cards.
- Editing AI metadata does not modify the original source content or personal notes.
- Editing AI metadata does not trigger re-generation.

### REQ-CAT-007: Delete a Card
- An authenticated user can delete one of their knowledge cards.
- Deletion is permanent and removes all associated data including embeddings.
- A confirmation step must be presented in the UI before deletion.

### REQ-CAT-008: Collections
- An authenticated user can create, rename, and delete collections.
- Cards can be assigned to at most one collection.
- Deleting a collection does not delete its cards — they become uncollected.

### REQ-CAT-009: Tags
- An authenticated user can create and delete tags.
- A card can have multiple tags.
- Tags are user-scoped — one user's tags are not visible to another.
- Deleting a tag removes it from all cards it was applied to.

### REQ-CAT-010: Data Integrity
- Original source content is immutable after the card is created.
- AI metadata fields are independent of source content and personal notes.
- All three layers can be null or empty independently without breaking the card record.

## Out of Scope

- Shared or collaborative cards.
- Card versioning or edit history.
- Bulk import or export.
- Card templates.
