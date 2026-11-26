import { AppError } from "../lib/errors.js";
import { signAccessToken } from "../lib/jwt.js";
import { getDummyHash, hashPassword, isUsablePasswordHash, verifyPassword } from "../lib/password.js";
import type { LoginInput, RegisterInput } from "../schemas/auth.schemas.js";
import * as userService from "./userService.js";
import type { UserRecord } from "./userService.js";

const PG_UNIQUE_VIOLATION = "23505";

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  /** False until the user saves recommendation preferences; the app then shows onboarding. */
  onboardingCompleted: boolean;
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

const stringField = (err: unknown, name: "constraint" | "detail"): string =>
  typeof err === "object" && err !== null && name in err && typeof (err as Record<string, unknown>)[name] === "string"
    ? ((err as Record<string, unknown>)[name] as string)
    : "";

/**
 * Which column a unique violation on `users` was about. PostgreSQL names the violated constraint
 * or index ("users_email_key", "users_username_lower_key") and the key in the detail, e.g.
 * "Key (lower(username::text))=(alice) already exists." Both are checked, so a username rule
 * added under another name is still recognised, and anything else is not mistaken for email.
 */
function conflictingField(err: unknown): "email" | "username" | null {
  const text = `${stringField(err, "constraint")} ${stringField(err, "detail")}`.toLowerCase();
  if (text.includes("username")) return "username";
  if (text.includes("email")) return "email";
  return null;
}

// Explicit allow-list so the password hash can never leak into a response.
function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    onboardingCompleted: user.onboardingCompleted,
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
    // The UNIQUE constraints are the source of truth, so concurrent
    // registrations with the same email or username cannot both succeed.
    if (isUniqueViolation(err)) {
      const field = conflictingField(err);
      if (field === "username") {
        // Usernames are public (shown as card authors), so saying one is taken reveals nothing new.
        throw new AppError(409, "USERNAME_TAKEN", "That username is already taken. Please choose another.", [
          { field: "username", message: "is already taken" },
        ]);
      }
      if (field === "email") {
        throw new AppError(
          409,
          "EMAIL_ALREADY_REGISTERED",
          "An account with this email already exists",
        );
      }
      // An unknown unique rule: don't guess which field it was.
      throw new AppError(409, "ACCOUNT_CONFLICT", "An account with these details already exists. Please change your username or email.");
    }
    throw err;
  }

  return buildAuthResult(user);
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await userService.findUserByEmail(input.email);

  // Always run one Argon2 verification, even for unknown emails and for accounts that cannot
  // log in (no usable hash, e.g. seed catalog authors), so all three answer alike.
  const canLogIn = user !== null && isUsablePasswordHash(user.passwordHash);
  const hash = canLogIn ? user.passwordHash : await getDummyHash();
  const passwordMatches = await verifyPassword(hash, input.password);

  if (!user || !canLogIn || !passwordMatches) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password",
    );
  }

  return buildAuthResult(user);
}
