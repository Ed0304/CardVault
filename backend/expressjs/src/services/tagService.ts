import { pool } from "../lib/db.js";
import { isForeignKeyViolation, isUniqueViolation } from "../lib/dbErrors.js";
import { AppError } from "../lib/errors.js";
import { isUuid } from "../lib/ids.js";
import type { CreateTagInput } from "../schemas/tags.schemas.js";
import {
  assertCardId,
  cardBelongsToUser,
  cardNotFound,
  getCard,
  type CardDetail,
} from "./cardService.js";

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
  /** Number of the user's cards with this tag. */
  cardCount: number;
}

interface TagRow {
  id: string;
  name: string;
  created_at: Date;
  card_count: number;
}

const toTag = (row: TagRow): Tag => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at.toISOString(),
  cardCount: row.card_count,
});

// Every query is scoped to the user id. Card counts only count the same user's cards.
const SELECT_TAGS = `
  SELECT t.id, t.name, t.created_at,
         (SELECT count(*)::int FROM card_tags ct
            JOIN knowledge_cards k ON k.id = ct.card_id AND k.user_id = t.user_id
           WHERE ct.tag_id = t.id) AS card_count
    FROM tags t`;

function tagNotFound(): AppError {
  // Same response for "does not exist" and "belongs to someone else".
  return new AppError(404, "TAG_NOT_FOUND", "Tag not found");
}

function assertTagId(id: string): void {
  if (!isUuid(id)) throw tagNotFound();
}

async function tagBelongsToUser(userId: string, tagId: string): Promise<boolean> {
  const result = await pool.query("SELECT 1 FROM tags WHERE id = $1 AND user_id = $2", [tagId, userId]);
  return (result.rowCount ?? 0) > 0;
}

/** Explains why a card-tag change matched nothing: missing card, missing tag, or no change needed. */
async function assertCardAndTagOwned(userId: string, cardId: string, tagId: string): Promise<void> {
  if (!(await cardBelongsToUser(userId, cardId))) throw cardNotFound();
  if (!(await tagBelongsToUser(userId, tagId))) throw tagNotFound();
}

/** The user's tags, alphabetical (case-insensitive), with card counts. */
export async function getTags(userId: string): Promise<Tag[]> {
  const result = await pool.query<TagRow>(
    `${SELECT_TAGS} WHERE t.user_id = $1 ORDER BY lower(t.name), t.id`,
    [userId],
  );
  return result.rows.map(toTag);
}

export async function createTag(userId: string, input: CreateTagInput): Promise<Tag> {
  try {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO tags (user_id, name) VALUES ($1, $2) RETURNING id",
      [userId, input.name],
    );
    const row = await pool.query<TagRow>(`${SELECT_TAGS} WHERE t.id = $1 AND t.user_id = $2`, [
      result.rows[0]!.id,
      userId,
    ]);
    return toTag(row.rows[0]!);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, "TAG_NAME_TAKEN", "You already have a tag with this name");
    }
    throw err;
  }
}

/** Deletes the tag and removes it from every card (card_tags is ON DELETE CASCADE; REQ-CAT-009). */
export async function deleteTag(userId: string, id: string): Promise<void> {
  assertTagId(id);
  const result = await pool.query("DELETE FROM tags WHERE id = $1 AND user_id = $2", [id, userId]);
  if (result.rowCount === 0) throw tagNotFound();
}

/**
 * Adds one of the user's tags to one of the user's cards. Adding a tag the card already has is
 * not an error.
 *
 * The schema's foreign keys only check that the card and tag exist, not who owns them, so the
 * INSERT selects both rows by the user id in the same statement: a card can never get another
 * user's tag, and another user's card can never get this user's tag.
 */
export async function applyTagToCard(userId: string, cardId: string, tagId: string): Promise<CardDetail> {
  assertCardId(cardId);
  assertTagId(tagId);
  let inserted: number;
  try {
    const result = await pool.query(
      `INSERT INTO card_tags (card_id, tag_id)
       SELECT c.id, t.id
         FROM knowledge_cards c
         JOIN tags t ON t.user_id = c.user_id
        WHERE c.id = $1 AND t.id = $2 AND c.user_id = $3
       ON CONFLICT (card_id, tag_id) DO NOTHING`,
      [cardId, tagId, userId],
    );
    inserted = result.rowCount ?? 0;
  } catch (err) {
    // The card or tag was deleted between the select and the insert.
    if (isForeignKeyViolation(err)) {
      await assertCardAndTagOwned(userId, cardId, tagId);
    }
    throw err;
  }
  if (inserted === 0) await assertCardAndTagOwned(userId, cardId, tagId);
  return getCard(userId, cardId);
}

/** Removes the tag from the card. Removing a tag the card does not have is not an error. */
export async function removeTagFromCard(userId: string, cardId: string, tagId: string): Promise<CardDetail> {
  assertCardId(cardId);
  assertTagId(tagId);
  const result = await pool.query(
    `DELETE FROM card_tags ct
      USING knowledge_cards c, tags t
      WHERE ct.card_id = c.id AND ct.tag_id = t.id
        AND c.id = $1 AND t.id = $2 AND c.user_id = $3 AND t.user_id = $3`,
    [cardId, tagId, userId],
  );
  if (result.rowCount === 0) await assertCardAndTagOwned(userId, cardId, tagId);
  return getCard(userId, cardId);
}
