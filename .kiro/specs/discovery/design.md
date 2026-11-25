# Discovery — Design

## Overview

| Piece | Where |
|---|---|
| Optional authentication for public reads | `backend/expressjs/src/middleware/authenticate.ts` (`optionalAuthenticate`) |
| Guest-readable community routes | `src/routes/community.routes.ts`, `communityService.getPublicCard(viewerId \| null, …)` |
| Preferences table | `migrations/008_create_recommendation_preferences.sql` |
| Preferences API | `src/schemas/preferences.schemas.ts`, `src/services/preferencesService.ts`, `src/controllers/preferencesController.ts`, `src/routes/preferences.routes.ts` |
| Starter topics and matching terms | `src/services/topicCatalog.ts` |
| Ranking (pure) | `src/services/recommendationRanking.ts` |
| Recommendations API | `src/services/recommendationService.ts`, `src/controllers/recommendationController.ts`, `src/routes/recommendations.routes.ts` |
| `onboardingCompleted` on the auth user | `src/services/userService.ts`, `src/services/authService.ts` |
| Route guard | `frontend/cardvault/app/middleware/auth.global.ts` |
| Pages | `pages/welcome.vue`, `pages/home.vue`, `pages/settings.vue`; `pages/community/*` set `public: true` |
| Components | `components/preferences/InterestPicker.vue`, `components/recommendations/RecommendationCard.vue` |
| Data layer | `composables/usePreferences.ts`, `composables/useRecommendations.ts`, `services/preferences.service.ts`, `services/recommendations.service.ts`, `types/preferences.ts`, `types/recommendation.ts` |

## API

| Method and path | Auth | Response `data` |
|---|---|---|
| `GET /api/community/cards` | optional | unchanged (`{ items, total, page, pageSize }`) |
| `GET /api/community/cards/:id` | optional | unchanged, except `viewer` is `null` for a guest |
| `POST /api/community/cards/:id/save` | required | unchanged |
| `GET /api/preferences` | required | `{ preferences: RecommendationPreferences \| null }` |
| `PUT /api/preferences` | required | `{ preferences }`; body `{ interests: string[], surpriseMe: boolean, priority?: 'BALANCED' \| 'INTERESTS' \| 'VAULT' }` |
| `GET /api/preferences/topics` | required | `{ topics: { label, description, source: 'STARTER' \| 'CATALOG', publicCardCount }[] }` |
| `GET /api/recommendations` | required | `{ date, eligibleCount, items: { card: PublicCardSummary, reason }[] }`; 409 `ONBOARDING_REQUIRED` without preferences |
| `GET /api/auth/me` (and login, register, refresh) | required | `user` gains `onboardingCompleted: boolean` |

`PUT` is used because the request replaces the user's whole preference set.

## Decisions

### D-DISC-1: Optional authentication on read routes only
`optionalAuthenticate` sets `req.user` from a valid token and otherwise continues as a guest. An expired or tampered cookie reads as a guest; the access cookie's max-age equals the token lifetime, so an expired token is rarely sent at all. The save route keeps `authenticate`. The public column list in `communityService.ts` was already the privacy boundary, so guests get exactly what signed-in users get, and `viewer` is `null`.

Alternative rejected: a separate `/api/public/...` route set. It would duplicate the community API.

### D-DISC-2: A separate preferences table; row existence means onboarded
`recommendation_preferences(user_id PK → users ON DELETE CASCADE, interests TEXT[], surprise_me, priority, onboarded_at, updated_at)`. The `users` table is not altered (project rule), and there is no existing settings table to reuse. Existing users have no row, so they see onboarding once with no backfill. A CHECK constraint requires `surprise_me OR cardinality(interests) > 0`, matching the Zod rule.

`onboardingCompleted` is computed in the user queries with `EXISTS (…)`, so the route guard can decide without an extra request, and it is present after a page reload or a refresh.

### D-DISC-3: Interests are free-text labels, not ids
A label is what the user sees and what card metadata contains. The starter list in `topicCatalog.ts` only adds matching terms ("Games and Pokémon" also matches "Video games", "Pokemon"), and the topic endpoint adds the 12 subject headings most used on published cards, so choices grow with the catalog without a migration. Renaming a starter label would turn existing saved copies of it into plain-word interests; that is acceptable for labels that rarely change.

