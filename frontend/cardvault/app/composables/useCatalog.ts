import { catalogService } from '~/services/catalog.service'
import type { CardSummary, CreateCardPayload, KnowledgeCard } from '~/types/card'

export const useCatalog = () => {
  const cards = useState<CardSummary[]>('catalog:cards', () => [])
  const card = useState<KnowledgeCard | null>('catalog:card', () => null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const run = async <T>(action: () => Promise<T>): Promise<T | undefined> => {
    isLoading.value = true
    error.value = null
    try {
      return await action()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Something went wrong'
    } finally {
      isLoading.value = false
    }
  }

  const fetchCards = () =>
    run(async () => {
      cards.value = (await catalogService.list()).items
    })

  const fetchCard = (id: string) =>
    run(async () => {
      card.value = await catalogService.get(id)
    })

  const createCard = (payload: CreateCardPayload) => run(() => catalogService.create(payload))

  const createCardFromUrl = (url: string) => run(() => catalogService.createFromUrl(url))

  const deleteCard = (id: string) =>
    run(async () => {
      await catalogService.remove(id)
      cards.value = cards.value.filter((c) => c.id !== id)
    })

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
