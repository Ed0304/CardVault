import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { spawnSync } from "node:child_process";
import path from "node:path";
import request from "supertest";
import type { UserRecord } from "../src/services/userService.js";

/**
 * Login and registration rate limits (TASK-AUTH-025), without a database: the user and refresh
 * token services are replaced with in-memory stand-ins, as in tests/auth.test.ts.
 */
const users: UserRecord[] = [];

jest.unstable_mockModule("../src/services/userService.js", () => ({
  createUser: async (input: { username: string; email: string; passwordHash: string }): Promise<UserRecord> => {
    if (users.some((u) => u.email === input.email)) {
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    }
    const user: UserRecord = {
      id: crypto.randomUUID(),
      username: input.username,
      email: input.email,
      passwordHash: input.passwordHash,
      createdAt: new Date(),
      onboardingCompleted: false,
    };
    users.push(user);
    return user;
  },
  findUserByEmail: async (email: string) => users.find((u) => u.email === email) ?? null,
  findUserById: async (id: string) => users.find((u) => u.id === id) ?? null,
}));

jest.unstable_mockModule("../src/services/refreshTokenService.js", () => ({
  issueRefreshToken: async () => ({ token: "stub-refresh-token", expiresAt: new Date(Date.now() + 60_000) }),
  REFRESH_SUPERSEDED: "REFRESH_SUPERSEDED",
  rotateRefreshToken: async () => {
    throw new Error("not used in this file");
  },
  revokeRefreshTokenFamily: async () => undefined,
}));

const { default: app } = await import("../src/app.js");
const { config } = await import("../src/lib/config.js");
const { loginAccountLimiter, loginIpLimiter, registerIpLimiter } = await import("../src/middleware/authRateLimit.js");

const limits = config.authRateLimit as {
  loginIpLimit: number;
  loginAccountLimit: number;
  loginWindowSeconds: number;
  registerIpLimit: number;
  registerWindowSeconds: number;
};
const original = { ...limits };
const originalTrustProxy = app.get("trust proxy");

const PASSWORD = "SecurePassword123!";
const owner = { username: "owner", email: "owner@example.com", password: PASSWORD };

const login = (email: string, password: string, forwardedFor?: string) => {
  const req = request(app).post("/api/auth/login");
  if (forwardedFor) req.set("X-Forwarded-For", forwardedFor);
  return req.send({ email, password });
};
const register = (n: number, forwardedFor?: string) => {
  const req = request(app).post("/api/auth/register");
  if (forwardedFor) req.set("X-Forwarded-For", forwardedFor);
  return req.send({ username: `user${n}`, email: `user${n}@example.com`, password: PASSWORD });
};

beforeEach(async () => {
  users.length = 0;
  for (const limiter of [loginIpLimiter, loginAccountLimiter, registerIpLimiter]) limiter.reset();
  Object.assign(limits, original, { registerIpLimit: 1000 });
  app.set("trust proxy", originalTrustProxy);
  // The account every login test targets.
  expect((await request(app).post("/api/auth/register").send(owner)).status).toBe(201);
  registerIpLimiter.reset();
});

afterEach(() => {
  app.set("trust proxy", originalTrustProxy);
});

afterAll(() => {
  Object.assign(limits, original);
});

function expectLoginLimited(res: request.Response): void {
  expect(res.status).toBe(429);
  expect(res.body).toEqual({
    data: null,
    error: { code: "AUTH_RATE_LIMITED" },
    message: "Too many login attempts. Please wait a few minutes and try again.",
  });
  const retryAfter = Number(res.headers["retry-after"]);
  expect(retryAfter).toBeGreaterThan(0);
  expect(retryAfter).toBeLessThanOrEqual(limits.loginWindowSeconds);
  expect(res.headers["set-cookie"]).toBeUndefined();
}