### D-DISC-4: Metadata ranking now, embeddings later
No embeddings exist (`ai_embedding_status` is `NOT_AVAILABLE`, no pgvector column), and calling Muse per dashboard render would be slow and costly. The ranking uses the subject headings, keywords, titles, related concepts and descriptions that cataloging already produced.

`rankRecommendations` is a pure function: candidates and a profile in, picks with reasons out. Matching is whole-word on normalized text (lowercase, accents removed, punctuation as spaces; a trailing "s"/"es" allowed), so "art" does not match "Smartphones".

Scoring:
- Interest: best field weight among subjects 3, keywords 2, title 2, related concepts 1.5, description 1.
- Bridge: two interests matched; the sum of both plus 1.
- Vault: a related-concept link counts 4. This means a vault card lists the candidate's title as a related concept, or the candidate lists the vault card's title; titles are compared after normalization. Shared headings add 2 × specificity per subject and 1 × specificity per keyword. Without a related link, the heading score must reach 1.5. The total is capped at 6.
- Specificity of a heading = ln(1 + N/df) / ln(1 + N) over the N candidates, where df is how many candidates carry it. It is 1 for a heading on one card and falls towards 0 for headings most cards carry, so broad headings ("Science") cannot link cards on their own (TASK-DISC-023).
- Priority multiplies the interest and vault scores: BALANCED 1/1, INTERESTS 1.5/0.5, VAULT 0.6/1.5.
- Adjacent: a card that matches no interest but shares a heading of specificity ≥ 0.5 (roughly: on at most a tenth of the candidates) with an interest-matched card. The most specific shared heading is named in the reason and orders the adjacent cards.
- Explore: everything else.

Selection, six cards:
- Discovery slots: 1, or 2 with Surprise me, or all six when there are no interests and no vault.
- Relevant picks first take one card per topic, then fill by score.
- Discovery takes adjacent cards first, then explore, one per topic.
- Any shortfall is filled from what remains.

Ties and the explore order use an FNV-1a hash of `userId:date:preferencesUpdatedAt:cardId`, so the shelf is stable for a day, changes when preferences change, and needs no cache table.

The candidate pool is the 500 most recently published eligible cards. Past that size, move scoring into SQL (a GIN index on `ai_subjects`) or add a pgvector similarity signal to the same function.

### D-DISC-5: Eligibility in SQL, before ranking
The candidate query selects only `PUBLIC_COLUMNS` of `visibility = 'PUBLIC'` cards with `user_id <> viewer` and no saved copy by the viewer. The viewer's own vault (up to 200 cards with headings, keywords or related concepts) is read separately. Its titles, headings, keywords and related-concept names are used only in the viewer's own response, for the "Shares … with your card" and "… lists this as a related concept" reasons. Notes are never read.

### D-DISC-6: Onboarding gate in the route guard
`auth.global.ts` sends signed-in, not-onboarded users from any signed-in page to `/welcome?redirect=<page>`. Public pages are not gated, so the "register to save this card" path is not interrupted. `/welcome` (meta `onboarding: true`) sends onboarded users on. `safeRedirectPath` refuses `/welcome` as a target to avoid loops. The default signed-in landing changed from `/catalog` to `/home`. If `/api/recommendations` answers 409 `ONBOARDING_REQUIRED`, the client marks the session as not onboarded and opens onboarding.

### D-DISC-7: No new content policy
CardVault has no content classification. Recommendations use the same visibility rule as the Community Catalog and no keyword blacklist. A future classification column would be added to the eligibility WHERE clause in `recommendationService.ts` and to the community queries together.

## Testing

| Area | File |
|---|---|
| Ranking rules (17 tests, no database) | `tests/recommendationRanking.test.ts` |
| Guest access, onboarding, preferences, recommendations (21 tests) | `tests/discovery.integration.test.ts` |
| Guest detail replaces the old "401 for guests" test | `tests/community.integration.test.ts` |
| Auth mock gains `onboardingCompleted` | `tests/auth.test.ts` |

The frontend has no test framework installed. The pages were checked with the typechecker, the production build, and an HTTP walk-through of the route guard against the test database (see tasks).
