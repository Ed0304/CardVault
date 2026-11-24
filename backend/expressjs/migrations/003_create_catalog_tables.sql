-- Catalog tables: collections, tags, knowledge cards and card-tag links.
-- Idempotent: safe to run more than once (every migration runs on every `npm run migrate`).
-- References the existing users table (001_create_users.sql) and never alters it.
-- No pgvector: the embedding column belongs to the future Semantic Retrieval milestone
-- (002_enable_pgvector.sql and 004_add_embedding_column.sql in the catalog design).

CREATE TABLE IF NOT EXISTS collections (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES users(id),
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT collections_user_name_key UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS tags (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES users(id),
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT tags_user_name_key UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS knowledge_cards (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES users(id),
    -- Original source layer (immutable after creation; enforced in the service layer)
    source_text         TEXT        NOT NULL,
    source_url          TEXT,
    source_title        TEXT,
    source_meta         JSONB,
    -- Personal notes layer
    notes               TEXT,
    -- AI catalog layer
    ai_summary          TEXT,
    ai_subjects         TEXT[]      NOT NULL DEFAULT '{}',
    ai_keywords         TEXT[]      NOT NULL DEFAULT '{}',
    -- Two independent AI processing statuses (decision D-8). No default: the service sets the
    -- initial value explicitly (decision D-9).
    ai_catalog_status   TEXT        NOT NULL
                        CHECK (ai_catalog_status IN ('PENDING', 'COMPLETE', 'FAILED', 'NOT_AVAILABLE')),
    ai_embedding_status TEXT        NOT NULL
                        CHECK (ai_embedding_status IN ('PENDING', 'COMPLETE', 'FAILED', 'NOT_AVAILABLE')),
    -- Organisation
    collection_id       UUID        REFERENCES collections(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_cards_user_id_idx       ON knowledge_cards (user_id);
CREATE INDEX IF NOT EXISTS knowledge_cards_collection_id_idx ON knowledge_cards (collection_id);
-- Supports the default list order (newest first) within one user's library.
CREATE INDEX IF NOT EXISTS knowledge_cards_user_created_idx  ON knowledge_cards (user_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS card_tags (
    card_id UUID NOT NULL REFERENCES knowledge_cards(id) ON DELETE CASCADE,
    tag_id  UUID NOT NULL REFERENCES tags(id)            ON DELETE CASCADE,
    PRIMARY KEY (card_id, tag_id)
);

CREATE INDEX IF NOT EXISTS card_tags_tag_id_idx ON card_tags (tag_id);
