# Catalog Management — Design

## Database Schema

```prisma
model KnowledgeCard {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])

  // Original source layer (immutable after creation)
  sourceText  String
  sourceUrl   String?
  sourceTitle String?
  sourceMeta  Json?    // author, publishedAt, siteName, etc.

  // Personal notes layer
  notes       String?

  // AI catalog layer
  aiSummary   String?
  aiSubjects  String[] // array of subject labels
  aiKeywords  String[] // array of keyword strings
  embedding   Unsupported("vector(1536)")?

  // Organisation
  collectionId String?
  collection   Collection? @relation(fields: [collectionId], references: [id])
  tags         CardTag[]

  aiStatus    AiStatus @default(PENDING)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
  @@index([collectionId])
  @@map("knowledge_cards")
}

enum AiStatus {
  PENDING
  COMPLETE
  FAILED
}

model Collection {
  id        String          @id @default(cuid())
  userId    String
  user      User            @relation(fields: [userId], references: [id])
  name      String
  cards     KnowledgeCard[]
  createdAt DateTime        @default(now())

  @@unique([userId, name])
  @@map("collections")
}

model Tag {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  name      String
  cards     CardTag[]
  createdAt DateTime  @default(now())

  @@unique([userId, name])
  @@map("tags")
}

model CardTag {
  cardId String
  tagId  String
  card   KnowledgeCard @relation(fields: [cardId], references: [id], onDelete: Cascade)
  tag    Tag           @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([cardId, tagId])
  @@map("card_tags")
}
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/cards | Paginated card list (filter: collectionId, tagId, q) |
| POST | /api/cards | Create card from text |
| GET | /api/cards/:id | Full card detail |
| PATCH | /api/cards/:id/notes | Update personal notes |
| PATCH | /api/cards/:id/ai-metadata | Update AI summary/subjects/keywords |
| DELETE | /api/cards/:id | Delete a card |
| GET | /api/collections | List user's collections |
| POST | /api/collections | Create a collection |
| PATCH | /api/collections/:id | Rename a collection |
| DELETE | /api/collections/:id | Delete a collection (cards become uncollected) |
| GET | /api/tags | List user's tags |
| POST | /api/tags | Create a tag |
| DELETE | /api/tags/:id | Delete a tag |
| POST | /api/cards/:id/tags/:tagId | Apply a tag to a card |
| DELETE | /api/cards/:id/tags/:tagId | Remove a tag from a card |

## Card List Response

```json
{
  "data": {
    "items": [
      {
        "id": "...",
        "sourceTitle": "...",
        "sourceUrl": "...",
        "aiSummary": "...",
        "aiSubjects": ["..."],
        "aiStatus": "COMPLETE",
        "collection": { "id": "...", "name": "..." },
        "tags": [{ "id": "...", "name": "..." }],
        "createdAt": "..."
      }
    ],
    "total": 42,
    "page": 1,
    "pageSize": 20
  },
  "error": null,
  "message": "OK"
}
```

## Card Detail Response

```json
{
  "data": {
    "id": "...",
    "sourceText": "...",
    "sourceUrl": "...",
    "sourceTitle": "...",
    "sourceMeta": {},
    "notes": "...",
    "aiSummary": "...",
    "aiSubjects": ["..."],
    "aiKeywords": ["..."],
    "aiStatus": "COMPLETE",
    "collection": { "id": "...", "name": "..." },
    "tags": [{ "id": "...", "name": "..." }],
    "createdAt": "...",
    "updatedAt": "..."
  },
  "error": null,
  "message": "OK"
}
```

## Service Layer

`cardService.ts` responsibilities:
- `createCard(userId, input)` — insert card, enqueue AI cataloging via `aiService`.
- `getCards(userId, filters, pagination)` — scoped list query.
- `getCard(userId, cardId)` — scoped detail query; throw 404 if not found or wrong user.
- `updateNotes(userId, cardId, notes)` — scoped update of `notes` field only.
- `updateAiMetadata(userId, cardId, patch)` — scoped update of `aiSummary`, `aiSubjects`, `aiKeywords`.
- `deleteCard(userId, cardId)` — scoped delete.

All methods verify `userId` ownership at the database query level — never rely on a pre-fetched record for authorization.

## Frontend Pages

- `app/pages/index.vue` — card list with pagination, filter sidebar (collections, tags), search bar.
- `app/pages/cards/new.vue` — tabbed input: "Paste Text" and "From URL".
- `app/pages/cards/[id].vue` — three-panel detail: source content, personal notes editor, AI metadata editor.

## Frontend Components

- `app/components/card/CardItem.vue` — card list item showing title, summary, subjects, tags.
- `app/components/card/CardDetail.vue` — full card view with all three layers.
- `app/components/card/CardForm.vue` — text/URL input form.
- `app/components/card/AiMetadataEditor.vue` — editable summary, subjects, keywords with AI status badge.
- `app/components/card/NotesEditor.vue` — textarea for personal notes.
- `app/components/ui/ConfirmDialog.vue` — reusable confirmation modal.
