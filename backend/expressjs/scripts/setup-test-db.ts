import "dotenv/config";
import { spawnSync } from "node:child_process";
import path from "node:path";
import pg from "pg";

/**
 * Creates a separate local database for integration tests and applies every migration to it.
 *
 * The test database is "<your database>_test" on the same server as DATABASE_URL, so tests never
 * touch development data. It only creates; it never drops or truncates anything. Safe to re-run.
 *
 * Usage: npm run db:test:setup
 * Then run the tests with TEST_DATABASE_URL pointing at the printed database name.
 */
const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  console.error("DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}

const base = new URL(baseUrl);
const devName = decodeURIComponent(base.pathname.replace(/^\//, ""));
const testName = `${devName}_test`;

// The name goes into CREATE DATABASE, which cannot take a bound parameter, so allow only a
// conservative character set.
if (!/^[A-Za-z0-9_]+$/.test(testName)) {
  console.error(`Refusing to create a database with an unusual name: ${testName}`);
  process.exit(1);
}

const adminUrl = new URL(base);
adminUrl.pathname = "/postgres";

const admin = new pg.Client({ connectionString: adminUrl.toString() });
try {
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [testName]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${testName}"`);
    console.log(`Created database ${testName}.`);
  } else {
    console.log(`Database ${testName} already exists.`);
  }
} catch (err) {
  console.error("Could not create the test database:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await admin.end();
}

const testUrl = new URL(base);
testUrl.pathname = `/${testName}`;

const tsxCli = path.resolve(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
const migrate = spawnSync(process.execPath, [tsxCli, path.resolve(import.meta.dirname, "migrate.ts")], {
  env: { ...process.env, DATABASE_URL: testUrl.toString() },
  stdio: "inherit",
});
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

// The URL contains the password, so only the database name is printed.
console.log(`Test database ready: ${testName}. Set TEST_DATABASE_URL to the same URL as`);
console.log(`DATABASE_URL with the database name changed to ${testName}, then run npm test.`);
