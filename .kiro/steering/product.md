---
inclusion: always
---

# CardVault — Product

## Vision

CardVault revives the traditional physical library card catalog through modern web technologies and AI. It is a personal knowledge vault extended into a community-powered knowledge catalog: each user's vault is private by default, owners can publish selected cards, and other users can discover published cards and save independent copies into their own vaults. It is not a bookmarking tool or a social network.

**Core philosophy:** Save information once. Let CardVault organize it and help you rediscover it.

**Community principle:** Publish knowledge, preserve attribution, and let every user build their own independent library.

## Target Users

Knowledge workers, researchers, students, writers, and curious individuals who accumulate useful information across the web and want a structured, searchable personal knowledge base.

## Core Problem

Information saved online is quickly lost, forgotten, or buried. Existing tools either lack organization (browser bookmarks), lack context (read-later apps), or lack intelligence (note-taking apps). CardVault combines preservation, personal annotation, and AI-assisted cataloging into a unified system.

## Main User Journeys

1. **Save from text** — Paste text content, add a source URL optionally, receive an AI-cataloged knowledge card.
2. **Save from URL** — Provide a public URL, CardVault extracts the content, preserves it, and AI-catalogs it.
3. **Review and annotate** — Open a card, read the original content, review AI metadata, add personal notes.
4. **Organize** — Add cards to collections and apply tags.
5. **Rediscover** — Use keyword search to find relevant past knowledge. AI semantic search is planned for the future Semantic Retrieval milestone (see MVP Scope).
6. **Discover related** — From any card, surface semantically similar cards from the personal vault. Planned for the future Semantic Retrieval milestone.
7. **Publish** — From one of their own cards, the owner publishes it to the Community Catalog after a confirmation that lists what becomes public, and chooses explicitly whether the original text is included. They can unpublish at any time.
8. **Discover in the community** — Browse and keyword-search published cards, open one, and see its author and source.
9. **Save to My Vault** — Save a published card as an independent, private copy that keeps the original's attribution.

## Experiences

| Experience | What it is |
|---|---|
| My Vault | The user's own cards. Private by default. Notes, collections and tags are always private. |
| Community Catalog | Cards their owners published, readable by anyone, including guests without an account. Saving, creating, editing and publishing need sign-in. Not a social feed: no likes, comments, followers or reputation. |
| Home | For signed-in users: a welcome, the main actions, and a few "Recommended for today" cards from the Community Catalog, each with the reason it was picked. New users choose interests (or "Surprise me") once, in the welcome onboarding, and change them in Settings. |
| Public card detail | The approved public fields of one published card, with a **Save to My Vault** action. |

A saved card is an independent copy owned by the saver, never a live reference or shared ownership. Edits, unpublishing or deletion of the original never change or remove the copy.

## Three-Layer Card Model

Every knowledge card contains three independent information layers:

| Layer | Contents | Editable By |
|---|---|---|
| Original source | Extracted text, source URL, source metadata | Immutable after creation |
| Personal notes | User-authored observations and annotations | User only |
| AI catalog | Summary, subjects, keywords (MVP); embeddings (future Semantic Retrieval milestone) | AI-generated; user-editable |

AI-generated information must never silently overwrite original content or personal notes.
AI-generated results must also never overwrite a user's edits to AI metadata.

## Product Principles

- Privacy first — all data is personal and isolated per user. Nothing becomes public without the owner's explicit, confirmed action, and only approved fields are ever published: never personal notes, collections, tags, or account details beyond the username.
- Preserve attribution — a saved copy records the original card and author, and keeps that record when the original is gone.
- Preserve the original — source content is never modified after ingestion.
- AI assists, user decides — AI metadata is visible, reviewable, and editable.
- Fail gracefully — AI failures must never result in data loss.
- Clean interface — inspired by library card catalogs; modern not vintage.

## MVP Scope

Included:
- User registration, login, logout, and account isolation.
- Knowledge card creation from text input and public URLs.
- Original content preservation.
- Personal notes on cards.
- AI-generated summary, subjects, and keywords.
- User-editable AI metadata.
- Collections and tags.
- PostgreSQL keyword search. It works without embeddings, pgvector or any AI service.
- Community Catalog: publishing and unpublishing own cards, browsing and keyword-searching published cards, public card detail, and saving independent copies with attribution.
- Responsive web interface.

The MVP is functional with keyword search alone. AI cataloging works like a librarian's suggestion slip: the owner asks Muse (Meta Model API, Muse Ember) to catalog a card, reviews and edits the suggested summary, subjects and keywords, and saves them. Nothing changes, and nothing is published, until the owner saves. Saved details then make the card findable in keyword search. Card creation never waits for AI.

Planned future milestone: Semantic Retrieval (not part of the MVP; the requirements are preserved):
- Embedding generation. FastAPI generates embeddings, with local inference as the preferred direction. No embedding model or runtime is selected, and no second hosted AI provider is introduced.
- Vector storage with pgvector in PostgreSQL.
- AI semantic search, with `auto` (semantic with keyword fallback) as the intended default mode.
- Related card discovery.
- Express owns the database operations and the PostgreSQL similarity queries.

Implementation status note: nothing in the AI work is implemented yet. The intended hosted AI provider is Meta Model API. AI image generation is an optional capability associated with cards. It is not part of the MVP scope above, does not replace the core catalog, and needs a separate product decision. Video generation is out of scope.

Explicitly excluded from MVP:
- Collaboration: shared ownership, collaborative editing, live-linked copies.
- Public access without an account (the Community Catalog requires sign-in).
- Social features: likes, comments, followers, reputation, recommendation feeds.
- Browser extensions.
- Native desktop or mobile applications.
- Offline-first functionality.
- PDF, OCR, audio, or video processing.
- Web crawling or automated ingestion.
- Autonomous AI agents.
- Billing and subscriptions.

## Design Direction

**Modern first. Archival second. AI throughout.**

- Warm archival color palette: Parchment `#F5F0E6`, Ivory `#FFFEFA`, Antique Beige `#D8C6A5`, Archive Brown `#8B7355`, Ink `#33312D`, Terracotta `#B66A4B`.
- Typography: Newsreader (editorial headings), Inter or Geist Sans (interface), Geist Mono (catalog identifiers and metadata).
- Clean card-based layout with generous whitespace.
- Subtle library catalog references; avoid heavy vintage textures.
- Light mode first.
