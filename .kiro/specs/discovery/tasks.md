# Discovery — Tasks

## Express Backend

- [x] **TASK-DISC-001** `src/middleware/authenticate.ts` — `optionalAuthenticate` (valid token sets `req.user`; missing or invalid continues as a guest).
- [x] **TASK-DISC-002** Community read routes use `optionalAuthenticate`; save keeps `authenticate`. `getPublicCard(viewerId | null)` returns `viewer: null` for guests (REQ-DISC-001, REQ-DISC-002).
- [x] **TASK-DISC-003** `migrations/008_create_recommendation_preferences.sql` — table, priority/interest-count/choice CHECKs, `ON DELETE CASCADE` (applied to `cardvault_test`).
- [x] **TASK-DISC-004** `onboardingCompleted` on `UserRecord` and `PublicUser` (computed with `EXISTS`), so `/auth/me`, login, register and refresh carry it.
- [x] **TASK-DISC-005** Preferences API: `preferences.schemas.ts` (Zod, at least one interest or Surprise me, limits, dedupe), `preferencesService.ts` (get, upsert keeping `onboarded_at`, topic options), controller and routes at `/api/preferences`.
- [x] **TASK-DISC-006** `topicCatalog.ts` — starter topics with matching terms; `normalizeTopic`, `termsForInterest`.
- [x] **TASK-DISC-007** `recommendationRanking.ts` — pure ranking with INTEREST, BRIDGE, VAULT, ADJACENT and EXPLORE reasons, discovery slots, topic spreading, daily seed.
- [x] **TASK-DISC-008** `recommendationService.ts` — eligibility in SQL (public, not own, not saved), vault sample, 409 `ONBOARDING_REQUIRED`; `GET /api/recommendations`.
- [x] **TASK-DISC-009** Tests: `recommendationRanking.test.ts` (12), `discovery.integration.test.ts` (20), the guest test in `community.integration.test.ts`, the auth mock. Full suite 288/288 against `cardvault_test`.
- [ ] **TASK-DISC-010** Run `npm run migrate` on Railway's database (migration 008) before deploying the Express changes. Needs the project owner's approval. Without it, every login fails, because the user queries read `recommendation_preferences`.

## Frontend

- [x] **TASK-DISC-011** Route guard: `/` sends signed-in users to `/home`; not-onboarded users go to `/welcome?redirect=…` from signed-in pages; `/welcome` sends onboarded users on; `safeRedirectPath` refuses `/welcome`; default landing `/home`.
- [x] **TASK-DISC-012** `/community` and `/community/:id` are public. A guest sees "Log in to save to your vault", and a note with log-in and register links that return to the card. The empty state differs for guests.
- [x] **TASK-DISC-013** Navigation: Home and Settings links; Community unlocked; header Log in and Register keep the current page as `redirect`; username links to Settings; landing CTA "Browse the Community Catalog"; login message for community redirects. New icons `home`, `sliders`, `compass`.
- [x] **TASK-DISC-014** `pages/welcome.vue` with `PreferencesInterestPicker` (starter and catalog topics, own topics, Surprise me).
- [x] **TASK-DISC-015** `pages/home.vue` — welcome, actions, "Recommended cards for today" with `RecommendationsRecommendationCard`, empty state, recovery to onboarding on 409.
- [x] **TASK-DISC-016** `pages/settings.vue` — edit interests, Surprise me and priority.
- [x] **TASK-DISC-017** Verified with `vue-tsc` (via npx), the production build, and an HTTP walk-through of the route guard (Express on `cardvault_test` plus `nuxi dev`): 22 checks passed for guest pages, login redirects, onboarding gate, saving before onboarding, Home, Settings and recommendations. Not yet checked in a browser.

## Recommendation Quality

- [x] **TASK-DISC-023** Relationship-aware, specificity-weighted links in `rankRecommendations`:
  - Related concepts on vault cards (and on candidates) link cards, with two new VAULT reason texts.
  - Heading links are weighted by specificity, so broad headings no longer create VAULT or ADJACENT links.
  - The vault query reads `ai_related`.
  - The API shape and reason kinds are unchanged.
  - Verified by 5 new unit tests and 1 new integration test; the full Express suite passed 294/294 against `cardvault_test` on 2026-11-25.

## Later

- [ ] **TASK-DISC-020** Browser check of onboarding, Home and Settings on desktop and mobile widths.
- [ ] **TASK-DISC-021** Add an embedding-similarity signal to `rankRecommendations` once the semantic-search milestone stores embeddings.
- [ ] **TASK-DISC-022** Rate-limit guest reads of `/api/community` if public traffic grows (no limiter exists today).
