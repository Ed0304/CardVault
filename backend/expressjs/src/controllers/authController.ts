import type { Request, Response } from "express";
import { config } from "../lib/config.js";
import { clearAuthCookie, setAuthCookie } from "../lib/cookies.js";
import { success } from "../lib/response.js";
import type { LoginInput, RegisterInput } from "../schemas/auth.schemas.js";
import * as authService from "../services/authService.js";

// req.body has already been parsed and normalized by validateBody.

export async function register(req: Request, res: Response): Promise<void> {
  const { user, accessToken } = await authService.registerUser(
    req.body as RegisterInput,
  );
  setAuthCookie(res, accessToken);
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
  setAuthCookie(res, accessToken);
  res
    .status(200)
    .json(
      success(
        { user, expiresIn: config.jwt.expiresInSeconds },
        "Login successful",
      ),
    );
}

export function logout(_req: Request, res: Response): void {
  clearAuthCookie(res);
  res.status(200).json(success(null, "Logged out"));
}

export async function me(req: Request, res: Response): Promise<void> {
  // `authenticate` guarantees req.user; the id comes from the verified token only.
  const user = await authService.getCurrentUser(req.user!.id);
  res.status(200).json(success({ user }));
}