describe("login rate limit", () => {
  it("answers failed logins normally below the limit, then 429 with Retry-After", async () => {
    limits.loginAccountLimit = 3;
    for (let i = 0; i < 3; i++) expect((await login(owner.email, "WrongPassword1!")).status).toBe(401);
    expectLoginLimited(await login(owner.email, "WrongPassword1!"));
  });

  it("does not count successful logins", async () => {
    limits.loginIpLimit = 2;
    limits.loginAccountLimit = 2;
    for (let i = 0; i < 6; i++) {
      const res = await login(owner.email, PASSWORD);
      expect(res.status).toBe(200);
      expect(res.headers["set-cookie"]).toBeDefined();
    }
    // The allowance for failures is still whole.
    for (let i = 0; i < 2; i++) expect((await login(owner.email, "WrongPassword1!")).status).toBe(401);
    expectLoginLimited(await login(owner.email, "WrongPassword1!"));
  });

  it("refuses the correct password too while limited, and issues no session", async () => {
    limits.loginAccountLimit = 2;
    for (let i = 0; i < 2; i++) await login(owner.email, "WrongPassword1!");
    expectLoginLimited(await login(owner.email, PASSWORD));
  });

  it("limits all failed logins from one IP across accounts", async () => {
    limits.loginIpLimit = 4;
    for (let i = 0; i < 4; i++) expect((await login(`guess${i}@example.com`, "WrongPassword1!")).status).toBe(401);
    expectLoginLimited(await login("another@example.com", "WrongPassword1!"));
  });

  it("does not use up the IP allowance on attempts refused by the account limit", async () => {
    limits.loginIpLimit = 5;
    limits.loginAccountLimit = 2;
    for (let i = 0; i < 2; i++) await login(owner.email, "WrongPassword1!");
    for (let i = 0; i < 4; i++) expectLoginLimited(await login(owner.email, "WrongPassword1!"));
    // 2 of 5 used: three more failures on other accounts are still answered normally.
    for (let i = 0; i < 3; i++) expect((await login(`other${i}@example.com`, "WrongPassword1!")).status).toBe(401);
    expectLoginLimited(await login("other9@example.com", "WrongPassword1!"));
  });

  it("answers known and unknown email addresses identically, limited or not", async () => {
    limits.loginAccountLimit = 2;
    const known: request.Response[] = [];
    const unknown: request.Response[] = [];
    for (let i = 0; i < 3; i++) {
      known.push(await login(owner.email, "WrongPassword1!"));
      unknown.push(await login("nobody@example.com", "WrongPassword1!"));
    }
    expect(known.map((r) => r.status)).toEqual([401, 401, 429]);
    expect(unknown.map((r) => r.status)).toEqual([401, 401, 429]);
    for (let i = 0; i < 3; i++) {
      expect(known[i]!.body).toEqual(unknown[i]!.body);
      expect(known[i]!.headers["retry-after"] === undefined).toBe(unknown[i]!.headers["retry-after"] === undefined);
    }
  });

  it("counts an email the same however it is capitalised or padded", async () => {
    limits.loginAccountLimit = 2;
    await login("OWNER@example.com", "WrongPassword1!");
    await login("  owner@EXAMPLE.com ", "WrongPassword1!");
    expectLoginLimited(await login(owner.email, "WrongPassword1!"));
  });

  it("does not count malformed requests, which never reach a password check", async () => {
    limits.loginIpLimit = 1;
    for (let i = 0; i < 5; i++) expect((await request(app).post("/api/auth/login").send({ email: "x" })).status).toBe(400);
    expect((await login(owner.email, "WrongPassword1!")).status).toBe(401);
  });

  it("never logs the email or password", async () => {
    limits.loginAccountLimit = 1;
    const spies = (["log", "info", "warn", "error"] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
    try {
      await login(owner.email, "SecretGuess999!");
      await login(owner.email, "SecretGuess999!");
      const output = spies.flatMap((s) => s.mock.calls.flat()).map(String).join("\n");
      expect(output).not.toContain("SecretGuess999!");
      expect(output).not.toContain(owner.email);
    } finally {
      for (const s of spies) s.mockRestore();
    }
  });
});

describe("client identification", () => {
  it("ignores X-Forwarded-For when no proxy is trusted (the default), so a client cannot dodge the limit", async () => {
    expect(originalTrustProxy).toBe(0);
    limits.loginAccountLimit = 2;
    await login(owner.email, "WrongPassword1!", "203.0.113.1");
    await login(owner.email, "WrongPassword1!", "203.0.113.2");
    expectLoginLimited(await login(owner.email, "WrongPassword1!", "203.0.113.3"));
  });

  it("with one trusted proxy, an attacker elsewhere cannot lock the owner out", async () => {
    app.set("trust proxy", 1);
    limits.loginAccountLimit = 3;
    for (let i = 0; i < 3; i++) await login(owner.email, "WrongPassword1!", "198.51.100.7");
    expectLoginLimited(await login(owner.email, PASSWORD, "198.51.100.7"));
    // The owner, from their own address, still logs in.
    expect((await login(owner.email, PASSWORD, "203.0.113.50")).status).toBe(200);
  });

  it("with one trusted proxy, uses the address the proxy added, not ones the client prepended", async () => {
    app.set("trust proxy", 1);
    limits.loginIpLimit = 2;
    await login("a@example.com", "WrongPassword1!", "10.0.0.1, 198.51.100.8");
    await login("b@example.com", "WrongPassword1!", "10.0.0.2, 198.51.100.8");
    expectLoginLimited(await login("c@example.com", "WrongPassword1!", "10.0.0.3, 198.51.100.8"));
  });
});

describe("registration rate limit", () => {
  it("allows registrations below the limit, then answers 429 with Retry-After", async () => {
    limits.registerIpLimit = 2;
    expect((await register(1)).status).toBe(201);
    expect((await register(2)).status).toBe(201);
    const limited = await register(3);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      data: null,
      error: { code: "AUTH_RATE_LIMITED" },
      message: "Too many accounts have been created from this network recently. Please try again later.",
    });
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(limited.headers["retry-after"])).toBeLessThanOrEqual(limits.registerWindowSeconds);
    expect(limited.headers["set-cookie"]).toBeUndefined();
    expect(users.some((u) => u.email === "user3@example.com")).toBe(false);
  });

  it("counts every attempt that passes validation, including a duplicate email", async () => {
    limits.registerIpLimit = 2;
    expect((await register(1)).status).toBe(201);
    expect((await register(1)).status).toBe(409);
    expect((await register(2)).status).toBe(429);
  });

  it("does not count requests rejected by validation", async () => {
    limits.registerIpLimit = 1;
    for (let i = 0; i < 5; i++) {
      expect((await request(app).post("/api/auth/register").send({ email: "not-an-email" })).status).toBe(400);
    }
    expect((await register(1)).status).toBe(201);
  });

  it("limits each client address separately behind a trusted proxy", async () => {
    app.set("trust proxy", 1);
    limits.registerIpLimit = 1;
    expect((await register(1, "203.0.113.60")).status).toBe(201);
    expect((await register(2, "203.0.113.60")).status).toBe(429);
    expect((await register(3, "203.0.113.61")).status).toBe(201);
  });
});

