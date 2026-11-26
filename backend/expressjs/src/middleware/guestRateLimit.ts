import type { RequestHandler } from "express";
import { config } from "../lib/config.js";
import { AppError } from "../lib/errors.js";
import { createRateLimiter } from "../lib/rateLimit.js";

/**
 * Limits guest reads of the Community Catalog per client IP (TASK-DISC-022).
 *
 * Runs after `optionalAuthenticate`. A request with a valid session (`req.user` set) passes
 * without being counted, so signed-in browsing is never limited here. Every other request, with
 * no cookie or with an invalid or expired one, counts against its client IP.
 *
 * The client IP is `req.ip`, which Express works out from the connecting address and, only when
 * TRUST_PROXY_HOPS > 0, from X-Forwarded-For. With the default of 0 a client cannot choose its
 * own IP by sending forwarded headers.
 *
 * Counts are held in memory (see lib/rateLimit.ts): they reset on restart and are per instance.
 */
export const guestCommunityRateLimiter = createRateLimiter({
  windowMs: config.guestRateLimit.windowSeconds * 1000,
  limit: () => config.guestRateLimit.limit,
});

export const guestRateLimit: RequestHandler = (req, res, next) => {
  if (req.user) {
    next();
    return;
  }

  const decision = guestCommunityRateLimiter.consume(`ip:${req.ip ?? "unknown"}`);
  // IETF draft "RateLimit header fields" (draft-6 style, as used by common Express limiters).
  res.setHeader("RateLimit-Policy", `${decision.limit};w=${config.guestRateLimit.windowSeconds}`);
  res.setHeader("RateLimit-Limit", String(decision.limit));
  res.setHeader("RateLimit-Remaining", String(decision.remaining));
  res.setHeader("RateLimit-Reset", String(decision.retryAfterSeconds));

  if (!decision.allowed) {
    const error = new AppError(
      429,
      "GUEST_RATE_LIMITED",
      "You're browsing the Community Catalog very quickly. Please wait a moment and try again, or log in to keep browsing.",
    );
    error.retryAfterSeconds = decision.retryAfterSeconds;
    next(error);
    return;
  }
  next();
};
