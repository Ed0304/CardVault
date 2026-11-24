import type { CookieOptions, Response } from "express";
import { config } from "./config.js";

export const AUTH_COOKIE_NAME = "cv_token";
export const REFRESH_COOKIE_NAME = "cv_refresh";

// HttpOnly keeps tokens out of reach of page scripts (XSS). SameSite=Lax stops browsers
// sending them on cross-site POSTs (CSRF). Secure is enabled in production so the cookies
// only travel over HTTPS.
//
// Both cookies use Path=/ on purpose: the frontend restores the session while rendering a page
// on the server, and the browser only sends a cookie with a page request when its path matches.
const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: "lax",
  path: "/",
};

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...baseOptions,
    maxAge: config.jwt.expiresInSeconds * 1000,
  });
}

export function clearAuthCookie(res: Response): void {
  // Attributes must match those used when setting the cookie.
  res.clearCookie(AUTH_COOKIE_NAME, baseOptions);
}

/** The refresh cookie lives exactly as long as the refresh token it carries. */
export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseOptions,
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions);
}
