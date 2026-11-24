import { z } from "zod";

/** Tag names: trimmed, 1–100 characters (VARCHAR(100)), unique per user. */
export const createTagSchema = z.object({
  name: z.string().trim().min(1, "is required").max(100, "must be at most 100 characters"),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
