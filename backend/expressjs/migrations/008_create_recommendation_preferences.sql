-- Recommendation preferences and welcome onboarding (Discovery spec, REQ-DISC-004 to REQ-DISC-007).
-- Idempotent: safe to run more than once. Adds one table that references users(id); never alters
-- users. A user has completed onboarding exactly when a row exists, so existing accounts (no row)
-- see the welcome onboarding once, and nothing needs backfilling.

CREATE TABLE IF NOT EXISTS recommendation_preferences (
    user_id      UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    -- Topic labels the user follows, e.g. 'Cybersecurity' or a subject heading from the catalog.
    -- Free text on purpose, so new catalog subjects can become interests without a migration.
    interests    TEXT[]      NOT NULL DEFAULT '{}',
    -- "Surprise me": recommend a variety of topics, including ones outside the interests.
    surprise_me  BOOLEAN     NOT NULL DEFAULT false,
    -- Which signal leads when both apply: the chosen interests, the user's own vault, or both.
    priority     TEXT        NOT NULL DEFAULT 'BALANCED',
    onboarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'recommendation_preferences'::regclass
                      AND conname = 'recommendation_preferences_priority_check') THEN
        ALTER TABLE recommendation_preferences ADD CONSTRAINT recommendation_preferences_priority_check
            CHECK (priority IN ('BALANCED', 'INTERESTS', 'VAULT'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'recommendation_preferences'::regclass
                      AND conname = 'recommendation_preferences_interests_check') THEN
        ALTER TABLE recommendation_preferences ADD CONSTRAINT recommendation_preferences_interests_check
            CHECK (cardinality(interests) <= 20);
    END IF;

    -- A valid configuration has at least one interest, or asks for a variety of topics.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'recommendation_preferences'::regclass
                      AND conname = 'recommendation_preferences_choice_check') THEN
        ALTER TABLE recommendation_preferences ADD CONSTRAINT recommendation_preferences_choice_check
            CHECK (surprise_me OR cardinality(interests) > 0);
    END IF;
END $$;
