import { pool } from "../lib/db.js";
import { isUniqueViolation } from "../lib/dbErrors.js";
import { AppError } from "../lib/errors.js";
import type { ListPublicCardsQuery } from "../schemas/cards.schemas.js";
import {
  assertCardId,
  cardNotFound,
  getCard,
  catalogJsonMatches,
  initialAiStatuses,
  likePattern,
  linkRelated,
  type CardDetail,
  type RelatedConceptLink,
} from "./cardService.js";
import type { Fact, RelatedConcept } from "../schemas/ai.schemas.js";

/**
 * Community Catalog: published cards as other users see them (REQ-CAT-012 to REQ-CAT-014).
 *
 * Privacy rule: every query here selects an explicit list of public columns. Notes, collections,
 * tags, AI statuses, source metadata, owner ids and email addresses are never selected, and the
 * source text is selected only when its owner chose to share it. Only PUBLIC cards are visible;
 * a private, deleted or malformed id gets the same 404, so private cards are not revealed.
 */

export interface PublicAuthor {
  username: string;
}

export interface PublicCardSummary {
  id: string;
  catalogTitle: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  aiSummary: string | null;
  aiSubjects: string[];
  aiKeywords: string[];
  /** True when the author shared the original text with the public card. */
  hasSourceText: boolean;
  author: PublicAuthor;
  publishedAt: string;
}

export interface PublicCardDetail extends PublicCardSummary {
  aiFacts: Fact[];
  /** Linked only to other published cards. */
  aiRelated: RelatedConceptLink[];
  /** The original text, or null when the author did not share it. */
  sourceText: string | null;
  /** Facts about the signed-in viewer, so the UI can offer the right action; null for a guest. */
  viewer: {
    isOwner: boolean;
    /** The viewer's saved copy of this card, if they have one. */
    savedCardId: string | null;
  } | null;
}

export interface PublicCardPage {
  items: PublicCardSummary[];
  total: number;
  page: number;
  pageSize: number;
}

// The approved public fields. source_text is deliberately absent: it is selected separately and
// only when share_source_text is true.
export const PUBLIC_COLUMNS = `
  c.id, c.catalog_title, c.source_title, c.source_url, c.ai_summary, c.ai_subjects, c.ai_keywords,
  c.published_at,
  (c.share_source_text AND c.source_text <> '') AS has_source_text,
  u.username AS author_username`;

export const FROM_PUBLIC = `
  FROM knowledge_cards c
  JOIN users u ON u.id = c.user_id`;

export interface PublicRow {
  id: string;
  catalog_title: string | null;
  source_title: string | null;
  source_url: string | null;
  ai_summary: string | null;
  ai_subjects: string[];
  ai_keywords: string[];
  published_at: Date;
  has_source_text: boolean;
  author_username: string;
}

interface PublicDetailRow extends PublicRow {
  ai_facts: Fact[];
  ai_related: RelatedConcept[];
  shared_source_text: string | null;
  is_owner: boolean;
  saved_card_id: string | null;
}

export function toPublicSummary(row: PublicRow): PublicCardSummary {
  return {
    id: row.id,
    catalogTitle: row.catalog_title,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    aiSummary: row.ai_summary,
    aiSubjects: row.ai_subjects,
    aiKeywords: row.ai_keywords,
    hasSourceText: row.has_source_text,
    author: { username: row.author_username },
    publishedAt: row.published_at.toISOString(),
  };
}

/**
 * Published cards, newest published first. With `q`, a case-insensitive keyword search over the
 * public fields only: title, summary, subjects and keywords, and the source text only where the
 * author shared it (otherwise a search could reveal words from unshared text).
 */
