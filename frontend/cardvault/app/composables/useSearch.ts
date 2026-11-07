import { searchService } from '~/services/search.service'
import type { SearchMode, SearchResult } from '~/types/card'

export const useSearch = () => {
  const results = ref<SearchResult[]>([])
  const isLoading = ref(false)
  const isFallback = ref(false)
  const error = ref<string | null>(null)

  const search = async (query: string, mode: SearchMode = 'auto') => {
    if (!query.trim()) {
      results.value = []
      isFallback.value = false
      return
    }

    isLoading.value = true
    error.value = null
    try {
      const response = await searchService.search(query, mode)
      results.value = response.items
      isFallback.value = response.fallback
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Search failed'
    } finally {
      isLoading.value = false
    }
  }

  return { results, isLoading, isFallback, error, search }
}
