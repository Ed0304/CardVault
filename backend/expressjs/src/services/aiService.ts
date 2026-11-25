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
    const kind = err instanceof Error && err.name === "TimeoutError" ? "timeout" : "unreachable";
    console.warn(`[ai] catalog request ${kind} after ${Date.now() - started} ms`);
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) {
    console.warn(`[ai] catalog service answered ${response.status} after ${Date.now() - started} ms`);
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
