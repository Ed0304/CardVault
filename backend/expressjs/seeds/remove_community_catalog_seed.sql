-- Removes everything community_catalog_seed.sql created: the seed accounts
-- (<handle>@seed.cardvault.test) and all rows they own. Local and test databases only.
--
-- Copies that other users saved from seed cards are independent cards owned by those users
-- (catalog-management REQ-CAT-013) and are kept. Recommendation preferences and refresh tokens
-- go with their user (ON DELETE CASCADE); card_tags go with their cards.
-- Run with: npm run db:seed:remove

BEGIN;

CREATE TEMP TABLE seed_user_ids ON COMMIT DROP AS
SELECT id FROM users WHERE email LIKE '%@seed.cardvault.test';

DELETE FROM knowledge_cards WHERE user_id IN (SELECT id FROM seed_user_ids);
DELETE FROM tags            WHERE user_id IN (SELECT id FROM seed_user_ids);
DELETE FROM collections     WHERE user_id IN (SELECT id FROM seed_user_ids);
DELETE FROM users           WHERE id      IN (SELECT id FROM seed_user_ids);

COMMIT;
