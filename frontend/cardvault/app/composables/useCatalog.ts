import { describeApiError, getApiErrorCode, type ApiErrorMessages } from '~/services/api'
import { catalogService } from '~/services/catalog.service'
import type {
  CardSummary,
  CreateCardPayload,
  KnowledgeCard,
  SetVisibilityPayload,
  UpdateAiMetadataPayload,
} from '~/types/card'

export interface CardFilters {
  /** Keyword search over the user's own cards. */
  q?: string
  collectionId?: string
  tagId?: string
}

export const useCatalog = () => {
  const cards = useState<CardSummary[]>('catalog:cards', () => [])
  const card = useState<KnowledgeCard | null>('catalog:card', () => null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** The API's error code for the last failure, e.g. "SITE_BLOCKED". */
  const errorCode = ref<string | null>(null)

  const run = async <T>(action: () => Promise<T>, messages: ApiErrorMessages): Promise<T | undefined> => {
    isLoading.value = true
    error.value = null
    errorCode.value = null
    try {
      return await action()
    } catch (e) {
      error.value = describeApiError(e, messages)
      errorCode.value = getApiErrorCode(e) ?? null
    } finally {
      isLoading.value = false
    }
  }

  // An empty library is a normal state: the list endpoint answers 200 with no items
  // (REQ-CAT-003), and the page shows the "add your first card" prompt.
  const fetchCards = (filters: CardFilters = {}) =>
    run(
      async () => {
        cards.value = (await catalogService.list(filters)).items
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
        return true
      },
      {
        notFound: 'This card no longer exists.',
        fallback: "The card couldn't be deleted. Please try again.",
      },
    )

  /** Applies an organisation change to the open card from the updated card the API returns. */
  const organise = (action: () => Promise<KnowledgeCard>, fallback: string, notFound: string) =>
    run(
      async () => {
        const updated = await action()
        card.value = updated
        cards.value = cards.value.map((c) => (c.id === updated.id ? updated : c))
        return updated
      },
      { fallback, notFound },
    )

  const setCollection = (id: string, collectionId: string | null) =>
    organise(
      () => catalogService.setCollection(id, collectionId),
      "The collection couldn't be changed. Please try again.",
      'That card or collection no longer exists. Reload the page and try again.',
    )

  /** Publishes the card to the Community Catalog, or makes it private again. */
  const setVisibility = (id: string, payload: SetVisibilityPayload) =>
    organise(
      () => catalogService.setVisibility(id, payload),
      payload.visibility === 'PUBLIC'
        ? "The card couldn't be published. Please try again."
        : "The card couldn't be made private. Please try again.",
      'This card no longer exists. Reload the page and try again.',
    )

  /** Saves the personal notes. An empty or whitespace-only value clears them. */
  const updateNotes = (id: string, notes: string) =>
    organise(
      () => catalogService.updateNotes(id, notes),
      "Your notes couldn't be saved. Please try again.",
      'This card no longer exists. Reload the page and try again.',
    )

  /** Saves the catalog details (and resolves any pending AI suggestion). */
  const updateAiMetadata = (id: string, payload: UpdateAiMetadataPayload) =>
    organise(
      () => catalogService.updateAiMetadata(id, payload),
      "The catalog details couldn't be saved. Please try again.",
      'This card no longer exists. Reload the page and try again.',
    )

  /** Asks Muse for suggestions. On failure the card is reloaded to show its status. */
  const requestCatalog = async (id: string) => {
    const updated = await organise(
      () => catalogService.requestCatalog(id),
      "Muse couldn't catalog this card. Please try again.",
      'This card no longer exists. Reload the page and try again.',
    )
    if (!updated) {
      const failedError = error.value
      await catalogService.get(id).then((fresh) => (card.value = fresh)).catch(() => undefined)
      error.value = failedError
    }
    return updated
  }

  const discardCatalogDraft = (id: string) =>
    organise(
      () => catalogService.discardCatalogDraft(id),
      "The suggestions couldn't be discarded. Please try again.",
      'This card no longer exists. Reload the page and try again.',
    )

  const applyTag = (id: string, tagId: string) =>
    organise(
      () => catalogService.addTag(id, tagId),
      "The tag couldn't be added. Please try again.",
      'That card or tag no longer exists. Reload the page and try again.',
    )

  const removeTag = (id: string, tagId: string) =>
    organise(
      () => catalogService.removeTag(id, tagId),
      "The tag couldn't be removed. Please try again.",
      'That card or tag no longer exists. Reload the page and try again.',
    )

  return {
    cards,
    card,
    isLoading,
    error,
    errorCode,
    fetchCards,
    fetchCard,
    createCard,
    createCardFromUrl,
    deleteCard,
    setCollection,
    setVisibility,
    updateNotes,
    updateAiMetadata,
    requestCatalog,
    discardCatalogDraft,
    applyTag,
    removeTag,
  }
}
