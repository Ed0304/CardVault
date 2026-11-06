---
inclusion: always
---

# CardVault — Product

## Vision

CardVault revives the traditional physical library card catalog through modern web technologies and AI. It is a private, personal knowledge management system — not a bookmarking tool, social network, or public archive.

**Core philosophy:** Save information once. Let CardVault organize it and help you rediscover it.

## Target Users

Knowledge workers, researchers, students, writers, and curious individuals who accumulate useful information across the web and want a structured, searchable personal knowledge base.

## Core Problem

Information saved online is quickly lost, forgotten, or buried. Existing tools either lack organization (browser bookmarks), lack context (read-later apps), or lack intelligence (note-taking apps). CardVault combines preservation, personal annotation, and AI-assisted cataloging into a unified system.

## Main User Journeys

1. **Save from text** — Paste text content, add a source URL optionally, receive an AI-cataloged knowledge card.
2. **Save from URL** — Provide a public URL, CardVault extracts the content, preserves it, and AI-catalogs it.
3. **Review and annotate** — Open a card, read the original content, review AI metadata, add personal notes.
4. **Organize** — Add cards to collections and apply tags.
5. **Rediscover** — Use keyword search or AI semantic search to find relevant past knowledge.
6. **Discover related** — From any card, surface semantically similar cards from the personal vault.

## Three-Layer Card Model

Every knowledge card contains three independent information layers:

| Layer | Contents | Editable By |
|---|---|---|
| Original source | Extracted text, source URL, source metadata | Immutable after creation |
| Personal notes | User-authored observations and annotations | User only |
| AI catalog | Summary, subjects, keywords, embeddings | AI-generated; user-editable |

AI-generated information must never silently overwrite original content or personal notes.

## Product Principles

- Privacy first — all data is personal and isolated per user.
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
- Keyword-based search.
- AI semantic search.
- Related card discovery.
- Responsive web interface.

Explicitly excluded from MVP:
- Collaboration and sharing.
- Public libraries.
- Social features.
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
