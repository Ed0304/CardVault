import { config } from "../lib/config.js";
import { pool } from "../lib/db.js";
import { AppError } from "../lib/errors.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import * as aiService from "./aiService.js";
import { assertCardId, cardNotFound, getCard, type CardDetail, type CatalogDraft } from "./cardService.js";

/**
 * AI-assisted cataloging, requested by the card's owner (REQ-AI-001, REQ-AI-005 to REQ-AI-007).
 *
 * The owner asks Muse to catalog a card. The result is stored as a private draft and changes
 * nothing else: the owner then saves it (with edits) through the AI-metadata update, or discards
 * it. ai_catalog_status records the latest request: PENDING while it runs, COMPLETE when a draft
 * was stored, FAILED when none was. Failures never touch the card's content or metadata.
 *
 * What leaves CardVault: the card's title and source text (cut to a limit by the AI service), and
 * the owner's existing subject headings, so new headings reuse the library's terms. Personal
 * notes, collections, tags and account details are never sent.
 */

const HOUR_MS = 60 * 60 * 1000;
/** How many of the owner's existing subject headings are offered for reuse. */
const MAX_EXISTING_SUBJECTS = 50;

export const catalogRateLimiter = createRateLimiter({
  windowMs: HOUR_MS,
  limit: () => config.ai.catalogHourlyLimit,
});

/** A PENDING request older than this is treated as abandoned (for example after a crash). */
function staleAfterSeconds(): number {
  return Math.ceil(config.ai.timeoutMs / 1000) + 30;
}

export function isCatalogAvailable(): boolean {
  return aiService.isCatalogEnabled();
}

interface ClaimRow {
  source_title: string | null;
  source_text: string;
  requested_at: string;
}

export async function requestCatalog(userId: string, cardId: string): Promise<CardDetail> {
  if (!isCatalogAvailable()) {
    throw new AppError(503, "AI_NOT_AVAILABLE", "AI cataloging isn't set up on this server");
  }
  assertCardId(cardId);

  const decision = catalogRateLimiter.consume(userId);
  if (!decision.allowed) {
    const error = new AppError(
      429,
      "AI_RATE_LIMITED",
      "You've reached the hourly limit for AI cataloging. Please try again later.",
    );
    error.retryAfterSeconds = decision.retryAfterSeconds;
    throw error;
  }

  // Claim the card in one statement: it must be the user's, have text to catalog, and not be in
  // the middle of another request. requested_at is returned as text to keep its full precision.
  const claim = await pool.query<ClaimRow>(
    `UPDATE knowledge_cards
        SET ai_catalog_status = 'PENDING', ai_catalog_requested_at = now()
      WHERE id = $1 AND user_id = $2 AND btrim(source_text) <> ''
        AND NOT (ai_catalog_status = 'PENDING'
                 AND ai_catalog_requested_at IS NOT NULL
                 AND ai_catalog_requested_at > now() - make_interval(secs => $3))
      RETURNING source_title, source_text, ai_catalog_requested_at::text AS requested_at`,
    [cardId, userId, staleAfterSeconds()],
  );
  const claimed = claim.rows[0];
  if (!claimed) throw await explainRefusedClaim(userId, cardId);

  const existing = await pool.query<{ subject: string }>(
    `SELECT s AS subject
       FROM knowledge_cards k, unnest(k.ai_subjects) AS s
      WHERE k.user_id = $1 AND k.id <> $2
      GROUP BY s
      ORDER BY count(*) DESC, s
      LIMIT $3`,
    [userId, cardId, MAX_EXISTING_SUBJECTS],
  );

  const outcome = await aiService.catalogCard({
    title: claimed.source_title,
    text: claimed.source_text,
    existingSubjects: existing.rows.map((row) => row.subject),
  });

  if (outcome.ok) {
    const { title, summary, facts, subjects, keywords, related, model, truncated } = outcome.result;
    const draft: CatalogDraft = {
      catalogTitle: title,
      summary,
      facts,
      subjects,
      keywords,
      related,
      model,
      truncated,
      generatedAt: new Date().toISOString(),
    };
    // Written only if this request still owns the claim; the card's metadata is not touched.
    await pool.query(
      `UPDATE knowledge_cards
          SET ai_catalog_draft = $1::jsonb, ai_catalog_status = 'COMPLETE'
        WHERE id = $2 AND user_id = $3 AND ai_catalog_requested_at = $4::timestamptz`,
      [JSON.stringify(draft), cardId, userId, claimed.requested_at],
    );
    return getCard(userId, cardId);
  }

  await pool.query(
    `UPDATE knowledge_cards SET ai_catalog_status = 'FAILED'
      WHERE id = $1 AND user_id = $2 AND ai_catalog_requested_at = $3::timestamptz`,
    [cardId, userId, claimed.requested_at],
  );
  if (outcome.reason === "unavailable") {
    const error = new AppError(
      503,
      "AI_UNAVAILABLE",
      "Muse is busy or couldn't be reached. Your card is unchanged; please try again in a moment.",
    );
    error.retryAfterSeconds = 30;
    throw error;
  }
  throw new AppError(502, "AI_CATALOG_FAILED", "Muse couldn't catalog this card. Your card is unchanged.");
}

async function explainRefusedClaim(userId: string, cardId: string): Promise<AppError> {
  const result = await pool.query<{ has_text: boolean }>(
    `SELECT btrim(source_text) <> '' AS has_text FROM knowledge_cards WHERE id = $1 AND user_id = $2`,
    [cardId, userId],
  );
  const row = result.rows[0];
  if (!row) return cardNotFound();
  if (!row.has_text) {
    return new AppError(422, "NOTHING_TO_CATALOG", "This card has no source text to catalog");
  }
  return new AppError(409, "CATALOG_IN_PROGRESS", "This card is already being cataloged");
}

/** Throws away the pending suggestion. The card's catalog details are unchanged. */
export async function discardDraft(userId: string, cardId: string): Promise<CardDetail> {
  assertCardId(cardId);
  const result = await pool.query(
    `UPDATE knowledge_cards SET ai_catalog_draft = NULL WHERE id = $1 AND user_id = $2`,
    [cardId, userId],
  );
  if (result.rowCount === 0) throw cardNotFound();
  return getCard(userId, cardId);
}
