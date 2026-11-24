import type { KnowledgeCard, PaginatedResult } from '~/types/card'
import type { PublicCard, PublicCardSummary } from '~/types/community'
import { apiFetch } from './api'

export const communityService = {
  list: (query: { q?: string; page?: number; pageSize?: number } = {}) =>
    apiFetch<PaginatedResult<PublicCardSummary>>('/community/cards', { query }),

  get: (id: string) => apiFetch<PublicCard>(`/community/cards/${id}`),

  /** Saves an independent, private copy into the signed-in user's vault. */
  save: (id: string) => apiFetch<KnowledgeCard>(`/community/cards/${id}/save`, { method: 'POST' }),
}
