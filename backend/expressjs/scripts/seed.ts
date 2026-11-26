import { readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "../src/lib/db.js";

/**
 * Runs a seed file from ./seeds against DATABASE_URL. Local and test databases only.
 *
 *   npm run db:seed            # seeds/community_catalog_seed.sql
 *   npm run db:seed:remove     # seeds/remove_community_catalog_seed.sql
 *
 * Refuses to run in production or against a Railway host: seeds are fixture data for local
 * work. Seed author accounts cannot log in (see the seed file's header).
 */
const file = process.argv[2] ?? "community_catalog_seed.sql";
if (!/^[\w.-]+\.sql$/.test(file)) {
  console.error("Seed file must be a plain .sql filename inside ./seeds");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const { hostname, pathname } = new URL(url);
const database = pathname.replace(/^\//, "");
const looksRemote = /railway|rlwy\.net/i.test(hostname);
if (process.env.NODE_ENV === "production" || looksRemote) {
  console.error(`Refusing to seed ${hostname}/${database}: seeds are for local and test databases only.`);
  process.exit(1);
}

try {
  const sql = await readFile(path.resolve(import.meta.dirname, "../seeds", file), "utf8");
  console.log(`Running ${file} on ${hostname}/${database}…`);
  await pool.query(sql);
  const counts = await pool.query<{ accounts: string; cards: string; public_cards: string }>(
    `SELECT (SELECT count(*) FROM users WHERE email LIKE '%@seed.cardvault.test') AS accounts,
            (SELECT count(*) FROM knowledge_cards k JOIN users u ON u.id = k.user_id
              WHERE u.email LIKE '%@seed.cardvault.test') AS cards,
            (SELECT count(*) FROM knowledge_cards k JOIN users u ON u.id = k.user_id
              WHERE u.email LIKE '%@seed.cardvault.test' AND k.visibility = 'PUBLIC') AS public_cards`,
  );
  const row = counts.rows[0]!;
  console.log(`Done. Seed accounts: ${row.accounts}, seed cards: ${row.cards} (${row.public_cards} public).`);
} catch (err) {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
