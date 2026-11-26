import argon2 from "argon2";

// OWASP-recommended Argon2id parameters: 19 MiB memory, 2 iterations, 1 lane.
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Stored in password_hash for accounts that must never log in, such as seed catalog authors.
 * It is not an Argon2 hash, so no password can match it.
 */
export const NO_LOGIN_PASSWORD_HASH = "!no-login";

/** True when the stored value is an Argon2 hash a password could match. */
export function isUsablePasswordHash(hash: string): boolean {
  return hash.startsWith("$argon2");
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

// Verified against when a login email is unknown, so unknown-email and
// wrong-password requests cost about the same time.
let dummyHash: Promise<string> | undefined;

export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("cardvault-dummy-password");
  return dummyHash;
}
