import { AppError } from "../lib/errors.js";
import { signAccessToken } from "../lib/jwt.js";
import { getDummyHash, hashPassword, verifyPassword } from "../lib/password.js";
import type { LoginInput, RegisterInput } from "../schemas/auth.schemas.js";
import * as userService from "./userService.js";
import type { UserRecord } from "./userService.js";

const PG_UNIQUE_VIOLATION = "23505";

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface AuthResult {
  user: PublicUser;
  /** Delivered to the browser as an HttpOnly cookie, never in the JSON body. */
  accessToken: string;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === PG_UNIQUE_VIOLATION
  );
}

// Explicit allow-list so the password hash can never leak into a response.
function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

function buildAuthResult(user: UserRecord): AuthResult {
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user.id),
  };
}

/** Loads the public profile for an already-authenticated user id. */
export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await userService.findUserById(userId);
  if (!user) {
    // Valid token but the account no longer exists.
    throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  }
  return toPublicUser(user);
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);

  let user: UserRecord;
  try {
    user = await userService.createUser({
      username: input.username,
      email: input.email,
      passwordHash,
    });
  } catch (err) {
    // The UNIQUE constraint is the source of truth, so concurrent
    // registrations with the same email cannot both succeed.
    if (isUniqueViolation(err)) {
      throw new AppError(
        409,
        "EMAIL_ALREADY_REGISTERED",
        "An account with this email already exists",
      );
    }
    throw err;
  }

  return buildAuthResult(user);
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await userService.findUserByEmail(input.email);

  // Always run one Argon2 verification, even for unknown emails.
  const hash = user ? user.passwordHash : await getDummyHash();
  const passwordMatches = await verifyPassword(hash, input.password);

  if (!user || !passwordMatches) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password",
    );
  }

  return buildAuthResult(user);
}