export async function listPublicCards(query: ListPublicCardsQuery): Promise<PublicCardPage> {
  const conditions = ["c.visibility = 'PUBLIC'"];
  const params: unknown[] = [];

  if (query.q) {
    params.push(likePattern(query.q));
    const p = `$${params.length}`;
    conditions.push(`(
      c.catalog_title ILIKE ${p} ESCAPE '\\'
      OR c.source_title ILIKE ${p} ESCAPE '\\'
      OR c.ai_summary ILIKE ${p} ESCAPE '\\'
      OR ${catalogJsonMatches("c", p)}
      OR array_to_string(c.ai_subjects, ' ') ILIKE ${p} ESCAPE '\\'
      OR array_to_string(c.ai_keywords, ' ') ILIKE ${p} ESCAPE '\\'
      OR (c.share_source_text AND c.source_text ILIKE ${p} ESCAPE '\\')
    )`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;

  const countResult = await pool.query<{ total: string }>(
    `SELECT count(*) AS total FROM knowledge_cards c ${where}`,
    params,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const pageParams = [...params, query.pageSize, (query.page - 1) * query.pageSize];
  const rows = await pool.query<PublicRow>(
    `SELECT ${PUBLIC_COLUMNS} ${FROM_PUBLIC}
     ${where}
     ORDER BY c.published_at DESC, c.id DESC
     LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
    pageParams,
  );

  return { items: rows.rows.map(toPublicSummary), total, page: query.page, pageSize: query.pageSize };
}

/**
 * One published card, with what the viewer can do with it. A guest (`viewerId` null) gets the
 * same public fields and `viewer: null`.
 */
export async function getPublicCard(viewerId: string | null, cardId: string): Promise<PublicCardDetail> {
  assertCardId(cardId);
  const result = await pool.query<PublicDetailRow>(
    `SELECT ${PUBLIC_COLUMNS}, c.ai_facts, c.ai_related,
            CASE WHEN c.share_source_text THEN c.source_text END AS shared_source_text,
            (c.user_id = $2::uuid) AS is_owner,
            (SELECT s.id FROM knowledge_cards s
              WHERE s.user_id = $2::uuid AND s.saved_from_card_id = c.id) AS saved_card_id
     ${FROM_PUBLIC}
     WHERE c.id = $1 AND c.visibility = 'PUBLIC'`,
    [cardId, viewerId],
  );
  const row = result.rows[0];
  if (!row) throw cardNotFound();
  return {
    ...toPublicSummary(row),
    aiFacts: row.ai_facts,
    aiRelated: await linkRelated(row.ai_related, cardId, { publicOnly: true }),
    sourceText: row.has_source_text ? row.shared_source_text : null,
    viewer: viewerId ? { isOwner: row.is_owner, savedCardId: row.saved_card_id } : null,
  };
}

interface OriginalRow {
  user_id: string;
  catalog_title: string | null;
  ai_facts: Fact[];
  ai_related: RelatedConcept[];
  source_title: string | null;
  source_url: string | null;
  ai_summary: string | null;
  ai_subjects: string[];
  ai_keywords: string[];
  shared_source_text: string;
  author_username: string;
}

/**
 * Saves a published card into the user's vault as an independent copy (REQ-CAT-013).
 *
 * The copy belongs to the saver, starts PRIVATE, and takes only public fields: title, source URL,
 * the source text if it was shared, summary, subjects and keywords. Provenance (original id and
 * author's username) is written in the same row. Notes, collection, tags and AI statuses are not
 * copied; the copy gets the initial statuses, since it was not processed by AI itself.
 *
 * The transaction locks the original row (FOR SHARE) from the read until the copy is committed,
 * so a concurrent unpublish or delete cannot leave a copy of a card that was not public at commit
 * time. The partial unique index on (user_id, saved_from_card_id) rejects a second copy, including
 * two simultaneous saves.
 */
export async function saveToVault(userId: string, cardId: string): Promise<CardDetail> {
  assertCardId(cardId);
  const client = await pool.connect();
  let copyId: string;
  try {
    await client.query("BEGIN");
    const original = await client.query<OriginalRow>(
      `SELECT c.user_id, c.catalog_title, c.source_title, c.source_url, c.ai_summary, c.ai_subjects,
              c.ai_keywords, c.ai_facts, c.ai_related,
              CASE WHEN c.share_source_text THEN c.source_text ELSE '' END AS shared_source_text,
              u.username AS author_username
         FROM knowledge_cards c
         JOIN users u ON u.id = c.user_id
        WHERE c.id = $1 AND c.visibility = 'PUBLIC'
          FOR SHARE OF c`,
      [cardId],
    );
    const row = original.rows[0];
    if (!row) throw cardNotFound();
    if (row.user_id === userId) {
      throw new AppError(409, "CANNOT_SAVE_OWN_CARD", "This card is already yours");
    }

    const statuses = initialAiStatuses();
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO knowledge_cards
         (user_id, source_text, source_title, source_url, catalog_title, ai_summary, ai_subjects,
          ai_keywords, ai_facts, ai_related,
          ai_catalog_status, ai_embedding_status, saved_from_card_id, saved_from_author)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14)
       RETURNING id`,
      [
        userId,
        row.shared_source_text,
        row.source_title,
        row.source_url,
        row.catalog_title,
        row.ai_summary,
        row.ai_subjects,
        row.ai_keywords,
        JSON.stringify(row.ai_facts),
        JSON.stringify(row.ai_related),
        statuses.catalog,
        statuses.embedding,
        cardId,
        row.author_username,
      ],
    );
    const id = inserted.rows[0]?.id;
    if (!id) throw new Error("Card copy insert returned no row");
    await client.query("COMMIT");
    copyId = id;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (isUniqueViolation(err)) {
      throw new AppError(409, "CARD_ALREADY_SAVED", "This card is already in your vault");
    }
    throw err;
  } finally {
    client.release();
  }
  return getCard(userId, copyId);
}
