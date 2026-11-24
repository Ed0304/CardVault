import { createHash, randomBytes } from "node:crypto";
import { config } from "../lib/config.js";
import { pool } from "../lib/db.js";
import { AppError } from "../lib/errors.js";

/**
 * Rotating refresh tokens (TASK-AUTH-025).
 *
 * - A refresh token is 32 random bytes, sent to the browser only in the HttpOnly cv_refresh cookie.
 *   The database stores its SHA-256 hash. The token is high-entropy, so a fast hash is enough:
 *   it cannot be guessed, and a leaked hash cannot be turned back into a token.
 * - Every refresh revokes the presented token and issues a new one in the same family (one login).
 * - Presenting a token that was already rotated means it was copied: the whole family is revoked,
 *   which signs out both the thief and the user. A reuse within a few seconds of rotation is
 *   treated as two tabs refreshing at once, and only that request is refused.
 * - A family ends after `idleSeconds` without use, and `absoluteSeconds` after login at most.
 */

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export interface RotatedSession extends IssuedRefreshToken {
  userId: string;
}

interface TokenRow {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: Date;
  family_expires_at: Date;
  revoked_at: Date | null;
}

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

const newToken = (): string => randomBytes(32).toString("base64url");

const secondsFromNow = (seconds: number): Date => new Date(Date.now() + seconds * 1000);

/** Error code for a harmless refresh race; the session is still valid. */
export const REFRESH_SUPERSEDED = "REFRESH_SUPERSEDED";

/** Same response for every real refresh failure, so callers learn nothing about why it failed. */
const invalidRefresh = (): AppError =>
  new AppError(401, "UNAUTHORIZED", "Authentication required");

/** Starts a new session family after a successful login or registration. */
export async function issueRefreshToken(userId: string): Promise<IssuedRefreshToken> {
  const token = newToken();
  const familyExpiresAt = secondsFromNow(config.refresh.absoluteSeconds);
  const expiresAt = secondsFromNow(config.refresh.idleSeconds);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, family_expires_at)
     VALUES ($1, gen_random_uuid(), $2, $3, $4)`,
    [userId, hashToken(token), expiresAt, familyExpiresAt],
  );
  return { token, expiresAt };
}

/**
 * Exchanges a valid refresh token for a new one. Throws 401 for anything else. Runs in one
 * transaction with the row locked, so two refreshes of the same token cannot both succeed.
 */
export async function rotateRefreshToken(token: string): Promise<RotatedSession> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query<TokenRow>(
      `SELECT id, user_id, family_id, expires_at, family_expires_at, revoked_at
         FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [hashToken(token)],
    );
    const row = found.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      throw invalidRefresh();
    }

    if (row.revoked_at) {
      const secondsSinceRevoked = (Date.now() - row.revoked_at.getTime()) / 1000;
      if (secondsSinceRevoked > config.refresh.reuseGraceSeconds) {
        // A rotated token came back long after rotation: treat it as stolen.
        await client.query(
          "UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL",
          [row.family_id],
        );
        await client.query("COMMIT");
        throw invalidRefresh();
      }
      // Within the grace window this is a race only if the session is still alive (it may
      // have been ended by logout or theft detection since).
      const live = await client.query(
        "SELECT 1 FROM refresh_tokens WHERE family_id = $1 AND revoked_at IS NULL LIMIT 1",
        [row.family_id],
      );
      await client.query("ROLLBACK");
      if (live.rowCount === 0) throw invalidRefresh();
      // Two refreshes raced; the other one already set the new cookies. Answer with a
      // distinct code so the caller does not clear them, and simply retries its request.
      throw new AppError(401, REFRESH_SUPERSEDED, "Session was refreshed by another request");
    }

    const now = Date.now();
    if (row.expires_at.getTime() <= now || row.family_expires_at.getTime() <= now) {
      await client.query("UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1", [row.id]);
      await client.query("COMMIT");
      throw invalidRefresh();
    }

    const next = newToken();
    // The new token never outlives the family.
    const idleLimit = secondsFromNow(config.refresh.idleSeconds);
    const expiresAt = idleLimit < row.family_expires_at ? idleLimit : row.family_expires_at;
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, family_expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [row.user_id, row.family_id, hashToken(next), expiresAt, row.family_expires_at],
    );
    await client.query(
      "UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1",
      [row.id, inserted.rows[0]!.id],
    );
    await client.query("COMMIT");
    return { userId: row.user_id, token: next, expiresAt };
  } catch (err) {
    if (!(err instanceof AppError)) await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Ends the session the token belongs to (logout). Unknown tokens are ignored. */
export async function revokeRefreshTokenFamily(token: string): Promise<void> {
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = now()
      WHERE revoked_at IS NULL
        AND family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)`,
    [hashToken(token)],
  );
}
