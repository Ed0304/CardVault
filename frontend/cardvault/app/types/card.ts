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

/** Fields shown in list views. */
export interface CardSummary {
  id: string
  sourceTitle: string | null
  sourceUrl: string | null
  aiSummary: string | null
  aiSubjects: string[]
  /** Summary, subjects and keywords. */
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
  /** Whether the public card includes the original text (meaningful while PUBLIC). */
  shareSourceText: boolean
  updatedAt: string
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
  aiSummary?: string
  aiSubjects?: string[]
  aiKeywords?: string[]
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
