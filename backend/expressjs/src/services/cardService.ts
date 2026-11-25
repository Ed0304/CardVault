import { pool } from "../lib/db.js";
import { isForeignKeyViolation } from "../lib/dbErrors.js";
import { AppError } from "../lib/errors.js";
import { isUuid } from "../lib/ids.js";
import type {
  CreateCardInput,
  ListCardsQuery,
  SetCollectionInput,
  SetVisibilityInput,
  UpdateAiMetadataInput,
  UpdateNotesInput,
} from "../schemas/cards.schemas.js";
import type { Fact, RelatedConcept } from "../schemas/ai.schemas.js";

export type AiStatus = "PENDING" | "COMPLETE" | "FAILED" | "NOT_AVAILABLE";
export type Visibility = "PRIVATE" | "PUBLIC";

/** Provenance of a card saved from the Community Catalog (REQ-CAT-013). */
export interface SavedFrom {
  /** The original card's id, kept even after the original is deleted. */
  cardId: string;
  /** The original author's username when the copy was made. */
  authorUsername: string;
  /** Whether the original is still published, so the UI can link to it. */
  originalAvailable: boolean;
}

/** A related concept as shown: linked to a card when one with that title exists. */
export interface RelatedConceptLink extends RelatedConcept {
  /** A card the viewer can open for this concept, or null. Worked out on read, never stored. */
  cardId: string | null;
}

export interface CardSummary {
  id: string;
  /** The catalog entry's own heading; null means "use the source title". */
  catalogTitle: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  aiSummary: string | null;
  aiSubjects: string[];
  aiCatalogStatus: AiStatus;
  aiEmbeddingStatus: AiStatus;
  collection: { id: string; name: string } | null;
  tags: { id: string; name: string }[];
  visibility: Visibility;
  publishedAt: string | null;
  savedFrom: SavedFrom | null;
  createdAt: string;
}

export interface CardDetail extends CardSummary {
  sourceText: string;
  sourceMeta: Record<string, unknown> | null;
  notes: string | null;
  aiKeywords: string[];
  /** Factual attributes, e.g. [{ label: "Author", value: "Jane Doe" }]. */
  aiFacts: Fact[];
  aiRelated: RelatedConceptLink[];
  /** Whether the public card includes the source text (only meaningful while PUBLIC). */
  shareSourceText: boolean;
  /** AI suggestions awaiting the owner's review; never shown on public cards. */
  aiCatalogDraft: CatalogDraft | null;
  updatedAt: string;
}

/** A Muse catalog suggestion. It changes nothing on the card until the owner saves it. */
export interface CatalogDraft {
  /** Suggested catalog title; null when Muse found none. (Absent in drafts made before it.) */
  catalogTitle: string | null;
  summary: string;
  facts: Fact[];
  subjects: string[];
  keywords: string[];
  related: RelatedConcept[];
  /** The model that wrote it, shown with the suggestion. */
  model: string;
  /** True when only the first part of a long source text was cataloged. */
  truncated: boolean;
  generatedAt: string;
}

export interface CardPage {
  items: CardSummary[];
  total: number;
  page: number;
  pageSize: number;
}

const MAX_DERIVED_TITLE_LENGTH = 200;

/**
 * Initial AI statuses for a new card (decision D-9). No AI integration exists yet, so both
 * operations are NOT_AVAILABLE: not attempted, and not a failure. When catalog generation is
 * implemented, the catalog status becomes PENDING while it is enabled.
 */
export function initialAiStatuses(): { catalog: AiStatus; embedding: AiStatus } {
  return { catalog: "NOT_AVAILABLE", embedding: "NOT_AVAILABLE" };
}

/** REQ-CAT-001: the title defaults to the first non-empty line of the content. */
export function deriveTitle(sourceText: string): string {
  const firstLine = sourceText.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? "";
  return firstLine.length > MAX_DERIVED_TITLE_LENGTH
    ? `${firstLine.slice(0, MAX_DERIVED_TITLE_LENGTH - 1).trimEnd()}…`
    : firstLine;
}

