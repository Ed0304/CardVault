-- Usernames are unique, ignoring letter case (TASK-AUTH-027). A username is shown publicly as a
-- card's author in the Community Catalog, so two accounts named "Alice" and "alice" would let one
-- pass as the other.
--
-- Idempotent: safe to run more than once. Adds one unique index on users; changes no column and
-- no row. The displayed spelling is kept as typed; only the comparison ignores case.
--
-- If accounts already share a username, this migration stops with an error and changes nothing.
-- Find them with:
--   SELECT lower(username) AS name, array_agg(email ORDER BY created_at) AS accounts
--     FROM users GROUP BY lower(username) HAVING count(*) > 1;
-- then rename all but one of each (UPDATE users SET username = '...' WHERE id = '...'), and rerun.

DO $$
DECLARE
    duplicated INT;
BEGIN
    IF to_regclass('public.users_username_lower_key') IS NULL THEN
        SELECT count(*) INTO duplicated
          FROM (SELECT 1 FROM users GROUP BY lower(username) HAVING count(*) > 1) d;
        IF duplicated > 0 THEN
            RAISE EXCEPTION '% username(s) are used by more than one account. Rename the duplicates before running migration 009 (see the query at the top of 009_unique_username.sql).', duplicated;
        END IF;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON users (lower(username));
