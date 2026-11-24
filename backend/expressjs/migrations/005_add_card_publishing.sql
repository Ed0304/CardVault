-- Publishing and saved copies (Community Catalog, REQ-CAT-011 to REQ-CAT-014).
-- Idempotent: safe to run more than once. Only adds columns, constraints and indexes to
-- knowledge_cards; existing cards become PRIVATE through the column default. Never alters users.

ALTER TABLE knowledge_cards
    -- PRIVATE cards are visible only to their owner. PUBLIC cards appear in the Community Catalog.
    ADD COLUMN IF NOT EXISTS visibility         TEXT        NOT NULL DEFAULT 'PRIVATE',
    -- When the card was published; NULL while it is private.
    ADD COLUMN IF NOT EXISTS published_at       TIMESTAMPTZ,
    -- The owner's explicit choice to include the original source text in the public card.
    ADD COLUMN IF NOT EXISTS share_source_text  BOOLEAN     NOT NULL DEFAULT false,
    -- Provenance of a card saved from the Community Catalog: the original card's id and the
    -- original author's username, both recorded when the copy was made.
    -- Deliberately no foreign key. ON DELETE CASCADE would delete copies with the original,
    -- SET NULL would erase the provenance, and RESTRICT would stop owners deleting their own
    -- cards. The copy is independent, so this is a historical record, not a live link.
    ADD COLUMN IF NOT EXISTS saved_from_card_id UUID,
    ADD COLUMN IF NOT EXISTS saved_from_author  TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'knowledge_cards'::regclass
                      AND conname = 'knowledge_cards_visibility_check') THEN
        ALTER TABLE knowledge_cards ADD CONSTRAINT knowledge_cards_visibility_check
            CHECK (visibility IN ('PRIVATE', 'PUBLIC'));
    END IF;

    -- A card has a publication time exactly when it is public.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'knowledge_cards'::regclass
                      AND conname = 'knowledge_cards_published_at_check') THEN
        ALTER TABLE knowledge_cards ADD CONSTRAINT knowledge_cards_published_at_check
            CHECK ((visibility = 'PUBLIC') = (published_at IS NOT NULL));
    END IF;

    -- Provenance is recorded as a pair or not at all.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'knowledge_cards'::regclass
                      AND conname = 'knowledge_cards_saved_from_check') THEN
        ALTER TABLE knowledge_cards ADD CONSTRAINT knowledge_cards_saved_from_check
            CHECK ((saved_from_card_id IS NULL) = (saved_from_author IS NULL));
    END IF;
END $$;

-- Community Catalog order (newest published first), over public cards only.
CREATE INDEX IF NOT EXISTS knowledge_cards_public_idx
    ON knowledge_cards (published_at DESC, id DESC)
    WHERE visibility = 'PUBLIC';

-- One saved copy of a given original per user. Deleting the copy allows saving it again.
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_cards_user_saved_from_key
    ON knowledge_cards (user_id, saved_from_card_id)
    WHERE saved_from_card_id IS NOT NULL;
