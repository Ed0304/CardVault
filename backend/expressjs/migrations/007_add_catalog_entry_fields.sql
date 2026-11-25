-- Richer catalog entries (AI Cataloging REQ-AI-017; catalog-management REQ-CAT-015).
-- Idempotent: safe to run more than once. Only adds columns and checks to knowledge_cards.
-- Existing cards keep working: a NULL catalog title falls back to the source title, and the new
-- lists start empty.

ALTER TABLE knowledge_cards
    -- The catalog entry's own heading (e.g. "Marie Curie"), separate from the source's title
    -- (e.g. "Marie Curie - Wikipedia"). Part of the editable catalog layer.
    ADD COLUMN IF NOT EXISTS catalog_title TEXT,
    -- Factual attributes: [{ "label": "Author", "value": "Jane Doe" }, ...]. Labels are free text,
    -- so one shape fits every subject domain; there are no domain-specific columns.
    ADD COLUMN IF NOT EXISTS ai_facts      JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Related concepts: [{ "name": "X", "relation": "Successor" }, ...]. Links to other cards are
    -- worked out when a card is read, never stored, so nothing here points at another row.
    ADD COLUMN IF NOT EXISTS ai_related    JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'knowledge_cards'::regclass
                      AND conname = 'knowledge_cards_catalog_title_check') THEN
        ALTER TABLE knowledge_cards ADD CONSTRAINT knowledge_cards_catalog_title_check
            CHECK (catalog_title IS NULL OR char_length(catalog_title) BETWEEN 1 AND 200);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'knowledge_cards'::regclass
                      AND conname = 'knowledge_cards_ai_facts_check') THEN
        ALTER TABLE knowledge_cards ADD CONSTRAINT knowledge_cards_ai_facts_check
            CHECK (jsonb_typeof(ai_facts) = 'array' AND jsonb_array_length(ai_facts) <= 8);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'knowledge_cards'::regclass
                      AND conname = 'knowledge_cards_ai_related_check') THEN
        ALTER TABLE knowledge_cards ADD CONSTRAINT knowledge_cards_ai_related_check
            CHECK (jsonb_typeof(ai_related) = 'array' AND jsonb_array_length(ai_related) <= 8);
    END IF;
END $$;
