import type { RecommendationPriority } from "../schemas/preferences.schemas.js";
import { normalizeTopic, significantWords, termsForInterest } from "./topicCatalog.js";

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
 * - VAULT     the card and a card in the user's own vault name each other as related concepts,
 *             or share specific subject headings or keywords.
 * - ADJACENT  the card matches none of the user's topics but shares a specific heading with a
 *             card that does, e.g. folklore next to Pokémon. Discovery near the user's interests.
 * - EXPLORE   a card from a subject the user has not chosen. Discovery further away.
 *
 * Heading links are weighted by how specific the heading is among the candidates, so broad
 * headings that most cards carry do not create links on their own.
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
  /** Names of the card's related concepts, as the owner saved them. */
  related?: string[];
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

/**
 * Heading links are weighted by specificity: a heading on almost every card ("Science") says
 * little about two cards being related; one on few cards ("Typography") says a lot.
 * specificity = ln(1 + N/df) / ln(1 + N), where N is the number of candidates and df the number
 * of candidates with the heading: 1 for a heading on one card, falling towards 0 as df nears N.
 */
const VAULT_MIN_SCORE = 1.5;
/** A "Nearby topic" link needs a heading on at most about a tenth of the candidates. */
const ADJACENT_MIN_SPECIFICITY = 0.5;
/** A related concept saved on a vault card that names this card, or the reverse. */
const RELATED_LINK_SCORE = 4;
const VAULT_SCORE_CAP = 6;

const PRIORITY_WEIGHTS: Record<RecommendationPriority, { interest: number; vault: number }> = {
  BALANCED: { interest: 1, vault: 1 },
  INTERESTS: { interest: 1.5, vault: 0.5 },
  VAULT: { interest: 0.6, vault: 1.5 },
};

/**
 * A plural "s"/"es" is accepted only after a last word of at least this many letters. For
 * shorter words the suffix usually makes a different word or a fixed expression rather than a
 * plural ("art" → "Martial arts", "war" → "Star Wars", "new" → "News"), so they match exactly.
 */
export const MIN_PLURAL_STEM_LENGTH = 4;

/** Whole-word match on normalized text, allowing a plural "s"/"es" on a long enough last word. */
function containsTerm(text: string, term: string): boolean {
  if (!text || !term) return false;
  const padded = ` ${text} `;
  if (padded.includes(` ${term} `)) return true;
  const lastWord = term.slice(term.lastIndexOf(" ") + 1);
  if (lastWord.length < MIN_PLURAL_STEM_LENGTH) return false;
  return padded.includes(` ${term}s `) || padded.includes(` ${term}es `);
}

/**
 * Every word appears in the text as a whole word (plural "s"/"es" allowed), in any order:
 * "history of the internet" contains ["internet", "history"]. Requiring all the significant
 * words keeps a single shared word, such as "history", from matching on its own.
 */
function containsAllWords(text: string, words: string[]): boolean {
  return words.length > 0 && words.every((word) => containsTerm(text, word));
}

/** An interest term, with the words that match it in any order (empty for one-word terms). */
interface MatchTerm {
  phrase: string;
  words: string[];
}

/**
 * Fields short enough for an any-order match to mean the same topic. In a description, the
 * words could belong to different sentences, so descriptions need the exact phrase.
 */
const ANY_ORDER_FIELDS: ReadonlySet<Field> = new Set(["subjects", "keywords", "title", "related"]);

