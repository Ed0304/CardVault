import { pool } from "../lib/db.js";
import { isUniqueViolation } from "../lib/dbErrors.js";
import { AppError } from "../lib/errors.js";
import { isUuid } from "../lib/ids.js";
import type { CreateCollectionInput, RenameCollectionInput } from "../schemas/collections.schemas.js";

export interface Collection {
  id: string;
  name: string;
  createdAt: string;
  /** Number of the user's cards in this collection. */
  cardCount: number;
}

interface CollectionRow {
  id: string;
  name: string;
  created_at: Date;
  card_count: number;
}

const toCollection = (row: CollectionRow): Collection => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at.toISOString(),
  cardCount: row.card_count,
});

// Every query is scoped to the user id. Card counts only count the same user's cards.
const SELECT_COLLECTIONS = `
  SELECT col.id, col.name, col.created_at,
         (SELECT count(*)::int FROM knowledge_cards k
           WHERE k.collection_id = col.id AND k.user_id = col.user_id) AS card_count
    FROM collections col`;

function collectionNotFound(): AppError {
  // Same response for "does not exist" and "belongs to someone else".
  return new AppError(404, "COLLECTION_NOT_FOUND", "Collection not found");
}

function duplicateName(): AppError {
  return new AppError(409, "COLLECTION_NAME_TAKEN", "You already have a collection with this name");
}

function assertCollectionId(id: string): void {
  if (!isUuid(id)) throw collectionNotFound();
}

async function getCollection(userId: string, id: string): Promise<Collection> {
  const result = await pool.query<CollectionRow>(
    `${SELECT_COLLECTIONS} WHERE col.id = $1 AND col.user_id = $2`,
    [id, userId],
  );
  const row = result.rows[0];
  if (!row) throw collectionNotFound();
  return toCollection(row);
}

/** The user's collections, alphabetical (case-insensitive), with card counts. */
export async function getCollections(userId: string): Promise<Collection[]> {
  const result = await pool.query<CollectionRow>(
    `${SELECT_COLLECTIONS} WHERE col.user_id = $1 ORDER BY lower(col.name), col.id`,
    [userId],
  );
  return result.rows.map(toCollection);
}

export async function createCollection(
  userId: string,
  input: CreateCollectionInput,
): Promise<Collection> {
  try {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO collections (user_id, name) VALUES ($1, $2) RETURNING id",
      [userId, input.name],
    );
    return await getCollection(userId, result.rows[0]!.id);
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicateName();
    throw err;
  }
}

export async function renameCollection(
  userId: string,
  id: string,
  input: RenameCollectionInput,
): Promise<Collection> {
  assertCollectionId(id);
  try {
    const result = await pool.query(
      "UPDATE collections SET name = $1 WHERE id = $2 AND user_id = $3",
      [input.name, id, userId],
    );
    if (result.rowCount === 0) throw collectionNotFound();
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicateName();
    throw err;
  }
  return getCollection(userId, id);
}

/**
 * Deletes the collection. Its cards are kept and become uncollected: the foreign key on
 * knowledge_cards.collection_id is ON DELETE SET NULL (REQ-CAT-008).
 */
export async function deleteCollection(userId: string, id: string): Promise<void> {
  assertCollectionId(id);
  const result = await pool.query("DELETE FROM collections WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
  if (result.rowCount === 0) throw collectionNotFound();
}
