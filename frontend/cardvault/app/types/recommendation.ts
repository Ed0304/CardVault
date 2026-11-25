import type { PublicCardSummary } from './community'

/**
 * Why a card was recommended. INTEREST: matches a chosen topic. BRIDGE: joins two of them.
 * VAULT: shares headings with a card in the user's vault. ADJACENT: next to a chosen topic.
 * EXPLORE: a topic the user hasn't chosen.
 */
export type RecommendationReasonKind = 'INTEREST' | 'BRIDGE' | 'VAULT' | 'ADJACENT' | 'EXPLORE'

export interface RecommendationReason {
  kind: RecommendationReasonKind
  text: string
  topics: string[]
  /** For VAULT: the user's own card this one relates to. */
  vaultCard?: { id: string; title: string }
}

export interface Recommendation {
  card: PublicCardSummary
  reason: RecommendationReason
}

export interface RecommendationShelf {
  date: string
  items: Recommendation[]
  eligibleCount: number
}
