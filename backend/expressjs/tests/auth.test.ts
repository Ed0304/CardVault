import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import argon2 from "argon2";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { UserRecord } from "../src/services/userService.js";

// In-memory stand-in for the PostgreSQL-backed user service. It mimics the
// UNIQUE(email) constraint by throwing a pg-style 23505 error.
const users: UserRecord[] = [];

jest.unstable_mockModule("../src/services/userService.js", () => ({
  createUser: async (input: {
    username: string;
    email: string;
    passwordHash: string;
  }): Promise<UserRecord> => {
    if (users.some((u) => u.email === input.email)) {
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    }
    const user: UserRecord = {
      id: crypto.randomUUID(),
      username: input.username,
      email: input.email,
      passwordHash: input.passwordHash,
      createdAt: new Date(),
    };
    users.push(user);
    return user;
  },
  findUserByEmail: async (email: string): Promise<UserRecord | null> =>
    users.find((u) => u.email === email) ?? null,
  findUserById: async (id: string): Promise<UserRecord | null> =>
    users.find((u) => u.id === id) ?? null,
}));

const { default: app } = await import("../src/app.js");
const { authenticate } = await import("../src/middleware/authenticate.js");
const { errorHandler } = await import("../src/middleware/errorHandler.js");

const SECRET = process.env.JWT_SECRET as string;
const validUser = {
  username: "example",
  email: "example@email.com",
  password: "SecurePassword123!",
};

beforeEach(() => {
  users.length = 0;
});

/** Returns the auth Set-Cookie header, or undefined if the response has none. */
function authCookie(res: request.Response): string | undefined {
  const header = res.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.find((c) => c.startsWith("cv_token="));
}

/** The "name=value" part of a Set-Cookie header, ready to send back. */
function cookiePair(setCookie: string): string {
  return setCookie.split(";")[0] as string;
}

function tokenFrom(setCookie: string): string {
  return cookiePair(setCookie).slice("cv_token=".length);
}

describe("POST /api/auth/register", () => {
  it("creates an account and returns 201 with a token and no hash", async () => {
    const res = await request(app).post("/api/auth/register").send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.error).toBeNull();
    expect(res.body.data.user).toMatchObject({
      username: "example",
      email: "example@email.com",
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password|argon2|accessToken/i);

    const cookie = authCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=900/);
  });

  it("normalizes the email to lowercase", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validUser, email: "  Example@Email.COM " });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe("example@email.com");
  });

  it("rejects an invalid email with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validUser, email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects missing required fields with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: validUser.email });

    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["username", "password"]));
  });

  it("rejects a password below the minimum length with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validUser, password: "short" });

    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app).post("/api/auth/register").send(validUser);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validUser, username: "someoneelse", email: "EXAMPLE@email.com" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("stores an Argon2id hash, never the plaintext password", async () => {
    await request(app).post("/api/auth/register").send(validUser);

    const stored = users[0]?.passwordHash ?? "";
    expect(stored).toMatch(/^\$argon2id\$/);
    expect(stored).not.toContain(validUser.password);
    expect(await argon2.verify(stored, validUser.password)).toBe(true);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send(validUser);
  });

  it("logs in with correct credentials and issues a valid JWT", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "Example@email.com", password: validUser.password });

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/argon2/i);

    expect(res.body.data.accessToken).toBeUndefined();
    const claims = jwt.verify(tokenFrom(authCookie(res)!), SECRET, {
      algorithms: ["HS256"],
      issuer: "cardvault-api",
      audience: "cardvault-web",
    }) as jwt.JwtPayload;
    expect(claims.sub).toBe(users[0]?.id);
    expect(claims.exp! - claims.iat!).toBe(900);
    expect(Object.keys(claims).sort()).toEqual(
      ["aud", "exp", "iat", "iss", "sub"],
    );
  });

  it("rejects an incorrect password with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: "WrongPassword123!" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("rejects a nonexistent email with the same 401 response", async () => {
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: "WrongPassword123!" });
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@email.com", password: "WrongPassword123!" });

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it("rejects missing credentials with 400", async () => {
    const res = await request(app).post("/api/auth/login").send({});

    expect(res.status).toBe(400);
  });
});

describe("cookie session: GET /api/auth/me and POST /api/auth/logout", () => {
  it("returns the current user when the session cookie is sent", async () => {
    const reg = await request(app).post("/api/auth/register").send(validUser);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookiePair(authCookie(reg)!));

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: validUser.email });
    expect(JSON.stringify(res.body)).not.toMatch(/password|argon2/i);
  });

  it("also accepts the token as a Bearer header", async () => {
    const reg = await request(app).post("/api/auth/register").send(validUser);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${tokenFrom(authCookie(reg)!)}`);

    expect(res.status).toBe(200);
  });

  it("rejects /me without a session with 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects /me with a tampered cookie with 401", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", "cv_token=not.a.token");
    expect(res.status).toBe(401);
  });

  it("clears the cookie on logout", async () => {
    const res = await request(app).post("/api/auth/logout");

    expect(res.status).toBe(200);
    const cookie = authCookie(res);
    expect(cookie).toMatch(/^cv_token=;/);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe("authenticate middleware", () => {
  const protectedApp = express();
  protectedApp.get("/protected", authenticate, (req, res) => {
    res.json({ userId: req.user?.id });
  });
  protectedApp.use(errorHandler);

  const userId = crypto.randomUUID();
  const claimsOptions = {
    algorithm: "HS256",
    subject: userId,
    issuer: "cardvault-api",
    audience: "cardvault-web",
  } as const;

  it("accepts a valid token and exposes the user id", async () => {
    const token = jwt.sign({}, SECRET, { ...claimsOptions, expiresIn: 60 });
    const res = await request(protectedApp)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(userId);
  });

  it("rejects a missing token with 401", async () => {
    const res = await request(protectedApp).get("/protected");
    expect(res.status).toBe(401);
  });

  it("rejects a garbage token with 401", async () => {
    const res = await request(protectedApp)
      .get("/protected")
      .set("Authorization", "Bearer not.a.token");
    expect(res.status).toBe(401);
  });

  it("rejects an expired token with 401", async () => {
    const token = jwt.sign({}, SECRET, { ...claimsOptions, expiresIn: -10 });
    const res = await request(protectedApp)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("rejects a token signed with another secret with 401", async () => {
    const token = jwt.sign({}, "x".repeat(40), { ...claimsOptions, expiresIn: 60 });
    const res = await request(protectedApp)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("rejects a token with the wrong algorithm (HS512) with 401", async () => {
    const token = jwt.sign({}, SECRET, {
      ...claimsOptions,
      algorithm: "HS512",
      expiresIn: 60,
    });
    const res = await request(protectedApp)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("rejects a token with the wrong audience with 401", async () => {
    const token = jwt.sign({}, SECRET, {
      ...claimsOptions,
      audience: "someone-else",
      expiresIn: 60,
    });
    const res = await request(protectedApp)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
