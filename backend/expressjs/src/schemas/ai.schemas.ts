import { z } from "zod";

/**
 * The FastAPI catalog response, validated before anything is stored (REQ-AI-005). FastAPI
 * already constrains and normalises the model output; this check does not trust that.
 * Bounds match the AI-metadata edit limits, so a draft can always be saved as it is.
 */
const label = z.string().trim().min(1).max(100);

export const catalogServiceResponseSchema = z.object({
  summary: z.string().trim().min(1).max(2_000),
  subjects: z.array(label).min(1).max(5),
  keywords: z.array(label).min(1).max(15),
  model: z.string().trim().min(1).max(100),
  truncated: z.boolean(),
});

export type CatalogServiceResponse = z.infer<typeof catalogServiceResponseSchema>;
