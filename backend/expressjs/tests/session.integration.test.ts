import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import {
  app,
  assertTestDatabase,
  createUserTracker,
  describeIntegration,
  pool,
} from "./helpers/integration.js";

/** Refresh-token sessions (TASK-AUTH-025) against a real PostgreSQL database. */
const users = createUserTracker();

interface Cookies {
  access: string | undefined;
  refresh: string | undefined;
  setCookie: string[];
}

function cookiesOf(res: request.Response): Cookies {
  const setCookie = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const value = (name: string) => {
    const header = setCookie.find((c) => c.startsWith(`${name}=`));
    if (!header) return undefined;
    const pair = header.split(";")[0] as string;
    return pair.slice(name.length + 1) || undefined;
  };
  return { access: value("cv_token"), refresh: value("cv_refresh"), setCookie };
}

async function register(name: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      username: name,
      email: `${name}-${crypto.randomUUID()}@integration.test`,
      password: "IntegrationPass123!",
    });
  expect(res.status).toBe(201);
  // Track the user so cleanup removes it (refresh_tokens rows go with it: ON DELETE CASCADE).
  await users.track(res.body.data.user.id);
  return { userId: res.body.data.user.id as string, email: res.body.data.user.email as string, ...cookiesOf(res) };
}

const refresh = (token: string) =>
  request(app).post("/api/auth/refresh").set("Cookie", `cv_refresh=${token}`);

const familyOf = async (token: string) => {
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update(token).digest("hex");
  const row = await pool.query<{ family_id: string }>(
    "SELECT family_id FROM refresh_tokens WHERE token_hash = $1",
    [hash],
  );
  return row.rows[0]!.family_id;
};

