import { afterAll, beforeAll, expect, it } from "@jest/globals";
import request from "supertest";
import { app, assertTestDatabase, createUserTracker, describeIntegration, pool } from "./helpers/integration.js";

/** Username and email uniqueness at registration, against a real database (TASK-AUTH-027). */
const users = createUserTracker();
const RUN = `r${Date.now().toString(36)}`;

function register(username: string, email: string) {
  return request(app).post("/api/auth/register").send({ username, email, password: "IntegrationPass123!" });
}

describeIntegration("Registration uniqueness (real database)", () => {
  beforeAll(async () => {
    assertTestDatabase();
    const first = await register(`Uniq${RUN}`, `uniq-${RUN}@integration.test`);
    expect(first.status).toBe(201);
    await users.track(first.body.data.user.id);
  });

  afterAll(async () => {
    await users.cleanUp();
  });

  it("has the case-insensitive unique index from migration 009", async () => {
    const index = await pool.query<{ indexdef: string }>(
      "SELECT indexdef FROM pg_indexes WHERE tablename = 'users' AND indexname = 'users_username_lower_key'",
    );
    expect(index.rows[0]?.indexdef).toMatch(/UNIQUE INDEX .* \(lower\(\(username\)::text\)\)/);
  });

  it("refuses a taken username, in any letter case, with a different email", async () => {
    for (const username of [`Uniq${RUN}`, `uniq${RUN}`, `UNIQ${RUN.toUpperCase()}`]) {
      const res = await register(username, `other-${crypto.randomUUID()}@integration.test`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("USERNAME_TAKEN");
      expect(res.headers["set-cookie"]).toBeUndefined();
    }
    const rows = await pool.query("SELECT 1 FROM users WHERE lower(username) = lower($1)", [`Uniq${RUN}`]);
    expect(rows.rowCount).toBe(1);
  });

  it("still refuses a registered email with its own error", async () => {
    const res = await register(`Fresh${RUN}`, `uniq-${RUN}@integration.test`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("lets only one of two simultaneous registrations with the same username through", async () => {
    const name = `Race${RUN}`;
    const results = await Promise.all([
      register(name, `race-a-${RUN}@integration.test`),
      register(name.toLowerCase(), `race-b-${RUN}@integration.test`),
    ]);
    for (const res of results) if (res.status === 201) await users.track(res.body.data.user.id);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)?.body.error.code).toBe("USERNAME_TAKEN");
  });

  it("accepts a different username", async () => {
    const res = await register(`Other${RUN}`, `other-${RUN}@integration.test`);
    expect(res.status).toBe(201);
    await users.track(res.body.data.user.id);
  });
});
