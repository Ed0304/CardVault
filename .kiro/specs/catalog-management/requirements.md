# Catalog Management — Requirements

## Overview

Catalog management covers creating, reading, updating, and deleting knowledge cards, organizing them into collections and tagging them, and the Community Catalog: publishing cards, discovering published cards, and saving independent copies (REQ-CAT-011 to REQ-CAT-014). This is the core CRUD layer of CardVault.

## Knowledge Card Requirements

### REQ-CAT-001: Create a Card from Text
- An authenticated user can create a knowledge card by submitting raw text content.
- The submitted text is stored as the immutable original source content.
- An optional source URL may be provided at creation time.
- Title defaults to the first line of the content if not provided explicitly.
- Creating a card and processing its AI metadata are separate steps. Card creation saves the card and returns it without waiting for any AI operation, and it succeeds whether or not an AI integration is available or working.
- AI cataloging is requested by the owner after the card is saved (AI Cataloging REQ-AI-001) and is tracked by two independent statuses (`ai_catalog_status` and `ai_embedding_status`). New cards are saved without AI metadata, with both statuses `NOT_AVAILABLE` (REQ-AI-012).
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
- Each item also includes its visibility and, for saved copies, its provenance (REQ-CAT-013).
- Cards from other users are never returned, even when they are published. Published cards of other users are reached through the Community Catalog (REQ-CAT-012), and copies saved from it are the saver's own cards.
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

## Community Catalog Requirements

CardVault has three connected experiences: **My Vault** (the user's own cards, private by default), the **Community Catalog** (cards their owners published), and **public card detail** (one published card with a Save to My Vault action). The Community Catalog is not a social feed.

### REQ-CAT-011: Publishing and Visibility
- Every card has a visibility: `PRIVATE` or `PUBLIC`. New cards, and every card that existed before this feature, are `PRIVATE`.
- Only the owner can publish or unpublish a card. Another user's attempt returns HTTP 404 and changes nothing.
- Publishing is an explicit action with a confirmation step in the UI that lists what becomes public and what stays private.
- When publishing, the owner states whether the original source text is included. The API requires this choice (`shareSourceText`); there is no default. The UI leaves it unticked.
- Unpublishing makes the card private again and clears the source-text choice, so publishing again needs a fresh choice.
- The owner views and edits their card through the vault endpoints whatever its visibility.
- Cards saved from the Community Catalog cannot be published (HTTP 409 `SAVED_COPY_NOT_PUBLISHABLE`). This keeps the original author's card as the public one. **[Decision for this milestone; can be revisited.]**
- Acceptance criteria:
  - AC-CAT-011-1: A new card has `visibility: PRIVATE`, `publishedAt: null` and `shareSourceText: false`.
  - AC-CAT-011-2: A publish request without a boolean `shareSourceText` returns 400 and leaves the card private.
  - AC-CAT-011-3: Changing the source-text choice on a public card keeps its original `publishedAt`.
  - AC-CAT-011-4: Unpublishing sets `PRIVATE`, `publishedAt: null` and `shareSourceText: false`.

### REQ-CAT-012: Community Catalog Listing and Search
- Any signed-in user can list published cards, newest published first, paginated like REQ-CAT-003 (default 20, max 50), with the total.
- An optional keyword `q` (max 500 characters) matches case-insensitively against the title, summary, subjects and keywords, and against the source text only where the owner shared it. LIKE wildcards in `q` match literally.
- Private cards never appear and are never counted.
- Requests without a valid session return 401.

### REQ-CAT-013: Save to My Vault (Independent Copy)
- A signed-in user can save a published card into their vault. This creates a new card owned by the saver. It is never a live reference or shared ownership.
- The copy takes the catalog title, source title, source URL, source text (only if shared, otherwise empty), summary, facts, subjects, keywords and related concepts.
- The copy records provenance: the original card's id and the original author's username at the time of saving.
- The copy does not take the original's personal notes, collection, tags, owner, source metadata or AI statuses. Its AI statuses are the initial values for a new card (REQ-AI-012), because it was not processed by AI itself.
- The copy is `PRIVATE`.
- The card and its provenance are created in one transaction.
- Saving a private, unpublished, deleted, unknown or malformed card returns 404. Saving your own card returns 409 `CANNOT_SAVE_OWN_CARD`.
- A user has at most one copy of a given original. A second save, including a simultaneous one, returns 409 `CARD_ALREADY_SAVED`. After deleting their copy, the user can save the card again.
- Independence:
  - The saver can edit the copy. The original owner cannot read, edit or delete it.
  - Edits to the original never change the copy, and edits to the copy never change the original.
  - Unpublishing or deleting the original never deletes or changes the copy.

### REQ-CAT-015: Catalog Entry Identity and Structure
- A card has a **catalog title** (the name of its subject, for example "Marie Curie") separate from its **source title** (for example "Marie Curie - Wikipedia"). The card is displayed under its catalog title, else its source title, else "Untitled". Existing cards have no catalog title and keep showing their source title.
- The catalog layer also holds **facts** (up to 8 `{label, value}`) and **related concepts** (up to 8 `{name, relation}`), both general-purpose (AI Cataloging REQ-AI-017). The owner can edit the title, facts and related concepts like the other catalog fields.
- A related concept links to a card with a matching title (catalog or source title, case-insensitive): in the owner's view only to the owner's own cards, in the public view only to published cards. Without a match it is shown as plain text. Links are worked out on read and never stored.
- The original source (text, title, URL, metadata) stays a separate layer, shown after the catalog entry under the source's own title, never modified.
- Keyword search (vault and community) also matches the catalog title, fact labels and values, and related-concept names.

### REQ-CAT-014: Public Card Detail, Attribution and Field Privacy
- Any signed-in user can open a published card. A private or unknown card returns the same 404, so private cards are not revealed. The owner gets that 404 too through the public endpoint.
- Public responses carry only these fields: id, catalog title, source title, source URL, summary, subjects, keywords, whether source text is shared, the source text when shared, the author's username, the publication time, and (detail only) facts, related concepts (linked to published cards only), and whether the viewer owns the card or already has a copy.
- Public responses never carry personal notes, collections, tags, AI processing statuses, source metadata, owner ids or email addresses. Services select an explicit list of public columns; they never serialize a full card row.
- A saved copy shows its attribution in the vault (original author, and a link to the original while it is still published). The attribution stays meaningful after the original is unpublished or deleted.

## Out of Scope

- Collaborative cards: shared ownership, collaborative editing, or copies that stay linked to the original.
- Public access without an account. The Community Catalog requires sign-in.
- Social features: likes, comments, followers, reputation, recommendation feeds.
- Card versioning or edit history.
- Bulk import or export.
- Card templates.
