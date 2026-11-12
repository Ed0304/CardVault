import type { Request, RequestHandler } from "express";
import { AUTH_COOKIE_NAME } from "../lib/cookies.js";
import { AppError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/jwt.js";

const unauthorized = () =>
  new AppError(401, "UNAUTHORIZED", "Authentication required");

/** Reads the JWT from `Authorization: Bearer <token>`, else from the auth cookie. */
function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header) {
    const [scheme, token, ...rest] = header.split(" ");
    return scheme?.toLowerCase() === "bearer" && token && rest.length === 0
      ? token
      : null;
  }
  const cookieToken: unknown = req.cookies?.[AUTH_COOKIE_NAME];
  return typeof cookieToken === "string" && cookieToken ? cookieToken : null;
}

/**
 * Accepts a Bearer header (API clients) or the HttpOnly cookie (browser). On
 * success sets `req.user.id` to the verified token subject. Valid authentication
 * does not imply access to any particular record: handlers must still scope
 * every query by `req.user.id`.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = extractToken(req);

  if (!token) {
    next(unauthorized());
    return;
  }

  try {
    const { userId } = verifyAccessToken(token);
    req.user = { id: userId };
    next();
  } catch {
    // Same response for bad signature, expiry, wrong issuer/audience/algorithm.
    next(unauthorized());
  }
};
