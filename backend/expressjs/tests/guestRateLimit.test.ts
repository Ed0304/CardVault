import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { spawnSync } from "node:child_process";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { config } from "../src/lib/config.js";
import { signAccessToken } from "../src/lib/jwt.js";
import { optionalAuthenticate } from "../src/middleware/authenticate.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { guestCommunityRateLimiter, guestRateLimit } from "../src/middleware/guestRateLimit.js";

/**
 * Guest rate limiting without a database (TASK-DISC-022): client identification under each
 * proxy setting, the signed-in bypass, headers, and configuration validation. The routes on the
 * real app are covered in discovery.integration.test.ts.
 */
const limits = config.guestRateLimit as { limit: number; windowSeconds: number };
const originalLimit = limits.limit;

/** A stand-in for a community read route, with the same middleware order. */
function appTrusting(hops: number) {
  const app = express();
  app.set("trust proxy", hops);
  app.use(cookieParser());
  app.get("/read", optionalAuthenticate, guestRateLimit, (_req, res) => {
    res.json({ data: "ok", error: null, message: "Success" });
  });
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  guestCommunityRateLimiter.reset();
  limits.limit = 2;
});

afterAll(() => {
  limits.limit = originalLimit;
  guestCommunityRateLimiter.reset();
});

describe("guest rate limit middleware", () => {
  it("allows guests up to the limit, then answers 429 with Retry-After", async () => {
    const app = appTrusting(0);
    const first = await request(app).get("/read");
    const second = await request(app).get("/read");
    const third = await request(app).get("/read");
    expect([first.status, second.status, third.status]).toEqual([200, 200, 429]);
    expect(third.body).toEqual({
      data: null,
      error: { code: "GUEST_RATE_LIMITED" },
      message: expect.stringContaining("log in to keep browsing"),
    });
    const retryAfter = Number(third.headers["retry-after"]);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(limits.windowSeconds);
  });

  it("sends RateLimit headers that count down", async () => {
    const app = appTrusting(0);
    const first = await request(app).get("/read");
    expect(first.headers["ratelimit-limit"]).toBe("2");
    expect(first.headers["ratelimit-remaining"]).toBe("1");
    expect(first.headers["ratelimit-policy"]).toBe(`2;w=${limits.windowSeconds}`);
    expect(Number(first.headers["ratelimit-reset"])).toBeGreaterThan(0);
    expect((await request(app).get("/read")).headers["ratelimit-remaining"]).toBe("0");
    expect((await request(app).get("/read")).headers["ratelimit-remaining"]).toBe("0");
  });

  it("does not count or limit a signed-in reader", async () => {
    const app = appTrusting(0);
    const cookie = `cv_token=${signAccessToken(crypto.randomUUID())}`;
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/read").set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.headers["ratelimit-limit"]).toBeUndefined();
    }
    // The signed-in requests used none of the guest allowance from the same address.
    expect((await request(app).get("/read")).headers["ratelimit-remaining"]).toBe("1");
  });

  it("counts a request with an invalid session cookie as a guest", async () => {
    const app = appTrusting(0);
    const forged = "cv_token=not.a.valid.token";
    await request(app).get("/read").set("Cookie", forged);
    await request(app).get("/read").set("Cookie", forged);
    expect((await request(app).get("/read").set("Cookie", forged)).status).toBe(429);
  });

  it("ignores X-Forwarded-For when no proxy is trusted (default), so it cannot be spoofed", async () => {
    const app = appTrusting(0);
    await request(app).get("/read").set("X-Forwarded-For", "203.0.113.1");
    await request(app).get("/read").set("X-Forwarded-For", "203.0.113.2");
    // Different claimed addresses, one real client: the third request is limited.
    expect((await request(app).get("/read").set("X-Forwarded-For", "203.0.113.3")).status).toBe(429);
  });

  it("with one trusted proxy, limits each client address separately", async () => {
    const app = appTrusting(1);
    for (let i = 0; i < 2; i++) await request(app).get("/read").set("X-Forwarded-For", "203.0.113.10");
    expect((await request(app).get("/read").set("X-Forwarded-For", "203.0.113.10")).status).toBe(429);
    expect((await request(app).get("/read").set("X-Forwarded-For", "203.0.113.11")).status).toBe(200);
  });

  it("with one trusted proxy, uses the address the proxy added, not ones the client prepended", async () => {
    const app = appTrusting(1);
    await request(app).get("/read").set("X-Forwarded-For", "198.51.100.1, 203.0.113.20");
    await request(app).get("/read").set("X-Forwarded-For", "198.51.100.2, 203.0.113.20");
    expect((await request(app).get("/read").set("X-Forwarded-For", "198.51.100.3, 203.0.113.20")).status).toBe(429);
  });

  it("applies a changed limit without a restart", async () => {
    const app = appTrusting(0);
    limits.limit = 1;
    expect((await request(app).get("/read")).status).toBe(200);
    expect((await request(app).get("/read")).status).toBe(429);
  });
});

describe("guest rate limit configuration", () => {
  const backendRoot = path.resolve(import.meta.dirname, "..");

  /** Loads src/lib/config.ts in a fresh Node process with the given variables. */
  function loadConfig(extra: Record<string, string>) {
    const env: Record<string, string> = {
      PATH: process.env.PATH ?? "",
      SystemRoot: process.env.SystemRoot ?? "",
      // Never read the developer's .env.
      DOTENV_CONFIG_PATH: path.join(backendRoot, "does-not-exist.env"),
      DOTENV_CONFIG_QUIET: "true",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      JWT_SECRET: "test-secret-test-secret-test-secret-123456",
      ...extra,
    };
    const script =
      "const { config } = await import('./src/lib/config.ts');" +
      "console.log('CONFIG=' + JSON.stringify({ guest: config.guestRateLimit, hops: config.trustProxyHops }));";
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
      cwd: backendRoot,
      env,
      encoding: "utf8",
      timeout: 30_000,
    });
    const line = result.stdout.split(/\r?\n/).find((l) => l.startsWith("CONFIG="));
    return { status: result.status, config: line ? JSON.parse(line.slice(7)) : null, stderr: result.stderr };
  }

  it("uses safe defaults when nothing is set", () => {
    const { status, config: loaded } = loadConfig({});
    expect(status).toBe(0);
    expect(loaded).toEqual({ guest: { limit: 120, windowSeconds: 60 }, hops: 0 });
  });

  it("reads valid values", () => {
    const { config: loaded } = loadConfig({
      GUEST_COMMUNITY_RATE_LIMIT: "300",
      GUEST_COMMUNITY_RATE_WINDOW_SECONDS: "120",
      TRUST_PROXY_HOPS: "1",
    });
    expect(loaded).toEqual({ guest: { limit: 300, windowSeconds: 120 }, hops: 1 });
  });

  it.each([
    ["GUEST_COMMUNITY_RATE_LIMIT", "0"],
    ["GUEST_COMMUNITY_RATE_LIMIT", "many"],
    ["GUEST_COMMUNITY_RATE_LIMIT", "1.5"],
    ["GUEST_COMMUNITY_RATE_WINDOW_SECONDS", "0"],
    ["GUEST_COMMUNITY_RATE_WINDOW_SECONDS", "86400"],
    ["TRUST_PROXY_HOPS", "-1"],
    ["TRUST_PROXY_HOPS", "true"],
  ])("refuses to start with %s=%s and names the variable", (name, value) => {
    const { status, config: loaded, stderr } = loadConfig({ [name]: value });
    expect(status).not.toBe(0);
    expect(loaded).toBeNull();
    expect(stderr).toContain(`Invalid environment configuration. ${name}:`);
  });
});
