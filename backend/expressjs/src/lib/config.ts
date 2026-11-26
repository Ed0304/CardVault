import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: z.string().min(1, "is required"),
  JWT_SECRET: z.string().min(32, "must be at least 32 characters"),
  JWT_ISSUER: z.string().min(1).default("cardvault-api"),
  JWT_AUDIENCE: z.string().min(1).default("cardvault-web"),
  // Internal AI service (FastAPI). AI cataloging is enabled only when both are set (D-9).
  AI_SERVICE_URL: z
    .string()
    .url("must be a URL such as http://localhost:8000")
    .refine((value) => /^https?:\/\//.test(value), "must be an http or https URL")
    .optional(),
  AI_SERVICE_TOKEN: z.string().min(32, "must be at least 32 characters").optional(),
  // Covers the provider call and its retry inside FastAPI.
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(90_000),
  // Catalog requests per user per hour (abuse and cost protection).
  AI_CATALOG_HOURLY_LIMIT: z.coerce.number().int().min(1).max(1_000).default(20),
  // URL ingestion (REQ-URL-005). One deadline covers every redirect and the whole body.
  URL_FETCH_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  URL_FETCH_MAX_BYTES: z.coerce.number().int().min(10_000).max(20 * 1024 * 1024).default(5 * 1024 * 1024),
  // Pages fetched per user per hour; each one is an outbound request made by CardVault.
  URL_INGEST_HOURLY_LIMIT: z.coerce.number().int().min(1).max(1_000).default(30),
  // Guest reads of the Community Catalog per client IP per window (TASK-DISC-022). Signed-in
  // users are not counted.
  GUEST_COMMUNITY_RATE_LIMIT: z.coerce.number().int().min(1).max(10_000).default(120),
  GUEST_COMMUNITY_RATE_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3_600).default(60),
  // How many reverse proxies in front of Express to trust for the client IP (X-Forwarded-For).
  // 0 (default) uses the connecting address and ignores forwarded headers, so a client cannot
  // choose its own IP. On Railway, set 1: see .env.example.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  // Login and registration limits per client IP (TASK-AUTH-025). Failed logins count; a
  // successful login gives its attempt back. Every registration attempt counts.
  AUTH_LOGIN_IP_LIMIT: z.coerce.number().int().min(1).max(10_000).default(30),
  AUTH_LOGIN_ACCOUNT_LIMIT: z.coerce.number().int().min(1).max(1_000).default(10),
  AUTH_LOGIN_WINDOW_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  AUTH_REGISTER_IP_LIMIT: z.coerce.number().int().min(1).max(10_000).default(10),
  AUTH_REGISTER_WINDOW_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3_600),
}).refine(
  (env) => Boolean(env.AI_SERVICE_URL) === Boolean(env.AI_SERVICE_TOKEN),
  { message: "set both or neither", path: ["AI_SERVICE_URL"] },
);

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
  ai: {
    /** Base URL of the internal AI service, or null when AI cataloging is not enabled. */
    serviceUrl: parsed.data.AI_SERVICE_URL?.replace(/\/+$/, "") ?? null,
    serviceToken: parsed.data.AI_SERVICE_TOKEN ?? null,
    timeoutMs: parsed.data.AI_SERVICE_TIMEOUT_MS,
    catalogHourlyLimit: parsed.data.AI_CATALOG_HOURLY_LIMIT,
  },
  urlIngestion: {
    timeoutMs: parsed.data.URL_FETCH_TIMEOUT_MS,
    maxBytes: parsed.data.URL_FETCH_MAX_BYTES,
    hourlyLimit: parsed.data.URL_INGEST_HOURLY_LIMIT,
    maxRedirects: 3,
  },
  guestRateLimit: {
    /** Guest Community Catalog reads allowed per client IP in each window. */
    limit: parsed.data.GUEST_COMMUNITY_RATE_LIMIT,
    windowSeconds: parsed.data.GUEST_COMMUNITY_RATE_WINDOW_SECONDS,
  },
  authRateLimit: {
    /** Failed logins per client IP per window, across all accounts. */
    loginIpLimit: parsed.data.AUTH_LOGIN_IP_LIMIT,
    /** Failed logins per client IP for one email address per window. */
    loginAccountLimit: parsed.data.AUTH_LOGIN_ACCOUNT_LIMIT,
    loginWindowSeconds: parsed.data.AUTH_LOGIN_WINDOW_SECONDS,
    /** Registration attempts per client IP per window. */
    registerIpLimit: parsed.data.AUTH_REGISTER_IP_LIMIT,
    registerWindowSeconds: parsed.data.AUTH_REGISTER_WINDOW_SECONDS,
  },
  /** Express "trust proxy" hop count; decides how req.ip is worked out. */
  trustProxyHops: parsed.data.TRUST_PROXY_HOPS,
} as const;
