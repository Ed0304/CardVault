import type { Collection, Tag } from './collection'

export type AiStatus = 'PENDING' | 'COMPLETE' | 'FAILED'

/** Fields shown in list views. */
export interface CardSummary {
  id: string
  sourceTitle: string | null
  sourceUrl: string | null
  aiSummary: string | null
  aiSubjects: string[]
  aiStatus: AiStatus
  collection: Collection | null
  tags: Tag[]
  createdAt: string
}

/** Full card: original source, personal notes, and AI catalog layers. */
export interface KnowledgeCard extends CardSummary {
  sourceText: string
  sourceMeta: Record<string, unknown> | null
  notes: string | null
  aiKeywords: string[]
  updatedAt: string
}

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