describe("separate policies and unaffected routes", () => {
  it("keeps login and registration allowances apart", async () => {
    limits.registerIpLimit = 1;
    limits.loginIpLimit = 1;
    expect((await register(1)).status).toBe(201);
    expect((await register(2)).status).toBe(429);
    // Registration is exhausted; login still works, and its own limit applies.
    expect((await login(owner.email, PASSWORD)).status).toBe(200);
    expect((await login(owner.email, "WrongPassword1!")).status).toBe(401);
    expectLoginLimited(await login(owner.email, "WrongPassword1!"));
    registerIpLimiter.reset();
    expect((await register(3)).status).toBe(201);
  });

  it("leaves refresh, logout, me and other routes alone while both limits are reached", async () => {
    limits.registerIpLimit = 1;
    limits.loginIpLimit = 1;
    await register(1);
    await register(2);
    await login("x@example.com", "WrongPassword1!");
    expectLoginLimited(await login("y@example.com", "WrongPassword1!"));

    const responses = await Promise.all([
      request(app).post("/api/auth/refresh"),
      request(app).post("/api/auth/logout"),
      request(app).get("/api/auth/me"),
      request(app).get("/"),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 200, 401, 200]);
  });

  it("keeps a valid session working while its IP is limited", async () => {
    const ok = await login(owner.email, PASSWORD);
    const cookie = ([] as string[]).concat(ok.headers["set-cookie"] ?? []).find((c) => c.startsWith("cv_token="))!.split(";")[0]!;
    limits.loginIpLimit = 1;
    await login("x@example.com", "WrongPassword1!");
    expectLoginLimited(await login("y@example.com", "WrongPassword1!"));
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(owner.email);
  });
});

describe("authentication rate limit configuration", () => {
  const backendRoot = path.resolve(import.meta.dirname, "..");

  function loadConfig(extra: Record<string, string>) {
    const env: Record<string, string> = {
      PATH: process.env.PATH ?? "",
      SystemRoot: process.env.SystemRoot ?? "",
      DOTENV_CONFIG_PATH: path.join(backendRoot, "does-not-exist.env"),
      DOTENV_CONFIG_QUIET: "true",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      JWT_SECRET: "test-secret-test-secret-test-secret-123456",
      ...extra,
    };
    const script =
      "const { config } = await import('./src/lib/config.ts');" +
      "console.log('CONFIG=' + JSON.stringify(config.authRateLimit));";
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
      cwd: backendRoot,
      env,
      encoding: "utf8",
      timeout: 30_000,
    });
    const line = result.stdout.split(/\r?\n/).find((l) => l.startsWith("CONFIG="));
    return { status: result.status, config: line ? JSON.parse(line.slice(7)) : null, stderr: result.stderr };
  }

  it("uses the documented defaults when nothing is set", () => {
    const { status, config: loaded } = loadConfig({});
    expect(status).toBe(0);
    expect(loaded).toEqual({
      loginIpLimit: 30,
      loginAccountLimit: 10,
      loginWindowSeconds: 900,
      registerIpLimit: 10,
      registerWindowSeconds: 3600,
    });
  });

  it.each([
    ["AUTH_LOGIN_IP_LIMIT", "0"],
    ["AUTH_LOGIN_ACCOUNT_LIMIT", "lots"],
    ["AUTH_LOGIN_WINDOW_SECONDS", "30"],
    ["AUTH_REGISTER_IP_LIMIT", "2.5"],
    ["AUTH_REGISTER_WINDOW_SECONDS", "999999"],
  ])("refuses to start with %s=%s and names the variable", (name, value) => {
    const { status, config: loaded, stderr } = loadConfig({ [name]: value });
    expect(status).not.toBe(0);
    expect(loaded).toBeNull();
    expect(stderr).toContain(`Invalid environment configuration. ${name}:`);
  });
});
