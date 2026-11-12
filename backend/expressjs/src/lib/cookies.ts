import type { CookieOptions, Response } from "express";
import { config } from "./config.js";

export const AUTH_COOKIE_NAME = "cv_token";

// HttpOnly keeps the JWT out of reach of page scripts (XSS). SameSite=Lax stops
// browsers sending it on cross-site POSTs (CSRF). Secure is enabled in production
// so the cookie only travels over HTTPS.
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
