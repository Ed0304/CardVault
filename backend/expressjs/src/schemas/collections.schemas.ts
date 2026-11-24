import { z } from "zod";

/** Collection names: trimmed, 1–100 characters (VARCHAR(100)), unique per user. */
const collectionName = z
  .string()
  .trim()
  .min(1, "is required")
  .max(100, "must be at most 100 characters");

export const createCollectionSchema = z.object({ name: collectionName });

export const renameCollectionSchema = z.object({ name: collectionName });

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type RenameCollectionInput = z.infer<typeof renameCollectionSchema>;
