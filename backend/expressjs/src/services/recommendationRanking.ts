import type { RecommendationPriority } from "../schemas/preferences.schemas.js";
import { normalizeTopic, termsForInterest } from "./topicCatalog.js";

/**
 * Ranks published cards for one user's "Recommended for today" (REQ-DISC-008 to REQ-DISC-011).
 *
 * Pure and deterministic: no database, no network, no AI call. It works on catalog metadata that
 * Muse and the authors already produced (subject headings, keywords, related concepts, titles),
 * so a dashboard render costs one ranking pass and never a model call. A future embedding
 * similarity score can be added as another signal next to the ones below.
 *
 * Signals:
 * - INTEREST  the card matches a topic the user chose.
 * - BRIDGE    the card matches two of the user's topics at once.
 * - VAULT     the card shares subject headings or keywords with a card in the user's own vault.
 * - ADJACENT  the card matches none of the user's topics but shares a heading with a card that
 *             does, e.g. folklore next to Pokémon. Discovery near the user's interests.
 * - EXPLORE   a card from a subject the user has not chosen. Discovery further away.
 *
 * Every pick carries a reason naming the topic, heading or vault card behind it.
 */

export type ReasonKind = "INTEREST" | "BRIDGE" | "VAULT" | "ADJACENT" | "EXPLORE";

export interface RecommendationReason {
  kind: ReasonKind;
  /** One sentence for the reader, e.g. "Based on your interest in Cybersecurity." */
  text: string;
  /** The topics or headings the reason names. */
  topics: string[];
  /** For VAULT: the user's own card that this one relates to. */
  vaultCard?: { id: string; title: string };
}

export interface RankingCandidate {
  id: string;
  title: string;
  subjects: string[];
  keywords: string[];
  related: string[];
  summary: string | null;
}

export interface RankingVaultCard {
  id: string;
  title: string;
  subjects: string[];
  keywords: string[];
}

export interface RankingProfile {
  interests: string[];
  surpriseMe: boolean;
  priority: RecommendationPriority;
  vault: RankingVaultCard[];
}

export interface RankedRecommendation {
  id: string;
  reason: RecommendationReason;
}

export const DEFAULT_RECOMMENDATION_COUNT = 6;

// Where a match is found says how central the topic is to the card.
const FIELD_WEIGHTS = { subjects: 3, keywords: 2, title: 2, related: 1.5, summary: 1 } as const;
type Field = keyof typeof FIELD_WEIGHTS;

const PRIORITY_WEIGHTS: Record<RecommendationPriority, { interest: number; vault: number }> = {
  BALANCED: { interest: 1, vault: 1 },
  INTERESTS: { interest: 1.5, vault: 0.5 },
  VAULT: { interest: 0.6, vault: 1.5 },
};

/** Whole-word match on normalized text, allowing a plural "s"/"es" on the last word. */
function containsTerm(text: string, term: string): boolean {
  if (!text || !term) return false;
  const padded = ` ${text} `;
  return padded.includes(` ${term} `) || padded.includes(` ${term}s `) || padded.includes(` ${term}es `);
}

/** FNV-1a: a stable number per (seed, id), so ties and discovery picks change daily, not per render. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

interface Prepared {
  candidate: RankingCandidate;
  fields: Record<Field, string[]>;
  /** Normalized subject headings and keywords. */
  headings: Set<string>;
  /** Display spelling of each normalized heading. */
  display: Map<string, string>;
}

function prepare(candidate: RankingCandidate): Prepared {
  const display = new Map<string, string>();
  const headings = new Set<string>();
  for (const value of [...candidate.subjects, ...candidate.keywords, ...candidate.related]) {
    const key = normalizeTopic(value);
    if (!key) continue;
    if (!display.has(key)) display.set(key, value.trim());
  }
  for (const value of [...candidate.subjects, ...candidate.keywords]) {
    const key = normalizeTopic(value);
    if (key) headings.add(key);
  }
  return {
    candidate,
    fields: {
      subjects: candidate.subjects.map(normalizeTopic),
      keywords: candidate.keywords.map(normalizeTopic),
      title: [normalizeTopic(candidate.title)],
      related: candidate.related.map(normalizeTopic),
      summary: candidate.summary ? [normalizeTopic(candidate.summary)] : [],
    },
    headings,
    display,
  };
}

