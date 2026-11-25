import { z } from "zod";

/**
 * Shapes and limits of the structured catalog fields (REQ-AI-017), shared by the FastAPI
 * response check and the owner's edits, so a draft can always be saved as it is.
 */
export const LIMITS = {
  title: 200,
  summary: 2_000,
  subjects: 5,
  keywords: 15,
  label: 100,
  facts: 8,
  factLabel: 60,
  factValue: 200,
  related: 8,
  relation: 60,
} as const;

const label = z.string().trim().min(1).max(LIMITS.label);

export const factSchema = z.object({
  label: z.string().trim().min(1).max(LIMITS.factLabel),
  value: z.string().trim().min(1).max(LIMITS.factValue),
});

export const relatedConceptSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.label),
  relation: z.string().trim().min(1).max(LIMITS.relation),
});

export const factsSchema = z.array(factSchema).max(LIMITS.facts);
export const relatedSchema = z.array(relatedConceptSchema).max(LIMITS.related);

/**
 * The FastAPI catalog response, validated before anything is stored (REQ-AI-005). FastAPI
 * already constrains and normalises the model output; this check does not trust that. Unknown
 * keys are dropped. The structured fields default to empty for an AI service that predates them.
 */
export const catalogServiceResponseSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.title).nullable().optional().transform((v) => v ?? null),
  summary: z.string().trim().min(1).max(LIMITS.summary),
  facts: factsSchema.default([]),
  subjects: z.array(label).min(1).max(LIMITS.subjects),
  keywords: z.array(label).min(1).max(LIMITS.keywords),
  related: relatedSchema.default([]),
  model: z.string().trim().min(1).max(100),
  truncated: z.boolean(),
});

export type CatalogServiceResponse = z.infer<typeof catalogServiceResponseSchema>;
export type Fact = z.infer<typeof factSchema>;
export type RelatedConcept = z.infer<typeof relatedConceptSchema>;
