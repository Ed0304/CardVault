import type { Collection, Tag } from './collection'

/**
 * Status of one AI operation. NOT_AVAILABLE means the operation is not implemented or not
 * enabled, so it was not attempted. It is not a failure.
 */
export type AiStatus = 'PENDING' | 'COMPLETE' | 'FAILED' | 'NOT_AVAILABLE'

/** PRIVATE: only the owner sees the card. PUBLIC: listed in the Community Catalog. */
export type CardVisibility = 'PRIVATE' | 'PUBLIC'

/** Attribution on a card saved from the Community Catalog. */
export interface SavedFrom {
  /** The original card's id, kept even after the original is deleted. */
  cardId: string
  /** The original author's username when the card was saved. */
  authorUsername: string
  /** Whether the original is still published (and can be linked to). */
  originalAvailable: boolean
}

/** A factual attribute of the card's subject, e.g. { label: 'Author', value: 'Jane Doe' }. */
export interface CatalogFact {
  label: string
  value: string
}

/** A concept the source connects to the subject, e.g. { name: 'X', relation: 'Successor' }. */
export interface RelatedConcept {
  name: string
  relation: string
}

/** A related concept as shown, linked when a card with that title exists. */
export interface RelatedConceptLink extends RelatedConcept {
  cardId: string | null
}

/** Fields shown in list views. */
export interface CardSummary {
  id: string
  /** The catalog entry's own heading; null means "use the source title". */
  catalogTitle: string | null
  sourceTitle: string | null
  sourceUrl: string | null
  aiSummary: string | null
  aiSubjects: string[]
  /** The catalog entry (title, description, facts, headings, keywords, related concepts). */
  aiCatalogStatus: AiStatus
  /** Vector embedding (future Semantic Retrieval milestone; NOT_AVAILABLE in the MVP). */
  aiEmbeddingStatus: AiStatus
  collection: Collection | null
  tags: Tag[]
  visibility: CardVisibility
  publishedAt: string | null
  /** Set when the card is a copy saved from the Community Catalog. */
  savedFrom: SavedFrom | null
  createdAt: string
}

/** Full card: original source, personal notes, and AI catalog layers. */
export interface KnowledgeCard extends CardSummary {
  sourceText: string
  sourceMeta: Record<string, unknown> | null
  notes: string | null
  aiKeywords: string[]
  aiFacts: CatalogFact[]
  aiRelated: RelatedConceptLink[]
  /** Whether the public card includes the original text (meaningful while PUBLIC). */
  shareSourceText: boolean
  /** Muse's suggestions awaiting review. Private; nothing changes until the owner saves them. */
  aiCatalogDraft: CatalogDraft | null
  updatedAt: string
}

/** AI-generated catalog suggestions for one card. */
export interface CatalogDraft {
  catalogTitle: string | null
  summary: string
  facts: CatalogFact[]
  subjects: string[]
  keywords: string[]
  related: RelatedConcept[]
  /** The Muse model that wrote them, e.g. "muse-ember-1.0". */
  model: string
  /** True when only the first part of a long source text was cataloged. */
  truncated: boolean
  generatedAt: string
}

/** Publishing always states whether the original text is shared; unpublishing needs nothing. */
export type SetVisibilityPayload =
  | { visibility: 'PUBLIC'; shareSourceText: boolean }
  | { visibility: 'PRIVATE' }

export interface CreateCardPayload {
  sourceText: string
  sourceUrl?: string
  sourceTitle?: string
}

export interface UpdateAiMetadataPayload {
  /** Empty or null goes back to showing the source title. */
  catalogTitle?: string | null
  aiSummary?: string | null
  aiFacts?: CatalogFact[]
  aiSubjects?: string[]
  aiKeywords?: string[]
  aiRelated?: RelatedConcept[]
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type SearchMode = 'semantic' | 'keyword' | 'auto'

export interface SearchResult extends CardSummary {
  similarityScore?: number
}
