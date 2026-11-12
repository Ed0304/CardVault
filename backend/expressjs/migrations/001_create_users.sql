-- Users table for authentication. Idempotent: safe to run more than once.
-- gen_random_uuid() is built in on PostgreSQL 13+.
CREATE TABLE IF NOT EXISTS users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash TEXT         NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT users_email_key UNIQUE (email),
    -- Emails are normalized to lowercase by the API; this enforces it in the database.
    CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);
