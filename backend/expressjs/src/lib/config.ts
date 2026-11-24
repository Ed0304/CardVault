import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: z.string().min(1, "is required"),
  JWT_SECRET: z.string().min(32, "must be at least 32 characters"),
  JWT_ISSUER: z.string().min(1).default("cardvault-api"),
  JWT_AUDIENCE: z.string().min(1).default("cardvault-web"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Report variable names and reasons only, never their values.
  const problems = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration. ${problems}`);
}

export const config = {
  isProduction: process.env.NODE_ENV === "production",
  port: parsed.data.PORT,
  databaseUrl: parsed.data.DATABASE_URL,
  jwt: {
    secret: parsed.data.JWT_SECRET,
    issuer: parsed.data.JWT_ISSUER,
    audience: parsed.data.JWT_AUDIENCE,
    algorithm: "HS256",
    expiresInSeconds: 15 * 60,
  },
  refresh: {
    /** A session ends after this long without a refresh (idle limit). */
    idleSeconds: 7 * 24 * 60 * 60,
    /** A session ends this long after login, however active it is (absolute limit). */
    absoluteSeconds: 30 * 24 * 60 * 60,
    /**
     * A token used again within this many seconds of being rotated is treated as a harmless
     * race (two tabs refreshing at once), not as theft.
     */
    reuseGraceSeconds: 30,
  },
} as const;
