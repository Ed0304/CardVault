import type { Request, Response } from "express";
import { config } from "../lib/config.js";
import {
  clearAuthCookie,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  setAuthCookie,
  setRefreshCookie,
} from "../lib/cookies.js";
import { AppError } from "../lib/errors.js";
import { signAccessToken } from "../lib/jwt.js";
import { success } from "../lib/response.js";
import type { LoginInput, RegisterInput } from "../schemas/auth.schemas.js";
import * as authService from "../services/authService.js";
import * as refreshTokenService from "../services/refreshTokenService.js";

// req.body has already been parsed and normalized by validateBody.

/** Sets the access cookie (15 minutes) and a new refresh cookie for a fresh login. */
async function startSession(res: Response, userId: string, accessToken: string): Promise<void> {
  const refresh = await refreshTokenService.issueRefreshToken(userId);
  setAuthCookie(res, accessToken);
  setRefreshCookie(res, refresh.token, refresh.expiresAt);
}

function refreshTokenOf(req: Request): string | null {
  const value: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function register(req: Request, res: Response): Promise<void> {
  const { user, accessToken } = await authService.registerUser(
    req.body as RegisterInput,
  );
  await startSession(res, user.id, accessToken);
  res
    .status(201)
    .json(
      success(
        { user, expiresIn: config.jwt.expiresInSeconds },
        "Registration successful",
      ),
    );
}

export async function login(req: Request, res: Response): Promise<void> {
  const { user, accessToken } = await authService.loginUser(
    req.body as LoginInput,
  );
  await startSession(res, user.id, accessToken);
  res
    .status(200)
    .json(
      success(
        { user, expiresIn: config.jwt.expiresInSeconds },
        "Login successful",
      ),
    );
}

/**
 * Exchanges the refresh cookie for a new access cookie and a new refresh cookie.
 * Any failure clears both cookies and answers 401, so the browser stops retrying.
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const token = refreshTokenOf(req);
  try {
    if (!token) throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    const rotated = await refreshTokenService.rotateRefreshToken(token);
    const user = await authService.getCurrentUser(rotated.userId);
    setAuthCookie(res, signAccessToken(rotated.userId));
    setRefreshCookie(res, rotated.token, rotated.expiresAt);
    res
      .status(200)
      .json(success({ user, expiresIn: config.jwt.expiresInSeconds }, "Session refreshed"));
  } catch (err) {
    // A race with another refresh must not clear the cookies that request just set.
    if (
      err instanceof AppError &&
      err.status === 401 &&
      err.code !== refreshTokenService.REFRESH_SUPERSEDED
    ) {
      clearAuthCookie(res);
      clearRefreshCookie(res);
    }
    throw err;
  }
}

/**
 * Ends the session on the server (revokes its refresh tokens) and clears both cookies.
 * An access token copied before logout still works until it expires (at most 15 minutes).
 */
export async function logout(req: Request, res: Response): Promise<void> {
  const token = refreshTokenOf(req);
  if (token) await refreshTokenService.revokeRefreshTokenFamily(token);
  clearAuthCookie(res);
  clearRefreshCookie(res);
  res.status(200).json(success(null, "Logged out"));
}

export async function me(req: Request, res: Response): Promise<void> {
  // `authenticate` guarantees req.user; the id comes from the verified token only.
  const user = await authService.getCurrentUser(req.user!.id);
  res.status(200).json(success({ user }));
}
