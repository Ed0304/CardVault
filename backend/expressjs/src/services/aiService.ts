import { config } from "../lib/config.js";
import { catalogServiceResponseSchema, type CatalogServiceResponse } from "../schemas/ai.schemas.js";

/**
 * HTTP client for the internal AI service (FastAPI). Express never calls the AI provider and
 * never holds its credentials; it sends card text to FastAPI with a shared bearer token.
 *
 * Every outcome is returned as a value, never thrown, so callers always record a status.
 * Logs carry the outcome and timing only, never card text or tokens.
 */

export interface CatalogInput {
  title: string | null;
  text: string;
  existingSubjects: string[];
}

export type CatalogOutcome =
  | { ok: true; result: CatalogServiceResponse }
  /** Temporary: timeout, unreachable, or the provider is busy. Worth retrying later. */
  | { ok: false; reason: "unavailable" }
  /** The service or provider refused, or the answer was unusable. */
  | { ok: false; reason: "failed" };

/** The AI service's origin for logs, e.g. "http://fastapi.railway.internal:8000" (never the token). */
function describeTarget(serviceUrl: string): string {
  try {
    const url = new URL(serviceUrl);
    return `${url.protocol}//${url.hostname}:${url.port || (url.protocol === "https:" ? "443" : "80")}`;
  } catch {
    return "an invalid AI_SERVICE_URL";
  }
}

/** The innermost network error code, e.g. ECONNREFUSED, ENOTFOUND, UND_ERR_CONNECT_TIMEOUT. */
function describeCause(err: unknown): string {
  const codes: string[] = [];
  let current: unknown = err;
  for (let depth = 0; current && depth < 6; depth++) {
    const e = current as { code?: unknown; cause?: unknown; errors?: unknown[] };
    if (typeof e.code === "string") codes.push(e.code);
    // Connection attempts to several addresses fail together as an AggregateError.
    if (Array.isArray(e.errors)) {
      for (const inner of e.errors) {
        const code = (inner as { code?: unknown } | null)?.code;
        if (typeof code === "string") codes.push(code);
      }
    }
    current = e.cause;
  }
  return codes.length ? [...new Set(codes)].join(", ") : err instanceof Error ? err.name : "unknown error";
}

export function isCatalogEnabled(): boolean {
  return Boolean(config.ai.serviceUrl && config.ai.serviceToken);
}

export async function catalogCard(input: CatalogInput): Promise<CatalogOutcome> {
  const { serviceUrl, serviceToken, timeoutMs } = config.ai;
  if (!serviceUrl || !serviceToken) return { ok: false, reason: "failed" };

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(`${serviceUrl}/catalog`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${serviceToken}` },
      body: JSON.stringify({ title: input.title, text: input.text, existing_subjects: input.existingSubjects }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const target = describeTarget(serviceUrl);
    if (err instanceof Error && err.name === "TimeoutError") {
      console.warn(`[ai] catalog request to ${target} timed out after ${Date.now() - started} ms`);
    } else {
      console.warn(
        `[ai] catalog request to ${target} could not connect (${describeCause(err)}) after ${Date.now() - started} ms`,
      );
    }
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) {
    // FastAPI's error code (e.g. PROVIDER_UNAVAILABLE) says whether the provider or the service failed.
    const code = await response
      .json()
      .then((b: { error?: { code?: unknown }; detail?: { code?: unknown } }) => b?.error?.code ?? b?.detail?.code)
      .catch(() => undefined);
    console.warn(
      `[ai] catalog service answered ${response.status}${typeof code === "string" ? ` ${code}` : ""} after ${Date.now() - started} ms`,
    );
    return { ok: false, reason: response.status === 503 ? "unavailable" : "failed" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    // The timeout also covers reading the body.
    if (err instanceof Error && err.name === "TimeoutError") {
      console.warn(`[ai] catalog response timed out after ${Date.now() - started} ms`);
      return { ok: false, reason: "unavailable" };
    }
    console.warn("[ai] catalog service returned a body that is not JSON");
    return { ok: false, reason: "failed" };
  }
  const parsed = catalogServiceResponseSchema.safeParse(body);
  if (!parsed.success) {
    console.warn("[ai] catalog service returned a response that failed validation");
    return { ok: false, reason: "failed" };
  }
  return { ok: true, result: parsed.data };
}