describeIntegration("Refresh-token sessions (real database)", () => {
  beforeAll(() => {
    assertTestDatabase();
  });

  afterAll(async () => {
    await users.cleanUp();
  });

  it("issues an HttpOnly refresh cookie on registration and login, never in the body", async () => {
    const reg = await register("sessreg");
    expect(reg.refresh).toBeDefined();
    const header = reg.setCookie.find((c) => c.startsWith("cv_refresh="))!;
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).toMatch(/Path=\//);
    // About 7 days.
    const maxAge = Number(/Max-Age=(\d+)/.exec(header)?.[1]);
    expect(maxAge).toBeGreaterThan(6 * 24 * 3600);
    expect(maxAge).toBeLessThanOrEqual(7 * 24 * 3600);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: reg.email, password: "IntegrationPass123!" });
    expect(login.status).toBe(200);
    expect(cookiesOf(login).refresh).toBeDefined();
    expect(JSON.stringify(login.body)).not.toContain(cookiesOf(login).refresh as string);
  });

  it("stores only a hash of the refresh token", async () => {
    const reg = await register("sesshash");
    const rows = await pool.query<{ token_hash: string }>(
      "SELECT token_hash FROM refresh_tokens WHERE user_id = $1",
      [reg.userId],
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]!.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows.rows[0]!.token_hash).not.toBe(reg.refresh);
  });

  it("exchanges a refresh token for a new access token and a new refresh token", async () => {
    const reg = await register("sessrotate");
    const res = await refresh(reg.refresh!);
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(reg.userId);

    const next = cookiesOf(res);
    expect(next.access).toBeDefined();
    expect(next.refresh).toBeDefined();
    expect(next.refresh).not.toBe(reg.refresh);

    const me = await request(app).get("/api/auth/me").set("Cookie", `cv_token=${next.access}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.id).toBe(reg.userId);

    // The rotated token keeps working for another round.
    expect((await refresh(next.refresh!)).status).toBe(200);
  });

  it("refuses a missing or unknown refresh token with 401 and clears both cookies", async () => {
    const none = await request(app).post("/api/auth/refresh");
    expect(none.status).toBe(401);
    const unknown = await refresh("not-a-real-token");
    expect(unknown.status).toBe(401);
    const cleared = cookiesOf(unknown).setCookie;
    expect(cleared.some((c) => c.startsWith("cv_token=;"))).toBe(true);
    expect(cleared.some((c) => c.startsWith("cv_refresh=;"))).toBe(true);
  });

  it("treats a quick second use of a rotated token as a race, not theft", async () => {
    const reg = await register("sessrace");
    const winner = cookiesOf(await refresh(reg.refresh!));
    const loser = await refresh(reg.refresh!);
    expect(loser.status).toBe(401);
    expect(loser.body.error.code).toBe("REFRESH_SUPERSEDED");
    // The losing response must not clear the cookies the winning response set.
    expect(cookiesOf(loser).setCookie).toEqual([]);
    // The session survives: the token the winner received still works.
    expect((await refresh(winner.refresh!)).status).toBe(200);
  });

  it("revokes the whole session when a rotated token comes back later (theft)", async () => {
    const reg = await register("sesstheft");
    const next = cookiesOf(await refresh(reg.refresh!));

    // Pretend the original token was rotated well outside the grace window.
    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = now() - interval '5 minutes' WHERE user_id = $1 AND replaced_by IS NOT NULL",
      [reg.userId],
    );
    expect((await refresh(reg.refresh!)).status).toBe(401);
    // The thief's replay also signed out the legitimate holder.
    expect((await refresh(next.refresh!)).status).toBe(401);

    const live = await pool.query(
      "SELECT 1 FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL",
      [reg.userId],
    );
    expect(live.rowCount).toBe(0);
  });

  it("refuses a token after its idle limit and after the session's absolute limit", async () => {
    const idle = await register("sessidle");
    await pool.query("UPDATE refresh_tokens SET expires_at = now() - interval '1 second' WHERE user_id = $1", [
      idle.userId,
    ]);
    expect((await refresh(idle.refresh!)).status).toBe(401);

    const capped = await register("sesscap");
    await pool.query(
      "UPDATE refresh_tokens SET family_expires_at = now() - interval '1 second' WHERE user_id = $1",
      [capped.userId],
    );
    expect((await refresh(capped.refresh!)).status).toBe(401);
  });

  it("never extends a session past its absolute limit", async () => {
    const reg = await register("sesslimit");
    await pool.query(
      "UPDATE refresh_tokens SET family_expires_at = now() + interval '1 hour' WHERE user_id = $1",
      [reg.userId],
    );
    const res = await refresh(reg.refresh!);
    expect(res.status).toBe(200);
    const header = cookiesOf(res).setCookie.find((c) => c.startsWith("cv_refresh="))!;
    expect(Number(/Max-Age=(\d+)/.exec(header)?.[1])).toBeLessThanOrEqual(3600);
  });

  it("does not call a reuse a race once the session has been logged out", async () => {
    const reg = await register("sessracelogout");
    const next = cookiesOf(await refresh(reg.refresh!));
    await request(app).post("/api/auth/logout").set("Cookie", `cv_refresh=${next.refresh}`);
    const reuse = await refresh(reg.refresh!);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe("UNAUTHORIZED");
  });

  it("logout revokes the session, so the refresh token stops working", async () => {
    const reg = await register("sesslogout");
    const family = await familyOf(reg.refresh!);
    const out = await request(app).post("/api/auth/logout").set("Cookie", `cv_refresh=${reg.refresh}`);
    expect(out.status).toBe(200);
    expect((await refresh(reg.refresh!)).status).toBe(401);
    const live = await pool.query(
      "SELECT 1 FROM refresh_tokens WHERE family_id = $1 AND revoked_at IS NULL",
      [family],
    );
    expect(live.rowCount).toBe(0);
  });

  it("logout of one session leaves the user's other sessions signed in", async () => {
    const reg = await register("sessmulti");
    const second = await request(app)
      .post("/api/auth/login")
      .send({ email: reg.email, password: "IntegrationPass123!" });
    const otherDevice = cookiesOf(second).refresh!;

    await request(app).post("/api/auth/logout").set("Cookie", `cv_refresh=${reg.refresh}`);
    expect((await refresh(otherDevice)).status).toBe(200);
  });
});
