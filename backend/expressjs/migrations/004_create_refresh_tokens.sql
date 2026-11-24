-- Refresh tokens for long-lived sessions (TASK-AUTH-025).
-- Idempotent: safe to run more than once. References users and never alters it.
--
-- The token itself is a random value held only in the browser's HttpOnly cv_refresh cookie.
-- Only its SHA-256 hash is stored, so a database leak does not expose usable tokens.
-- Tokens rotate: each refresh revokes the presented token and issues a new one in the same
-- family. A family is one login; it ends at family_expires_at whatever happens.

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id         UUID        NOT NULL,
    token_hash        TEXT        NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- This token stops working after this time (idle limit).
    expires_at        TIMESTAMPTZ NOT NULL,
    -- The whole login stops working after this time (absolute limit).
    family_expires_at TIMESTAMPTZ NOT NULL,
    revoked_at        TIMESTAMPTZ,
    replaced_by       UUID        REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx   ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_id_idx ON refresh_tokens (family_id);
