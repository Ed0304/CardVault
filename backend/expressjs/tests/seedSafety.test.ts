import { describe, expect, it } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { NO_LOGIN_PASSWORD_HASH } from "../src/lib/password.js";

/**
 * Seeds are fixture data, and fixture data is easy to copy into a shared or deployed database.
 * They must never provision an account someone could log in to: no password hash, no password
 * written down, and seed accounts only ever get the no-login marker.
 */
const seedsDir = path.resolve(import.meta.dirname, "../seeds");
const seedFiles = readdirSync(seedsDir).filter((file) => file.endsWith(".sql"));

describe("seed files carry no usable credentials", () => {
  it("finds the seed files", () => {
    expect(seedFiles).toContain("community_catalog_seed.sql");
  });

  it.each(seedFiles)("%s contains no password hash of any common scheme", (file) => {
    const sql = readFileSync(path.join(seedsDir, file), "utf8");
    // Argon2, bcrypt, scrypt and PBKDF2 hash formats.
    expect(sql).not.toMatch(/\$argon2(?:id|i|d)\$/);
    expect(sql).not.toMatch(/\$2[abxy]\$\d{2}\$/);
    expect(sql).not.toMatch(/\$scrypt\$|\$pbkdf2/i);
  });

  it.each(seedFiles)("%s does not write a password down", (file) => {
    const sql = readFileSync(path.join(seedsDir, file), "utf8");
    // A SQL comment that pairs "password" with a value, e.g. "-- Password for every account: Secret1".
    // (Card text is not in comments; it may mention passwords as a topic.)
    const commentLines = sql.split(/\r?\n/).filter((line) => /^\s*--/.test(line));
    for (const line of commentLines) expect(line).not.toMatch(/password[^:]{0,60}:\s*\S{6,}/i);
  });

  it.each(seedFiles)("%s gives every inserted account the no-login marker", (file) => {
    const sql = readFileSync(path.join(seedsDir, file), "utf8");
    const inserts = sql.match(/INSERT INTO users[\s\S]*?;/g) ?? [];
    for (const insert of inserts) {
      // The only literal assigned to password_hash is the marker.
      const literals = [...insert.matchAll(/'([^']*)'/g)].map((m) => m[1]);
      expect(literals).toContain(NO_LOGIN_PASSWORD_HASH);
      expect(insert).toMatch(/password_hash/);
    }
  });

  it("uses a marker that no real password hash can equal", () => {
    expect(NO_LOGIN_PASSWORD_HASH.startsWith("$")).toBe(false);
  });
});
