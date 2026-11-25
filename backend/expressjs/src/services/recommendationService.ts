import { pool } from "../lib/db.js";
import { AppError } from "../lib/errors.js";
import type { RelatedConcept } from "../schemas/ai.schemas.js";
import {
  FROM_PUBLIC,
  PUBLIC_COLUMNS,
  toPublicSummary,
  type PublicCardSummary,
  type PublicRow,
} from "./communityService.js";
import { getPreferences, type RecommendationPreferences } from "./preferencesService.js";
import {
  rankRecommendations,
  type RankingVaultCard,
  type RecommendationReason,
} from "./recommendationRanking.js";

/**
 * "Recommended for today" on the personal home page (REQ-DISC-008 to REQ-DISC-012).
 *
 * Eligibility is enforced in SQL before ranking: only PUBLIC cards, never the viewer's own, and
 * not ones the viewer already saved. Only public columns of those cards are selected. The
 * viewer's own vault (their cards, private or not: titles, headings, keywords and related-concept
 * names) is read to find related cards, and is used only in this viewer's response.
 *
 * No AI model is called here: ranking uses the catalog metadata Muse already produced. The
 * candidate pool is the most recently published cards, which bounds the work per request.
 */

export interface Recommendation {
  card: PublicCardSummary;
  reason: RecommendationReason;
}

export interface RecommendationShelf {
  /** The UTC day the picks are for; they stay the same all day for the same preferences. */
  date: string;
  items: Recommendation[];
  /** How many published cards were eligible for this user (counted up to the candidate pool). */
  eligibleCount: number;
}

/** Upper bound on candidates ranked per request. Past this, rank in SQL or with embeddings. */
const CANDIDATE_POOL = 500;
/** How much of the user's own vault informs the "related to your vault" signal. */
const VAULT_SAMPLE = 200;

interface CandidateRow extends PublicRow {
  ai_related: RelatedConcept[];
}

interface VaultRow {
  id: string;
  title: string | null;
  ai_subjects: string[];
  ai_keywords: string[];
  ai_related: RelatedConcept[];
}

export function onboardingRequired(): AppError {
  return new AppError(409, "ONBOARDING_REQUIRED", "Choose your interests to get recommendations");
}

export async function getRecommendations(
  userId: string,
  now: Date = new Date(),
): Promise<RecommendationShelf> {
  const preferences: RecommendationPreferences | null = await getPreferences(userId);
  if (!preferences) throw onboardingRequired();

  const [candidates, vault] = await Promise.all([
    pool.query<CandidateRow>(
      `SELECT ${PUBLIC_COLUMNS}, c.ai_related
       ${FROM_PUBLIC}
       WHERE c.visibility = 'PUBLIC'
         AND c.user_id <> $1
         AND NOT EXISTS (SELECT 1 FROM knowledge_cards s
                          WHERE s.user_id = $1 AND s.saved_from_card_id = c.id)
       ORDER BY c.published_at DESC, c.id DESC
       LIMIT $2`,
      [userId, CANDIDATE_POOL],
    ),
    pool.query<VaultRow>(
      `SELECT id, COALESCE(catalog_title, NULLIF(btrim(source_title), '')) AS title,
              ai_subjects, ai_keywords, ai_related
         FROM knowledge_cards
        WHERE user_id = $1
          AND (cardinality(ai_subjects) > 0 OR cardinality(ai_keywords) > 0
               OR jsonb_array_length(ai_related) > 0)
        ORDER BY updated_at DESC
        LIMIT $2`,
      [userId, VAULT_SAMPLE],
    ),
  ]);

  const byId = new Map(candidates.rows.map((row) => [row.id, row]));
  const vaultCards: RankingVaultCard[] = vault.rows.map((row) => ({
    id: row.id,
    title: row.title ?? "an untitled card",
    subjects: row.ai_subjects,
    keywords: row.ai_keywords,
    related: (row.ai_related ?? []).map((concept) => concept.name),
  }));

  const date = now.toISOString().slice(0, 10);
  const ranked = rankRecommendations(
    candidates.rows.map((row) => ({
      id: row.id,
      title: row.catalog_title ?? row.source_title ?? "",
      subjects: row.ai_subjects,
      keywords: row.ai_keywords,
      related: (row.ai_related ?? []).map((concept) => concept.name),
      summary: row.ai_summary,
    })),
    {
      interests: preferences.interests,
      surpriseMe: preferences.surpriseMe,
      priority: preferences.priority,
      vault: vaultCards,
    },
    // Same user, same day, same preferences: the same shelf, without storing it.
    { seed: `${userId}:${date}:${preferences.updatedAt}` },
  );

  return {
    date,
    eligibleCount: candidates.rows.length,
    items: ranked.map(({ id, reason }) => ({ card: toPublicSummary(byId.get(id)!), reason })),
  };
}
