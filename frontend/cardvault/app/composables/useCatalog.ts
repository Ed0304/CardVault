import { describeApiError, getApiStatus, type ApiErrorMessages } from '~/services/api'
import { catalogService } from '~/services/catalog.service'
import type { CardSummary, CreateCardPayload, KnowledgeCard } from '~/types/card'

export const useCatalog = () => {
  const cards = useState<CardSummary[]>('catalog:cards', () => [])
  const card = useState<KnowledgeCard | null>('catalog:card', () => null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const run = async <T>(action: () => Promise<T>, messages: ApiErrorMessages): Promise<T | undefined> => {
    isLoading.value = true
    error.value = null
    try {
      return await action()
    } catch (e) {
      error.value = describeApiError(e, messages)
    } finally {
      isLoading.value = false
    }
  }

  const fetchCards = () =>
    run(
      async () => {
        try {
          cards.value = (await catalogService.list()).items
        } catch (e) {
          // An empty library is a normal state, not an error: the list endpoint answers 200 with
          // no items (REQ-CAT-003). Until the catalog API is deployed the endpoint does not exist
          // and answers 404, which for the user means the same thing: there are no cards yet.
          if (getApiStatus(e) === 404) {
            cards.value = []
            return
          }
          throw e
        }
      },
      { fallback: "Your catalog couldn't be loaded. Please try again." },
    )

  const fetchCard = (id: string) =>
    run(
      async () => {
        card.value = await catalogService.get(id)
      },
      {
        notFound: "This card doesn't exist, or it isn't in your library.",
        fallback: "This card couldn't be loaded. Please try again.",
      },
    )

  const createCard = (payload: CreateCardPayload) =>
    run(() => catalogService.create(payload), {
      notFound: "Saving cards isn't available yet.",
      fallback: "The card couldn't be saved. Check the content and try again.",
    })

  const createCardFromUrl = (url: string) =>
    run(() => catalogService.createFromUrl(url), {
      notFound: "Saving cards from a URL isn't available yet.",
      fallback: "The page couldn't be saved. Check the URL and try again.",
    })

  const deleteCard = (id: string) =>
    run(
      async () => {
        await catalogService.remove(id)
        cards.value = cards.value.filter((c) => c.id !== id)
      },
      {
        notFound: 'This card no longer exists.',
        fallback: "The card couldn't be deleted. Please try again.",
      },
    )

  return {
    cards,
    card,
    isLoading,
    error,
    fetchCards,
    fetchCard,
    createCard,
    createCardFromUrl,
    deleteCard,
  }
}
