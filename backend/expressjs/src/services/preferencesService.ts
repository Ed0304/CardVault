import { pool } from "../lib/db.js";
import type { RecommendationPriority, UpdatePreferencesInput } from "../schemas/preferences.schemas.js";
import { normalizeTopic, STARTER_TOPICS } from "./topicCatalog.js";

/**
 * Recommendation preferences (REQ-DISC-004 to REQ-DISC-007). They belong to one user, are read
 * and written only for the signed-in user's own id, and never appear in a public response.
 */

export interface RecommendationPreferences {
  interests: string[];
  surpriseMe: boolean;
  priority: RecommendationPriority;
  onboardedAt: string;
  updatedAt: string;
}

interface PreferencesRow {
  interests: string[];
  surprise_me: boolean;
  priority: RecommendationPriority;
  onboarded_at: Date;
  updated_at: Date;
}

const COLUMNS = "interests, surprise_me, priority, onboarded_at, updated_at";

function toPreferences(row: PreferencesRow): RecommendationPreferences {
  return {
    interests: row.interests,
    surpriseMe: row.surprise_me,
    priority: row.priority,
    onboardedAt: row.onboarded_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** The user's preferences, or null when they have not completed onboarding yet. */
export async function getPreferences(userId: string): Promise<RecommendationPreferences | null> {
  const result = await pool.query<PreferencesRow>(
    `SELECT ${COLUMNS} FROM recommendation_preferences WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  return row ? toPreferences(row) : null;
}

/**
 * Creates or replaces the user's preferences. The first save completes onboarding; later saves
 * (from Settings) keep the original onboarding time.
 */
export async function savePreferences(
  userId: string,
  input: UpdatePreferencesInput,
): Promise<RecommendationPreferences> {
  const result = await pool.query<PreferencesRow>(
    `INSERT INTO recommendation_preferences (user_id, interests, surprise_me, priority)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
       SET interests = EXCLUDED.interests,
           surprise_me = EXCLUDED.surprise_me,
           priority = EXCLUDED.priority,
           updated_at = now()
     RETURNING ${COLUMNS}`,
    [userId, input.interests, input.surpriseMe, input.priority],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Preferences upsert returned no row");
  return toPreferences(row);
}

export interface TopicOption {
  label: string;
  description: string | null;
  /** STARTER: CardVault's starter list. CATALOG: a subject heading used on published cards. */
  source: "STARTER" | "CATALOG";
  /** For CATALOG topics, how many published cards use the heading. */
  publicCardCount: number | null;
}

const MAX_CATALOG_TOPICS = 12;

/**
 * Topics to choose from: the starter list, then the subject headings most used on published
 * cards (public data only), so the choices grow with the catalog.
 */
export async function listTopicOptions(): Promise<TopicOption[]> {
  const starter: TopicOption[] = STARTER_TOPICS.map((topic) => ({
    label: topic.label,
    description: topic.description,
    source: "STARTER",
    publicCardCount: null,
  }));
  const taken = new Set(starter.map((topic) => normalizeTopic(topic.label)));

  // Groups headings case-insensitively and shows the spelling most cards use.
  const result = await pool.query<{ label: string; cards: string }>(
    `SELECT mode() WITHIN GROUP (ORDER BY s.subject) AS label, count(DISTINCT c.id) AS cards
       FROM knowledge_cards c
       CROSS JOIN LATERAL unnest(c.ai_subjects) AS s(subject)
      WHERE c.visibility = 'PUBLIC' AND btrim(s.subject) <> ''
      GROUP BY lower(btrim(s.subject))
      ORDER BY count(DISTINCT c.id) DESC, lower(btrim(s.subject))
      LIMIT $1`,
    [MAX_CATALOG_TOPICS * 2],
  );

  const fromCatalog: TopicOption[] = [];
  for (const row of result.rows) {
    const label = row.label.trim().slice(0, 60);
    const key = normalizeTopic(label);
    if (!key || taken.has(key)) continue;
    taken.add(key);
    fromCatalog.push({ label, description: null, source: "CATALOG", publicCardCount: Number(row.cards) });
    if (fromCatalog.length === MAX_CATALOG_TOPICS) break;
  }
  return [...starter, ...fromCatalog];
}
