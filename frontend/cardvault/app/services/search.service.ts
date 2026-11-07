import type { PaginatedResult, SearchMode, SearchResult } from '~/types/card'
import { apiFetch } from './api'

export type SearchResponse = PaginatedResult<SearchResult> & {
  mode: SearchMode
  fallback: boolean
}

export const searchService = {
  search: (q: string, mode: SearchMode = 'auto', page = 1) =>
    apiFetch<SearchResponse>('/search', { query: { q, mode, page } }),
}