function matchesTerm(text: string, term: MatchTerm, field: Field): boolean {
  if (containsTerm(text, term.phrase)) return true;
  return ANY_ORDER_FIELDS.has(field) && containsAllWords(text, term.words);
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
function matchWeight(prepared: Prepared, terms: MatchTerm[]): number {
  let best = 0;
  for (const field of Object.keys(FIELD_WEIGHTS) as Field[]) {
    const weight = FIELD_WEIGHTS[field];
    if (weight <= best) continue;
    if (prepared.fields[field].some((text) => terms.some((term) => matchesTerm(text, term, field)))) best = weight;
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
  const interests = profile.interests.map((label) => ({
    label,
    terms: termsForInterest(label).map((phrase) => ({ phrase, words: significantWords(phrase) })),
  }));
  const interestKeys = new Set(interests.flatMap((i) => i.terms.map((t) => t.phrase)));
  const vault = profile.vault.map((card) => ({
    card,
    title: normalizeTopic(card.title),
    subjects: new Set(card.subjects.map(normalizeTopic).filter(Boolean)),
    keywords: new Set(card.keywords.map(normalizeTopic).filter(Boolean)),
    related: new Set((card.related ?? []).map(normalizeTopic).filter(Boolean)),
  }));
  const tiebreak = (id: string) => hash(`${options.seed}:${id}`);
  const prepared = candidates.map(prepare);

  const documentFrequency = new Map<string, number>();
  for (const p of prepared) {
    for (const heading of p.headings) documentFrequency.set(heading, (documentFrequency.get(heading) ?? 0) + 1);
  }
  const n = prepared.length;
  const specificity = (heading: string) =>
    Math.log(1 + n / Math.max(1, documentFrequency.get(heading) ?? 1)) / Math.log(1 + n);

  // Pass 1: interest, bridge and vault signals.
  const relevant: Scored[] = [];
  const rest: Prepared[] = [];
  // Specific headings of interest-matched cards, so neighbouring cards can be found in pass 2.
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
        if (interestKeys.has(heading) || nearInterest.has(heading)) continue;
        if (specificity(heading) >= ADJACENT_MIN_SPECIFICITY) nearInterest.set(heading, m.interest.label);
      }
    }

    // Vault: an explicit related-concept link between this card and a vault card is the strongest
    // signal. Shared headings add 2 × specificity per subject and 1 × specificity per keyword;
    // without a related link they must reach VAULT_MIN_SCORE to count.
    const candidateTitle = p.fields.title[0] ?? "";
    let vaultBest: {
      score: number;
      card: RankingVaultCard;
      related: "VAULT_LISTS_CARD" | "CARD_LISTS_VAULT" | null;
      shared: string | null;
    } | null = null;
    for (const v of vault) {
      const related =
        candidateTitle && v.related.has(candidateTitle)
          ? "VAULT_LISTS_CARD"
          : v.title && p.fields.related.includes(v.title)
            ? "CARD_LISTS_VAULT"
            : null;
      let headingScore = 0;
      let shared: string | null = null;
      let sharedWeight = 0;
      const add = (heading: string, base: number) => {
        const weight = base * specificity(heading);
        headingScore += weight;
        if (weight > sharedWeight) {
          sharedWeight = weight;
          shared = heading;
        }
      };
      for (const s of p.fields.subjects) if (s && v.subjects.has(s)) add(s, 2);
      for (const k of p.fields.keywords) if (k && (v.keywords.has(k) || v.subjects.has(k))) add(k, 1);
      if (!related && headingScore < VAULT_MIN_SCORE) continue;
      const score = Math.min((related ? RELATED_LINK_SCORE : 0) + headingScore, VAULT_SCORE_CAP);
      if (!vaultBest || score > vaultBest.score) vaultBest = { score, card: v.card, related, shared };
    }
    if (vaultBest) {
      const vaultScore = vaultBest.score * weights.vault;
      if (!best || vaultScore > best.score) {
        const { card, related, shared } = vaultBest;
        const vaultCard = { id: card.id, title: card.title };
        let reason: RecommendationReason;
        if (related === "VAULT_LISTS_CARD") {
          reason = { kind: "VAULT", text: `“${card.title}” in your vault lists this as a related concept.`, topics: [], vaultCard };
        } else if (related === "CARD_LISTS_VAULT") {
          reason = { kind: "VAULT", text: `Lists “${card.title}”, a card in your vault, as a related concept.`, topics: [], vaultCard };
        } else {
          const heading = p.display.get(shared!) ?? shared!;
          reason = { kind: "VAULT", text: `Shares “${heading}” with “${card.title}” in your vault.`, topics: [heading], vaultCard };
        }
        best = {
          prepared: p,
          score: vaultScore,
          // Related links spread by vault card; heading links by the shared heading.
          topicKey: related ? `vault:${card.id}` : shared!,
          reason,
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
    // The most specific heading shared with an interest-matched card.
    const link = [...p.headings]
      .filter((h) => nearInterest.has(h))
      .sort((a, b) => specificity(b) - specificity(a) || a.localeCompare(b))[0];
    if (link) {
      const interest = nearInterest.get(link)!;
      const heading = p.display.get(link) ?? link;
      adjacent.push({
        prepared: p,
        score: specificity(link),
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
        // The card's label already says "Something new", so the reason names the topic instead.
        ? { kind: "EXPLORE", text: `Outside the topics you follow: ${heading}.`, topics: [heading] }
        : { kind: "EXPLORE", text: "Outside the topics you follow.", topics: [] },
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
