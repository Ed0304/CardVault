-- AI catalog suggestions awaiting the owner's review (AI Cataloging, REQ-AI-001 and REQ-AI-007).
-- Idempotent: safe to run more than once. Only adds columns to knowledge_cards.
--
-- Muse writes its summary, subjects and keywords here, never into ai_summary, ai_subjects or
-- ai_keywords. The owner reviews the draft and either saves it (with any edits) through the
-- existing AI-metadata update, which clears the draft, or discards it. So AI output never
-- overwrites the owner's edits, and never reaches a published card without the owner saving it.
-- The draft is private: no public (Community Catalog) query selects it, and saved copies do not
-- take it.

ALTER TABLE knowledge_cards
    -- { summary, subjects, keywords, model, truncated, generatedAt }, or NULL.
    ADD COLUMN IF NOT EXISTS ai_catalog_draft        JSONB,
    -- When the latest catalog request started. A PENDING status older than the service's
    -- timeout is treated as abandoned, so a crashed request cannot block the card forever.
    ADD COLUMN IF NOT EXISTS ai_catalog_requested_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'knowledge_cards'::regclass
                      AND conname = 'knowledge_cards_catalog_draft_check') THEN
        ALTER TABLE knowledge_cards ADD CONSTRAINT knowledge_cards_catalog_draft_check
            CHECK (ai_catalog_draft IS NULL OR jsonb_typeof(ai_catalog_draft) = 'object');
    END IF;
END $$;
