import { z } from "zod";

export const MAX_INTERESTS = 20;
export const MAX_INTEREST_LENGTH = 60;

export const RECOMMENDATION_PRIORITIES = ["BALANCED", "INTERESTS", "VAULT"] as const;
export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];

const interestSchema = z
  .string()
  .trim()
  .min(1, "must not be empty")
  .max(MAX_INTEREST_LENGTH, `must be at most ${MAX_INTEREST_LENGTH} characters`)
  // Topic labels are plain text: no control characters or markup brackets.
  .refine((value) => !/[\u0000-\u001f\u007f<>]/.test(value), "must be plain text");

/**
 * PUT /api/preferences. A valid choice has at least one interest or "Surprise me"
 * (REQ-DISC-005). Interests that differ only in case or spacing are kept once.
 */
export const updatePreferencesSchema = z
  .object({
    interests: z
      .array(interestSchema)
      .max(MAX_INTERESTS, `must have at most ${MAX_INTERESTS} interests`)
      .default([])
      .transform((values) => {
        const seen = new Set<string>();
        return values
          .map((value) => value.replace(/\s+/g, " "))
          .filter((value) => {
            const key = value.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
      }),
    surpriseMe: z.boolean().default(false),
    priority: z.enum(RECOMMENDATION_PRIORITIES).default("BALANCED"),
  })
  .refine((value) => value.surpriseMe || value.interests.length > 0, {
    path: ["interests"],
    message: "choose at least one interest, or choose Surprise me",
  });

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
