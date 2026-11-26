# Discovery — Requirements

Guest access to the Community Catalog, a one-time welcome onboarding, a personal home page with
recommendations, and editable recommendation preferences.

Related specs: catalog-management (REQ-CAT-011 to REQ-CAT-015: publishing, public fields,
independent copies), authentication (sessions and refresh tokens), ai-cataloging (the metadata
recommendations are built from).

## Guest Access

### REQ-DISC-001: Guests Can Read the Community Catalog
- Without an account, anyone can list, search and open published cards: catalog title, description, facts, subject headings, keywords, related concepts, source link, the source text when the author shared it, the author's username and the publication date.
- Guests get exactly the public fields that signed-in users get (REQ-CAT-014). A card detail for a guest has `viewer: null`.
- Private, unpublished, unknown and malformed cards return the same 404 to guests.
- A missing, expired or invalid session cookie on these read routes is treated as a guest, never as an error.
- Acceptance criteria:
  - AC-DISC-001-1: `GET /api/community/cards` and `GET /api/community/cards/:id` answer 200 without a session, with the same key sets as for a signed-in user.
  - AC-DISC-001-2: No guest response contains notes, emails, owner ids, collections, tags or unshared source text.
  - AC-DISC-001-3: The `/community` and `/community/:id` pages render for guests.

### REQ-DISC-002: Writing Requires Sign-In, With a Return Path
- Creating, saving to vault, editing, publishing and unpublishing cards, and opening My Vault, Collections, Home or Settings, need a signed-in user. The API enforces this (401), not only the frontend.
- A guest who tries one of these is sent to log in (or register) with the intended page kept as a `redirect`, and returns there afterwards. "Save to My Vault" on a public card returns the guest to that card, where they can save it.
- Redirect targets are same-site paths only (no open redirect).

### REQ-DISC-003: Guest Navigation
- The Community link is unlocked for guests; signed-in-only links show a lock.
- The header's Log in and Register links return the guest to the page they were reading.
- The landing page offers "Browse the Community Catalog" next to Log in and Create an account.
- A guest reading a card sees why saving needs an account and links to log in or register that come back to the card.

## Welcome Onboarding

### REQ-DISC-004: Onboarding Before the Personal Home
- A signed-in user who has not chosen recommendation preferences sees the welcome onboarding ("Welcome, <username>! … What topics are you interested in?") before any signed-in page, then continues to the page they asked for (Home by default).
- This applies to new accounts and to existing accounts created before onboarding existed; each sees it once.
- Public pages stay reachable before onboarding, so a new user who registered to save a card can save it first.
- Topic choices: a starter list (for example Technology, Cybersecurity, Science, History, Games and Pokémon, Art and Culture, Internet Memes, Horror and Folklore, Music, Literature, Education), the subject headings most used on published cards, and topics the user types. The list is not a fixed taxonomy.

### REQ-DISC-005: A Valid Choice
- The user selects at least one topic, or chooses "Surprise me — recommend a variety of topics", or both. An empty choice is rejected (400 from the API, a message in the UI).
- Limits: at most 20 interests, each 1 to 60 characters of plain text. Interests differing only in case or spacing are kept once.

### REQ-DISC-006: Persistence and Privacy
- Preferences are stored in PostgreSQL, one row per user, and persist across sessions and devices. They are not stored only in the browser.
- Preferences are read and written only for the signed-in user's own id and never appear in public responses.
- `onboardingCompleted` on the auth user (`/auth/me`, login, register, refresh) is true exactly when the user has saved preferences.
- If the session says onboarding is complete but no preferences exist, the home page sends the user back to onboarding (recovery path).

### REQ-DISC-007: Editable in Settings
- Settings lets the user add and remove interests, turn "Surprise me" on or off, and choose what leads when both apply: their topics, their vault, or both equally.
- Saving replaces the preferences and affects the next recommendations. The original onboarding time is kept.

## Personal Home and Recommendations

### REQ-DISC-008: Personal Home Page
- After login, an onboarded user lands on Home: "Welcome, <username>!", "Your library is ready to explore.", actions Create card, My Vault, and Explore the Community Catalog, and "Recommended cards for today".
- Signed-in users who open the landing page (`/`) are sent to Home.

### REQ-DISC-009: Eligible Cards Only
- Recommendations are published (`PUBLIC`) cards only, never the user's own cards and never cards they already saved a copy of.
- Each recommendation carries only the public summary fields (REQ-CAT-014) plus the reason.
- Content eligibility follows the existing visibility rules. CardVault has no content classification yet; a card's subject alone does not make it ineligible, and no keyword blacklist is applied.

### REQ-DISC-010: Every Recommendation Explains Itself
- Each card shows a reason that names its source:
  - "Based on your interest in <topic>."
  - "Connects two topics you follow: <topic> and <topic>."
  - "Shares “<heading>” with “<your card>” in your vault."
  - "“<your card>” in your vault lists this as a related concept." / "Lists “<your card>”, a card in your vault, as a related concept."
  - "Close to your interest in <topic>: both touch on <heading>."
  - "Outside the topics you follow: <heading>." (shown under the label "Something new", so the reason doesn't repeat it)
- Generic reasons such as "Recommended by AI" are not used.

### REQ-DISC-011: Relevance and Discovery
- Signals: chosen interests (matched against subject headings, keywords, titles, related concepts and descriptions), the user's own vault (related concepts that name a card, and shared headings and keywords), and discovery (topics next to the user's interests, and topics outside them).
- A heading carried by most cards does not by itself make a card "related to your vault" or "close to your interest".
- Word order in a multi-word interest does not matter for headings, keywords, titles and related concepts ("Internet history" matches "History of the Internet"). Every significant word must be present, so one shared word such as "history" is not a match.
- At least one of the six cards is discovery when such cards exist; two with "Surprise me". A user with only "Surprise me" and an empty vault gets a variety of topics.
- Picks are spread across topics before one topic repeats.
- The picks are stable for a user for a day (and change when preferences change), without storing them.

### REQ-DISC-012: Cost and Empty States
- Building recommendations calls no AI model. It uses the catalog metadata already produced at cataloging time.
- With no eligible published cards, Home shows an empty state that points to the Community Catalog and to creating a first card. No placeholder cards are shown.

## Out of Scope

- Likes, comments, followers, activity feeds, or recommendations based on other users' behaviour.
- Embedding-based semantic recommendations (the ranking module is ready for an extra signal; see the semantic-search spec).
- Content classification or age gating; there is no classification in the catalog yet.
- Email or push notifications about recommendations.
