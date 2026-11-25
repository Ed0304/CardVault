import { z } from "zod";
import { uuidSchema } from "../lib/ids.js";

/** Upper bound on pasted source text (decision D-4, provisional): about 100 KB of text. */
export const MAX_SOURCE_TEXT_LENGTH = 100_000;

const optionalTrimmedText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `must be at most ${max} characters`)
    .optional()
    .transform((value) => (value ? value : undefined));

/** http(s) URL only; other schemes (javascript:, file:, data:) are rejected. */
const httpUrl = z
  .string()
  .trim()
  .max(2048, "must be at most 2048 characters")
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "must be an http or https URL");

export const createCardSchema = z.object({
  sourceText: z
    .string()
    .max(MAX_SOURCE_TEXT_LENGTH, `must be at most ${MAX_SOURCE_TEXT_LENGTH} characters`)
    .refine((value) => value.trim().length > 0, "is required"),
  sourceTitle: optionalTrimmedText(300),
  sourceUrl: z
    .union([httpUrl, z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
});

/**
 * Create a card from a public web page (REQ-URL-001). Only presence and length are checked here;
 * the ingestion service parses the URL and returns specific error codes (INVALID_URL,
 * INVALID_SCHEME, UNSUPPORTED_PORT).
 */
export const createCardFromUrlSchema = z.object({
  url: z.string().trim().min(1, "is required").max(2048, "must be at most 2048 characters"),
});

export const updateNotesSchema = z.object({
  // Empty notes are stored as "no notes".
  notes: z.string().max(20_000, "must be at most 20000 characters").nullable(),
});

const label = z.string().trim().min(1, "must not be empty").max(100, "must be at most 100 characters");

/** User edits to AI metadata. Bounds follow REQ-AI-003/004 as upper limits; edits may remove items. */
export const updateAiMetadataSchema = z
  .object({
    aiSummary: z.string().trim().max(2_000, "must be at most 2000 characters").nullable().optional(),
    aiSubjects: z.array(label).max(5, "must have at most 5 subjects").optional(),
    aiKeywords: z.array(label).max(15, "must have at most 15 keywords").optional(),
  })
  .refine(
    (value) =>
      value.aiSummary !== undefined || value.aiSubjects !== undefined || value.aiKeywords !== undefined,
    { message: "at least one of aiSummary, aiSubjects or aiKeywords is required" },
  );

/** Page size: default 20 (REQ-CAT-003); maximum 50, matching the search design. */
export const listCardsQuerySchema = z.object({
  // Keyword search within the user's own cards (REQ-CAT-003, D-14).
  q: z
    .string()
    .trim()
    .max(500, "must be at most 500 characters")
    .optional()
    .transform((value) => (value ? value : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  collectionId: uuidSchema.optional(),
  tagId: uuidSchema.optional(),
});

/** Put a card in one of the user's collections, or take it out with null (REQ-CAT-008). */
export const setCollectionSchema = z.object({
  collectionId: uuidSchema.nullable(),
});

/**
 * Publish or unpublish a card (REQ-CAT-011). Publishing must state whether the original source
 * text is shared, so the choice is always explicit; there is no default.
 */
export const setVisibilitySchema = z.discriminatedUnion("visibility", [
  z.object({ visibility: z.literal("PUBLIC"), shareSourceText: z.boolean() }),
  z.object({ visibility: z.literal("PRIVATE") }),
]);

/** Community Catalog listing and keyword search (REQ-CAT-012). */
export const listPublicCardsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(500, "must be at most 500 characters")
    .optional()
    .transform((value) => (value ? value : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type CreateCardFromUrlInput = z.infer<typeof createCardFromUrlSchema>;
export type SetVisibilityInput = z.infer<typeof setVisibilitySchema>;
export type ListPublicCardsQuery = z.infer<typeof listPublicCardsQuerySchema>;
export type UpdateNotesInput = z.infer<typeof updateNotesSchema>;
export type UpdateAiMetadataInput = z.infer<typeof updateAiMetadataSchema>;
export type ListCardsQuery = z.infer<typeof listCardsQuerySchema>;
export type SetCollectionInput = z.infer<typeof setCollectionSchema>;
