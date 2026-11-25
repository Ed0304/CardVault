import { describe, expect } from "@jest/globals";
import request from "supertest";
import app from "../../src/app.js";
import { pool } from "../../src/lib/db.js";

/**
 * Shared helpers for tests that run against a real PostgreSQL database.
 *
 * They run only when TEST_DATABASE_URL is set, and refuse to run unless the database name ends
 * in "_test" (created by `npm run db:test:setup`). Each test file deletes only the users, and
 * the rows of the users, that it created itself.
 */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL;

/** Runs the block when a test database is configured; otherwise reports it as skipped. */
export function describeIntegration(name: string, fn: () => void): void {
  (testDatabaseUrl ? describe : describe.skip)(name, fn);
}

export function assertTestDatabase(): void {
  const name = new URL(testDatabaseUrl as string).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL must name a database ending in _test");
  }
}

export interface Session {
  userId: string;
  cookie: string;
}

/** Tracks the users a test file creates, so it can clean up exactly those. */
export function createUserTracker() {
  const userIds: string[] = [];

  async function signUp(name: string): Promise<Session> {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: name,
        email: `${name}-${crypto.randomUUID()}@integration.test`,
        password: "IntegrationPass123!",
      });
    expect(res.status).toBe(201);
    const setCookie = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
    const cookie = setCookie.find((c) => c.startsWith("cv_token="))!.split(";")[0] as string;
    userIds.push(res.body.data.user.id);
    return { userId: res.body.data.user.id, cookie };
  }

  /** Tracks a user created outside signUp, so cleanUp removes it too. */
  async function track(userId: string): Promise<void> {
    userIds.push(userId);
  }

  /** Deletes the tracked users and everything they own, then closes the pool. */
  async function cleanUp(): Promise<void> {
    if (userIds.length > 0) {
      // card_tags rows go with their cards (ON DELETE CASCADE).
      await pool.query("DELETE FROM knowledge_cards WHERE user_id = ANY($1::uuid[])", [userIds]);
      await pool.query("DELETE FROM tags WHERE user_id = ANY($1::uuid[])", [userIds]);
      await pool.query("DELETE FROM collections WHERE user_id = ANY($1::uuid[])", [userIds]);
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
    }
    await pool.end();
  }

  return { signUp, track, cleanUp };
}

/** Requests sent as a signed-in user. */
export function as(session: Session) {
  return {
    get: (url: string) => request(app).get(url).set("Cookie", session.cookie),
    post: (url: string, body?: object) => request(app).post(url).set("Cookie", session.cookie).send(body),
    patch: (url: string, body?: object) => request(app).patch(url).set("Cookie", session.cookie).send(body),
    put: (url: string, body?: object) => request(app).put(url).set("Cookie", session.cookie).send(body),
    delete: (url: string) => request(app).delete(url).set("Cookie", session.cookie),
  };
}

export { app, pool };