/** SQL matching a LIKE parameter against fact labels and values and related-concept names. */
export function catalogJsonMatches(alias: string, param: string): string {
  return `EXISTS (SELECT 1 FROM jsonb_array_elements(${alias}.ai_facts) f
                   WHERE f->>'label' ILIKE ${param} ESCAPE '\\' OR f->>'value' ILIKE ${param} ESCAPE '\\')
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(${alias}.ai_related) r
                   WHERE r->>'name' ILIKE ${param} ESCAPE '\\')`;
}

/** A LIKE pattern that matches `query` literally anywhere (wildcards in it are escaped). */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** A malformed id can never match a card, so it is treated as "not found". */
export function assertCardId(cardId: string): void {
  if (!isUuid(cardId)) throw cardNotFound();
}

export function cardNotFound(): AppError {
  // Same response for "does not exist" and "belongs to someone else" (REQ-CAT-004).
  return new AppError(404, "CARD_NOT_FOUND", "Card not found");
}

/** True when the card exists and belongs to the user. */
export async function cardBelongsToUser(userId: string, cardId: string): Promise<boolean> {
  const result = await pool.query("SELECT 1 FROM knowledge_cards WHERE id = $1 AND user_id = $2", [
    cardId,
    userId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

// Columns shared by list and detail queries. Collection and tags are joined through the
// card's own user_id, so another user's collection or tag can never appear on a card.
const SUMMARY_COLUMNS = `
  c.id, c.catalog_title, c.source_title, c.source_url, c.ai_summary, c.ai_subjects,
  c.ai_catalog_status, c.ai_embedding_status, c.created_at,
  c.visibility, c.published_at, c.saved_from_card_id, c.saved_from_author,
  (c.saved_from_card_id IS NOT NULL AND EXISTS (
     SELECT 1 FROM knowledge_cards o
      WHERE o.id = c.saved_from_card_id AND o.visibility = 'PUBLIC')) AS saved_from_available,
  col.id   AS collection_id,
  col.name AS collection_name,
  COALESCE(
    (SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
       FROM card_tags ct
       JOIN tags t ON t.id = ct.tag_id AND t.user_id = c.user_id
      WHERE ct.card_id = c.id),
    '[]'::json
  ) AS tags`;

const DETAIL_COLUMNS = `${SUMMARY_COLUMNS},
  c.source_text, c.source_meta, c.notes, c.ai_keywords, c.ai_facts, c.ai_related,
  c.share_source_text, c.ai_catalog_draft, c.updated_at`;

const FROM_CARDS = `
  FROM knowledge_cards c
  LEFT JOIN collections col ON col.id = c.collection_id AND col.user_id = c.user_id`;

interface CardRow {
  id: string;
  catalog_title: string | null;
  source_title: string | null;
  source_url: string | null;
  ai_summary: string | null;
  ai_subjects: string[];
  ai_catalog_status: AiStatus;
  ai_embedding_status: AiStatus;
  created_at: Date;
  collection_id: string | null;
  collection_name: string | null;
  tags: { id: string; name: string }[];
  visibility: Visibility;
  published_at: Date | null;
  saved_from_card_id: string | null;
  saved_from_author: string | null;
  saved_from_available: boolean;
  source_text?: string;
  source_meta?: Record<string, unknown> | null;
  notes?: string | null;
  ai_keywords?: string[];
  ai_facts?: Fact[];
  ai_related?: RelatedConcept[];
  share_source_text?: boolean;
  ai_catalog_draft?: Partial<CatalogDraft> | null;
  updated_at?: Date;
}

/** Drafts made before the structured fields existed lack them; fill in empty values. */
function toDraft(draft: Partial<CatalogDraft> | null | undefined): CatalogDraft | null {
  if (!draft) return null;
  return {
    catalogTitle: draft.catalogTitle ?? null,
    summary: draft.summary ?? "",
    facts: draft.facts ?? [],
    subjects: draft.subjects ?? [],
    keywords: draft.keywords ?? [],
    related: draft.related ?? [],
    model: draft.model ?? "",
    truncated: draft.truncated ?? false,
    generatedAt: draft.generatedAt ?? "",
  };
}

/**
 * Links related concepts to cards with a matching title (catalog title or source title,
 * case-insensitive). `scope` decides which cards may be linked: the owner's own cards, or
 * published cards for the public view. The card itself is never linked.
 */
export async function linkRelated(
  related: RelatedConcept[],
  excludeCardId: string,
  scope: { userId: string } | { publicOnly: true },
): Promise<RelatedConceptLink[]> {
  if (related.length === 0) return [];
  const names = related.map((r) => r.name.trim().toLowerCase());
  const scopeSql = "userId" in scope ? "user_id = $3" : "visibility = 'PUBLIC'";
  const params: unknown[] = [names, excludeCardId];
  if ("userId" in scope) params.push(scope.userId);

  const result = await pool.query<{ id: string; catalog: string | null; source: string | null }>(
    `SELECT id, lower(btrim(catalog_title)) AS catalog, lower(btrim(source_title)) AS source
       FROM knowledge_cards
      WHERE ${scopeSql} AND id <> $2
        AND (lower(btrim(catalog_title)) = ANY($1::text[]) OR lower(btrim(source_title)) = ANY($1::text[]))
      ORDER BY created_at DESC`,
    params,
  );
  // A catalog-title match wins over a source-title match; otherwise the newest card wins.
  const byName = new Map<string, string>();
  for (const row of result.rows) if (row.catalog && !byName.has(row.catalog)) byName.set(row.catalog, row.id);
  for (const row of result.rows) if (row.source && !byName.has(row.source)) byName.set(row.source, row.id);

  return related.map((r) => ({ ...r, cardId: byName.get(r.name.trim().toLowerCase()) ?? null }));
}

function toSummary(row: CardRow): CardSummary {
  return {
    id: row.id,
    catalogTitle: row.catalog_title,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    aiSummary: row.ai_summary,
    aiSubjects: row.ai_subjects,
    aiCatalogStatus: row.ai_catalog_status,
    aiEmbeddingStatus: row.ai_embedding_status,
    collection:
      row.collection_id && row.collection_name
        ? { id: row.collection_id, name: row.collection_name }
        : null,
    tags: row.tags,
    visibility: row.visibility,
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
    savedFrom:
      row.saved_from_card_id && row.saved_from_author
        ? {
            cardId: row.saved_from_card_id,
            authorUsername: row.saved_from_author,
            originalAvailable: row.saved_from_available,
          }
        : null,
    createdAt: row.created_at.toISOString(),
  };
}

function toDetail(row: CardRow): CardDetail {
  return {
    ...toSummary(row),
    sourceText: row.source_text ?? "",
    sourceMeta: row.source_meta ?? null,
    notes: row.notes ?? null,
    aiKeywords: row.ai_keywords ?? [],
    aiFacts: row.ai_facts ?? [],
    // Linked in getCard; plain here.
    aiRelated: (row.ai_related ?? []).map((r) => ({ ...r, cardId: null })),
    shareSourceText: row.share_source_text ?? false,
    aiCatalogDraft: toDraft(row.ai_catalog_draft),
    updatedAt: (row.updated_at ?? row.created_at).toISOString(),
  };
}

/** Loads one card for its owner, or throws 404. Every query is scoped to the user id. */
export async function getCard(userId: string, cardId: string): Promise<CardDetail> {
  assertCardId(cardId);
  const result = await pool.query<CardRow>(
    `SELECT ${DETAIL_COLUMNS} ${FROM_CARDS}
      WHERE c.id = $1 AND c.user_id = $2`,
    [cardId, userId],
  );
  const row = result.rows[0];
  if (!row) throw cardNotFound();
  const card = toDetail(row);
  card.aiRelated = await linkRelated(row.ai_related ?? [], cardId, { userId });
  return card;
}

/**
 * Creates a card. `sourceMeta` is set only by server-side ingestion (URL ingestion); the request
 * schema for pasted text has no such field, so clients cannot supply it.
 */
export async function createCard(
  userId: string,
  input: CreateCardInput & { sourceMeta?: Record<string, unknown> },
): Promise<CardDetail> {
  const statuses = initialAiStatuses();
  const title = input.sourceTitle ?? (deriveTitle(input.sourceText) || null);

  const result = await pool.query<{ id: string }>(
    `INSERT INTO knowledge_cards
       (user_id, source_text, source_title, source_url, source_meta, ai_catalog_status, ai_embedding_status)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     RETURNING id`,
    [
      userId,
      input.sourceText,
      title,
      input.sourceUrl ?? null,
      input.sourceMeta ? JSON.stringify(input.sourceMeta) : null,
      statuses.catalog,
      statuses.embedding,
    ],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("Card insert returned no row");
  return getCard(userId, id);
}

/**
 * REQ-CAT-003: the caller's cards, newest first, with filters applied before both the page and
 * the total. Ties on created_at are broken by id so the order is stable across pages.
 */
export async function listCards(userId: string, query: ListCardsQuery): Promise<CardPage> {
  const conditions = ["c.user_id = $1"];
  const params: unknown[] = [userId];

  if (query.collectionId) {
    params.push(query.collectionId);
    conditions.push(`c.collection_id = $${params.length}`);
  }
  if (query.tagId) {
    params.push(query.tagId);
    conditions.push(
      `EXISTS (SELECT 1 FROM card_tags ct JOIN tags t ON t.id = ct.tag_id AND t.user_id = c.user_id
                WHERE ct.card_id = c.id AND ct.tag_id = $${params.length})`,
    );
  }
  if (query.q) {
    // Keyword search over the owner's own card: every layer, including the saved catalog
    // details, so AI cataloging makes cards findable by subject and keyword (D-14).
    params.push(likePattern(query.q));
    const p = `$${params.length}`;
    conditions.push(`(
      c.catalog_title ILIKE ${p} ESCAPE '\\'
      OR c.source_title ILIKE ${p} ESCAPE '\\'
      OR c.source_text ILIKE ${p} ESCAPE '\\'
      OR c.notes ILIKE ${p} ESCAPE '\\'
      OR c.ai_summary ILIKE ${p} ESCAPE '\\'
      OR array_to_string(c.ai_subjects, ' ') ILIKE ${p} ESCAPE '\\'
      OR array_to_string(c.ai_keywords, ' ') ILIKE ${p} ESCAPE '\\'
      OR ${catalogJsonMatches("c", p)}
    )`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;

  const countResult = await pool.query<{ total: string }>(
    `SELECT count(*) AS total FROM knowledge_cards c ${where}`,
    params,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const offset = (query.page - 1) * query.pageSize;
  const pageParams = [...params, query.pageSize, offset];
  const rows = await pool.query<CardRow>(
    `SELECT ${SUMMARY_COLUMNS} ${FROM_CARDS}
     ${where}
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
    pageParams,
  );

  return { items: rows.rows.map(toSummary), total, page: query.page, pageSize: query.pageSize };
}

/** Updates only the personal notes layer. Never touches source or AI fields (REQ-CAT-005). */
export async function updateNotes(
  userId: string,
  cardId: string,
  input: UpdateNotesInput,
): Promise<CardDetail> {
  assertCardId(cardId);
  const notes = input.notes && input.notes.trim().length > 0 ? input.notes : null;
  const result = await pool.query(
    `UPDATE knowledge_cards SET notes = $1, updated_at = now()
      WHERE id = $2 AND user_id = $3`,
    [notes, cardId, userId],
  );
  if (result.rowCount === 0) throw cardNotFound();
  return getCard(userId, cardId);
}

/**
 * Updates the AI catalog fields with the user's edits (REQ-CAT-006, REQ-AI-007). Only the fields
 * provided are changed. Neither AI status changes and no generation is triggered.
 */
export async function updateAiMetadata(
  userId: string,
  cardId: string,
  input: UpdateAiMetadataInput,
): Promise<CardDetail> {
  assertCardId(cardId);
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.aiSummary !== undefined) {
    params.push(input.aiSummary && input.aiSummary.length > 0 ? input.aiSummary : null);
    sets.push(`ai_summary = $${params.length}`);
  }
  if (input.aiSubjects !== undefined) {
    params.push(input.aiSubjects);
    sets.push(`ai_subjects = $${params.length}`);
  }
  if (input.aiKeywords !== undefined) {
    params.push(input.aiKeywords);
    sets.push(`ai_keywords = $${params.length}`);
  }
  if (input.catalogTitle !== undefined) {
    params.push(input.catalogTitle);
    sets.push(`catalog_title = $${params.length}`);
  }
  if (input.aiFacts !== undefined) {
    params.push(JSON.stringify(input.aiFacts));
    sets.push(`ai_facts = $${params.length}::jsonb`);
  }
  if (input.aiRelated !== undefined) {
    params.push(JSON.stringify(input.aiRelated));
    sets.push(`ai_related = $${params.length}::jsonb`);
  }

  // Saving catalog details resolves any pending AI suggestion: the owner has either accepted it
  // (with their edits) or written their own. The draft never overrides this save.
  params.push(cardId, userId);
  const result = await pool.query(
    `UPDATE knowledge_cards SET ${sets.join(", ")}, ai_catalog_draft = NULL, updated_at = now()
      WHERE id = $${params.length - 1} AND user_id = $${params.length}`,
    params,
  );
  if (result.rowCount === 0) throw cardNotFound();
  return getCard(userId, cardId);
}

/**
 * Puts the card in one of the user's collections, or removes it from its collection with null
 * (REQ-CAT-008: at most one collection per card).
 *
 * The schema's foreign key only checks that the collection exists, not who owns it, so the
 * ownership check runs inside the same UPDATE: a card can never end up in another user's
 * collection, and there is no gap between checking and writing.
 */
export async function setCollection(
  userId: string,
  cardId: string,
  input: SetCollectionInput,
): Promise<CardDetail> {
  assertCardId(cardId);
  let updated: number;
  try {
    const result = await pool.query(
      `UPDATE knowledge_cards c
          SET collection_id = $1::uuid, updated_at = now()
        WHERE c.id = $2 AND c.user_id = $3
          AND ($1::uuid IS NULL
               OR EXISTS (SELECT 1 FROM collections col WHERE col.id = $1::uuid AND col.user_id = $3))`,
      [input.collectionId, cardId, userId],
    );
    updated = result.rowCount ?? 0;
  } catch (err) {
    // The collection was deleted between the check and the write.
    if (isForeignKeyViolation(err)) throw collectionNotFound();
    throw err;
  }

  if (updated === 0) {
    if (!(await cardBelongsToUser(userId, cardId))) throw cardNotFound();
    throw collectionNotFound();
  }
  return getCard(userId, cardId);
}

function collectionNotFound(): AppError {
  return new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found");
}

/**
 * Publishes or unpublishes one of the user's cards (REQ-CAT-011).
 *
 * Publishing records whether the source text is shared and keeps the first publication time if
 * the card is already public, so changing the text choice does not move it up the community list.
 * Unpublishing clears both, so publishing again needs a fresh choice. Saved copies cannot be
 * published (REQ-CAT-013): that would republish another author's card under a new owner.
 */
export async function setVisibility(
  userId: string,
  cardId: string,
  input: SetVisibilityInput,
): Promise<CardDetail> {
  assertCardId(cardId);

  if (input.visibility === "PRIVATE") {
    const result = await pool.query(
      `UPDATE knowledge_cards
          SET visibility = 'PRIVATE', published_at = NULL, share_source_text = false, updated_at = now()
        WHERE id = $1 AND user_id = $2`,
      [cardId, userId],
    );
    if (result.rowCount === 0) throw cardNotFound();
    return getCard(userId, cardId);
  }

  const result = await pool.query(
    `UPDATE knowledge_cards
        SET visibility = 'PUBLIC', published_at = COALESCE(published_at, now()),
            share_source_text = $1, updated_at = now()
      WHERE id = $2 AND user_id = $3 AND saved_from_card_id IS NULL`,
    [input.shareSourceText, cardId, userId],
  );
  if (result.rowCount === 0) {
    if (!(await cardBelongsToUser(userId, cardId))) throw cardNotFound();
    throw new AppError(409, "SAVED_COPY_NOT_PUBLISHABLE", "Cards saved from the community can't be published");
  }
  return getCard(userId, cardId);
}

/** Permanently deletes a card; its tag links go with it (REQ-CAT-007). */
export async function deleteCard(userId: string, cardId: string): Promise<void> {
  assertCardId(cardId);
  const result = await pool.query(
    `DELETE FROM knowledge_cards WHERE id = $1 AND user_id = $2`,
    [cardId, userId],
  );
  if (result.rowCount === 0) throw cardNotFound();
}
