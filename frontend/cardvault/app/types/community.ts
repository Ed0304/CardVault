import type { CatalogFact, RelatedConceptLink } from './card'

/**
 * A published card as the Community Catalog shows it. It carries only public fields: never
 * notes, collections, tags or account details other than the author's username.
 */
export interface PublicCardSummary {
  id: string
  catalogTitle: string | null
  sourceTitle: string | null
  sourceUrl: string | null
  aiSummary: string | null
  aiSubjects: string[]
  aiKeywords: string[]
  /** True when the author shared the original text. */
  hasSourceText: boolean
  author: { username: string }
  publishedAt: string
}

export interface PublicCard extends PublicCardSummary {
  aiFacts: CatalogFact[]
  /** Linked only to other published cards. */
  aiRelated: RelatedConceptLink[]
  /** The original text, or null when the author did not share it. */
  sourceText: string | null
  /** What the signed-in viewer can do with the card; null for a guest. */
  viewer: {
    isOwner: boolean
    /** The viewer's own saved copy of this card, if any. */
    savedCardId: string | null
  } | null
}
