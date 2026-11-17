# Catalog Management — Requirements

## Overview

Catalog management covers creating, reading, updating, and deleting knowledge cards, as well as organizing them into collections and tagging them. This is the core CRUD layer of CardVault.

## Knowledge Card Requirements

### REQ-CAT-001: Create a Card from Text
- An authenticated user can create a knowledge card by submitting raw text content.
- The submitted text is stored as the immutable original source content.
- An optional source URL may be provided at creation time.
- Title defaults to the first line of the content if not provided explicitly.
- Creating a card and processing its AI metadata are separate steps. Card creation saves the card and returns it without waiting for any AI operation, and it succeeds whether or not an AI integration is available or working.
- AI cataloging (catalog generation and embedding generation) is an intended capability of CardVault. It runs after the card is saved, asynchronously, and is tracked by two independent statuses (`ai_catalog_status` and `ai_embedding_status`). The initial values are defined in REQ-AI-001 and REQ-AI-012 of the AI Cataloging spec.
- Until the runtime AI integration is operational, new cards are saved without AI metadata (REQ-AI-012). It is not operational today: nothing is implemented yet.
- A failure of either AI operation never causes card creation to fail or roll back.
- Acceptance criteria:
  - AC-CAT-001-1: A create-from-text request returns the saved card, with its original text, without waiting for any AI operation to finish.
  - AC-CAT-001-2: With no AI integration available, creation succeeds, no AI request is made, and the response carries the AI statuses defined by REQ-AI-012.
  - AC-CAT-001-3: When an AI operation fails, the card remains saved, only that operation's status is `FAILED`, and the other status is unchanged.

### REQ-CAT-002: Create a Card from URL
- An authenticated user can create a card by providing a public URL.
- URL ingestion (content extraction, SSRF validation) is handled by a separate URL ingestion service — see the URL Ingestion spec.
- The extracted text and URL metadata are stored as the immutable original source content.
- AI processing of the new card follows REQ-CAT-001 and is separate from URL ingestion: the card is created once ingestion succeeds, whether or not AI processing succeeds.

### REQ-CAT-003: View Card List
- An authenticated user can retrieve a paginated list of their own knowledge cards. The default page size is 20 cards.
- Each item in the list includes: id, title, summary (if available), subjects, tags, collection, createdAt.
- Cards from other users are never returned.
- Supports filtering by collection, tag, and a keyword search parameter.
- Cards are sorted newest first (`createdAt` descending) by default.
- The response includes the total number of cards matching the applied filters, alongside the current page of results.
- Filters are applied before pagination and before the total is calculated.
- Both the returned cards and the total are scoped to the authenticated user.

**Acceptance criteria**

Pagination
- AC-CAT-003-1: A request with no pagination parameters returns at most 20 cards.
- AC-CAT-003-2: If the user has more than 20 matching cards, the first page contains exactly 20 and the next page contains the remaining cards, with no card repeated or skipped across pages.
- AC-CAT-003-3: If the user has no matching cards, the response contains an empty list and a total of 0.

Sorting
- AC-CAT-003-4: With no sort specified, each card's `createdAt` is the same as or later than the next card's in the list.
- AC-CAT-003-5: **[Assumption]** When two cards share the same `createdAt`, their relative order is the same on every request (ties are broken by a stable secondary key such as `id`).

Total count
- AC-CAT-003-6: With no filters, the total equals the number of cards the user owns, regardless of how many are on the current page.
- AC-CAT-003-7: With a collection, tag, or keyword filter applied, the total equals the number of cards matching that filter, not the user's overall card count.
- AC-CAT-003-8: The total is the same on every page of the same filtered query.

Filter order
- AC-CAT-003-9: Given 30 matching cards among 100 owned, a request for page 1 returns 20 cards, all matching the filter, with a total of 30. Page 2 returns the remaining 10 matching cards.
- AC-CAT-003-10: A filter never causes non-matching cards to appear because they fell on the requested page.

User scoping
- AC-CAT-003-11: If User A owns 5 cards and User B owns 3, User A receives only their 5 cards with a total of 5, and User B receives only their 3 with a total of 3.
- AC-CAT-003-12: Filtering by a collection or tag with User A's request never returns or counts User B's cards, even when User B has a collection or tag with the same name.
- AC-CAT-003-13: A request without a valid authenticated session returns HTTP 401 and no card data or count.

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