/** The best field weight at which any of the terms appears, or 0. */
function matchWeight(prepared: Prepared, terms: string[]): number {
  let best = 0;
  for (const field of Object.keys(FIELD_WEIGHTS) as Field[]) {
    const weight = FIELD_WEIGHTS[field];
    if (weight <= best) continue;
    if (prepared.fields[field].some((text) => terms.some((term) => containsTerm(text, term)))) best = weight;
  }
  return best;
}

interface Scored {
  prepared: Prepared;
  score: number;
  reason: RecommendationReason;
  /** The topic this pick is mainly about, used to spread picks across topics. */
  topicKey: string;
}

/** The card's first subject heading, else its first keyword, as a display label. */
function primaryHeading(candidate: RankingCandidate): string | null {
  const value = candidate.subjects.find((s) => s.trim()) ?? candidate.keywords.find((k) => k.trim());
  return value ? value.trim() : null;
}

/**
 * Picks up to `limit` cards. Candidates must already be eligible: published, not the user's own,
 * and not already saved by them. The caller enforces that in SQL.
 */
export function rankRecommendations(
  candidates: RankingCandidate[],
  profile: RankingProfile,
  options: { seed: string; limit?: number },
): RankedRecommendation[] {
  const limit = options.limit ?? DEFAULT_RECOMMENDATION_COUNT;
  if (limit <= 0 || candidates.length === 0) return [];

  const weights = PRIORITY_WEIGHTS[profile.priority];
  const interests = profile.interests.map((label) => ({ label, terms: termsForInterest(label) }));
  const interestKeys = new Set(interests.flatMap((i) => i.terms));
  const vault = profile.vault.map((card) => ({
    card,
    subjects: new Set(card.subjects.map(normalizeTopic).filter(Boolean)),
    keywords: new Set(card.keywords.map(normalizeTopic).filter(Boolean)),
  }));
  const tiebreak = (id: string) => hash(`${options.seed}:${id}`);
  const prepared = candidates.map(prepare);

  // Pass 1: interest, bridge and vault signals.
  const relevant: Scored[] = [];
  const rest: Prepared[] = [];
  // Headings of interest-matched cards, so neighbouring cards can be found in pass 2.
  const nearInterest = new Map<string, string>();

  for (const p of prepared) {
    const matched = interests
      .map((interest) => ({ interest, weight: matchWeight(p, interest.terms) }))
      .filter((m) => m.weight > 0)
      .sort((a, b) => b.weight - a.weight);

    let best: Scored | null = null;
    if (matched.length >= 2) {
      const [a, b] = matched as [(typeof matched)[number], (typeof matched)[number]];
      best = {
        prepared: p,
        score: (a.weight + b.weight + 1) * weights.interest,
        topicKey: normalizeTopic(`${a.interest.label} ${b.interest.label}`),
        reason: {
          kind: "BRIDGE",
          text: `Connects two topics you follow: ${a.interest.label} and ${b.interest.label}.`,
          topics: [a.interest.label, b.interest.label],
        },
      };
    } else if (matched.length === 1) {
      const { interest, weight } = matched[0]!;
      best = {
        prepared: p,
        score: weight * weights.interest,
        topicKey: normalizeTopic(interest.label),
        reason: {
          kind: "INTEREST",
          text: `Based on your interest in ${interest.label}.`,
          topics: [interest.label],
        },
      };
    }
    for (const m of matched) {
      for (const heading of p.headings) {
        if (!interestKeys.has(heading) && !nearInterest.has(heading)) nearInterest.set(heading, m.interest.label);
      }
    }

    // Vault: a shared subject heading counts 2, a shared keyword 1; at least 2 is a real link.
    let vaultBest: { score: number; card: RankingVaultCard; shared: string } | null = null;
    for (const v of vault) {
      let score = 0;
      let shared: string | null = null;
      for (const s of p.fields.subjects) {
        if (s && v.subjects.has(s)) {
          score += 2;
          shared ??= s;
        }
      }
      for (const k of p.fields.keywords) {
        if (k && (v.keywords.has(k) || v.subjects.has(k))) {
          score += 1;
          shared ??= k;
        }
      }
      if (score >= 2 && shared && (!vaultBest || score > vaultBest.score)) {
        vaultBest = { score, card: v.card, shared };
      }
    }
    if (vaultBest) {
      const vaultScore = Math.min(vaultBest.score, 6) * weights.vault;
      if (!best || vaultScore > best.score) {
        const heading = p.display.get(vaultBest.shared) ?? vaultBest.shared;
        best = {
          prepared: p,
          score: vaultScore,
          topicKey: vaultBest.shared,
          reason: {
            kind: "VAULT",
            text: `Shares “${heading}” with “${vaultBest.card.title}” in your vault.`,
            topics: [heading],
            vaultCard: { id: vaultBest.card.id, title: vaultBest.card.title },
          },
        };
      }
    }

    if (best) relevant.push(best);
    else rest.push(p);
  }

  // Pass 2: discovery among the cards that matched nothing.
  const adjacent: Scored[] = [];
  const explore: Scored[] = [];
  for (const p of rest) {
    const link = [...p.headings].find((h) => nearInterest.has(h));
    if (link) {
      const interest = nearInterest.get(link)!;
      const heading = p.display.get(link) ?? link;
      adjacent.push({
        prepared: p,
        score: 1,
        topicKey: link,
        reason: {
          kind: "ADJACENT",
          text: `Close to your interest in ${interest}: both touch on ${heading}.`,
          topics: [interest, heading],
        },
      });
      continue;
    }
    const heading = primaryHeading(p.candidate);
    explore.push({
      prepared: p,
      score: 0,
      topicKey: heading ? normalizeTopic(heading) : `card:${p.candidate.id}`,
      reason: heading
        ? { kind: "EXPLORE", text: `Explore something new: ${heading}.`, topics: [heading] }
        : { kind: "EXPLORE", text: "Explore something new from the Community Catalog.", topics: [] },
    });
  }

  const byScore = (a: Scored, b: Scored) =>
    b.score - a.score || tiebreak(a.prepared.candidate.id) - tiebreak(b.prepared.candidate.id);
  relevant.sort(byScore);
  adjacent.sort(byScore);
  explore.sort(byScore); // all score 0: a daily shuffle

  // Discovery slots: one by default, two with "Surprise me". With no interests and an empty
  // vault there is nothing to be relevant to, so every slot is discovery.
  const nothingToMatch = interests.length === 0 && vault.length === 0;
  const discoverySlots = nothingToMatch ? limit : Math.min(limit, profile.surpriseMe ? 2 : 1);

  const picked: Scored[] = [];
  const usedTopics = new Map<string, number>();
  const take = (pool: Scored[], count: number, maxPerTopic: number) => {
    for (const item of pool) {
      if (count <= 0 || picked.length >= limit) return;
      if (picked.includes(item)) continue;
      const used = usedTopics.get(item.topicKey) ?? 0;
      if (used >= maxPerTopic) continue;
      picked.push(item);
      usedTopics.set(item.topicKey, used + 1);
      count--;
    }
  };

  // Relevant picks, spread across topics first so one favourite topic doesn't fill the shelf.
  const relevantSlots = limit - discoverySlots;
  take(relevant, relevantSlots, 1);
  take(relevant, relevantSlots - picked.length, Number.POSITIVE_INFINITY);
  // Discovery: nearby cards first, then further afield, one per topic.
  const discovery = [...adjacent, ...explore];
  take(discovery, limit - picked.length, 1);
  // Not enough of either: fill with whatever is left, best first.
  take([...relevant, ...discovery], limit - picked.length, Number.POSITIVE_INFINITY);

  return picked.map((item) => ({ id: item.prepared.candidate.id, reason: item.reason }));
}
