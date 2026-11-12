import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "../src/lib/db.js";

// Runs every .sql file in ./migrations in filename order. Files must be idempotent.
const migrationsDir = path.resolve(import.meta.dirname, "../migrations");

try {
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await pool.query(sql);
    console.log(`Applied ${file}`);
  }
  console.log("Migrations complete.");
} catch (err) {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
