import jwt from "jsonwebtoken";
import { config } from "./config.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Signs a short-lived HS256 access token. The payload carries only the `sub` claim. */
export function signAccessToken(userId: string): string {
  return jwt.sign({}, config.jwt.secret, {
    algorithm: config.jwt.algorithm,
    subject: userId,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    expiresIn: config.jwt.expiresInSeconds,
  });
}

/**
 * Verifies signature, expiry, issuer, audience and algorithm (HS256 only).
 * Returns the user UUID from `sub`. Throws on any failure.
 */
export function verifyAccessToken(token: string): { userId: string } {
  const payload = jwt.verify(token, config.jwt.secret, {
    algorithms: [config.jwt.algorithm],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });

  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    !UUID_PATTERN.test(payload.sub)
  ) {
    throw new Error("Invalid token subject");
  }

  return { userId: payload.sub };
}
