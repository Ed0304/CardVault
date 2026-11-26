import { createHash, randomBytes } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { config } from "../lib/config.js";
import { AppError } from "../lib/errors.js";
import { createRateLimiter } from "../lib/rateLimit.js";

/**
 * Rate limits for login and registration (TASK-AUTH-025, authentication design D6).
 *
 * Login, after validation, per client IP:
 * - every attempt is counted when it starts, so a burst of parallel requests cannot overshoot;
 * - a successful login (200) gives its attempt back, so only failures use up the allowance;
 * - two allowances apply: all failed logins from the IP (AUTH_LOGIN_IP_LIMIT), and failed logins
 *   from the IP for one email address (AUTH_LOGIN_ACCOUNT_LIMIT).
 *
 * The account allowance is keyed by IP *and* email, never by email alone, so nobody can lock an
 * account by sending its address from elsewhere: the owner's own IP keeps its allowance. Known and
 * unknown addresses are counted and answered identically, so a 429 reveals nothing about which
 * accounts exist. Emails are held only as salted SHA-256 digests (the salt is random per process).
 *
 * Registration, after validation, per client IP: every attempt counts (AUTH_REGISTER_IP_LIMIT),
 * successful or not, since each one hashes a password and may create an account.
 *
 * The client IP is req.ip under TRUST_PROXY_HOPS, as for the guest Community limit. Counts are
 * in memory: they reset on restart and are per process (lib/rateLimit.ts). No request body,
 * email or password is logged.
 */
export const loginIpLimiter = createRateLimiter({
  windowMs: config.authRateLimit.loginWindowSeconds * 1000,
  limit: () => config.authRateLimit.loginIpLimit,
});

export const loginAccountLimiter = createRateLimiter({
  windowMs: config.authRateLimit.loginWindowSeconds * 1000,
  limit: () => config.authRateLimit.loginAccountLimit,
});

export const registerIpLimiter = createRateLimiter({
  windowMs: config.authRateLimit.registerWindowSeconds * 1000,
  limit: () => config.authRateLimit.registerIpLimit,
});

const EMAIL_SALT = randomBytes(16);

/** A salted digest of the (already normalized) email, so raw addresses are never stored. */
function accountKey(ip: string, email: string): string {
  const digest = createHash("sha256").update(EMAIL_SALT).update(email).digest("base64url");
  return `ip:${ip}|acct:${digest}`;
}

const clientIp = (req: Request): string => req.ip ?? "unknown";

function tooMany(message: string, retryAfterSeconds: number): AppError {
  const error = new AppError(429, "AUTH_RATE_LIMITED", message);
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

const LOGIN_LIMITED_MESSAGE = "Too many login attempts. Please wait a few minutes and try again.";

/** Runs after validateBody(loginSchema), so req.body.email is trimmed and lowercased. */
export const loginRateLimit: RequestHandler = (req, res, next) => {
  const ipKey = `ip:${clientIp(req)}`;
  const acctKey = accountKey(clientIp(req), String((req.body as { email?: unknown }).email ?? ""));

  const byIp = loginIpLimiter.consume(ipKey);
  if (!byIp.allowed) {
    next(tooMany(LOGIN_LIMITED_MESSAGE, byIp.retryAfterSeconds));
    return;
  }
  const byAccount = loginAccountLimiter.consume(acctKey);
  if (!byAccount.allowed) {
    // Refused before any password check: it should not use up the IP's shared allowance.
    loginIpLimiter.release(ipKey);
    // The same message as the IP limit, so the response does not say which limit applied.
    next(tooMany(LOGIN_LIMITED_MESSAGE, byAccount.retryAfterSeconds));
    return;
  }

  // Only failed attempts count: a successful login gives its attempt back.
  res.on("finish", () => {
    if (res.statusCode === 200) {
      loginIpLimiter.release(ipKey);
      loginAccountLimiter.release(acctKey);
    }
  });
  next();
};

/** Runs after validateBody(registerSchema). */
export const registerRateLimit: RequestHandler = (req, _res, next) => {
  const decision = registerIpLimiter.consume(`ip:${clientIp(req)}`);
  if (!decision.allowed) {
    next(
      tooMany(
        "Too many accounts have been created from this network recently. Please try again later.",
        decision.retryAfterSeconds,
      ),
    );
    return;
  }
  next();
};
