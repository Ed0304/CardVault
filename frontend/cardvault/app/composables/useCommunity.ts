import { describeApiError, getApiErrorCode } from '~/services/api'
import { communityService } from '~/services/community.service'
import type { KnowledgeCard } from '~/types/card'
import type { PublicCard, PublicCardSummary } from '~/types/community'

export const COMMUNITY_PAGE_SIZE = 20

/** Browsing the Community Catalog and saving published cards into the user's vault. */
export const useCommunity = () => {
  const cards = ref<PublicCardSummary[]>([])
  const total = ref(0)
  const card = ref<PublicCard | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Saving has its own state, so the card stays on screen while it runs or if it fails.
  const isSaving = ref(false)
  const saveError = ref<string | null>(null)

  const fetchCards = async (options: { q?: string; page?: number } = {}) => {
    isLoading.value = true
    error.value = null
    try {
      const result = await communityService.list({
        q: options.q || undefined,
        page: options.page ?? 1,
        pageSize: COMMUNITY_PAGE_SIZE,
      })
      cards.value = result.items
      total.value = result.total
    } catch (e) {
      error.value = describeApiError(e, {
        fallback: "The Community Catalog couldn't be loaded. Please try again.",
      })
    } finally {
      isLoading.value = false
    }
  }

  const fetchCard = async (id: string) => {
    isLoading.value = true
    error.value = null
    try {
      card.value = await communityService.get(id)
    } catch (e) {
      card.value = null
      error.value = describeApiError(e, {
        notFound: "This card isn't in the Community Catalog. Its author may have made it private.",
        fallback: "This card couldn't be loaded. Please try again.",
      })
    } finally {
      isLoading.value = false
    }
  }

  /** Saves an independent copy. Returns the new card, or undefined if it was not saved. */
  const saveCard = async (id: string): Promise<KnowledgeCard | undefined> => {
    isSaving.value = true
    saveError.value = null
    try {
      const copy = await communityService.save(id)
      if (card.value?.id === id) {
        card.value = { ...card.value, viewer: { ...card.value.viewer, savedCardId: copy.id } }
      }
      return copy
    } catch (e) {
      if (getApiErrorCode(e) === 'CARD_ALREADY_SAVED') {
        // Saved earlier (perhaps in another tab): show the existing copy instead of an error.
        await fetchCard(id)
        return undefined
      }
      saveError.value = describeApiError(e, {
        notFound: 'This card is no longer in the Community Catalog, so it can\'t be saved.',
        fallback: "The card couldn't be saved to your vault. Please try again.",
      })
      return undefined
    } finally {
      isSaving.value = false
    }
  }

  return { cards, total, card, isLoading, error, isSaving, saveError, fetchCards, fetchCard, saveCard }
}
