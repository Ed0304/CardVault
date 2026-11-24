/**
 * A published card as the Community Catalog shows it. It carries only public fields: never
 * notes, collections, tags or account details other than the author's username.
 */
export interface PublicCardSummary {
  id: string
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
  /** The original text, or null when the author did not share it. */
  sourceText: string | null
  viewer: {
    isOwner: boolean
    /** The viewer's own saved copy of this card, if any. */
    savedCardId: string | null
  }
}
