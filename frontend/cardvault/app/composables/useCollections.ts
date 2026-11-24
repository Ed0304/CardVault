import { describeApiError } from '~/services/api'
import { collectionService } from '~/services/collection.service'
import type { Collection } from '~/types/collection'

/** The signed-in user's collections, shared across pages. */
export const useCollections = () => {
  const collections = useState<Collection[]>('collections:list', () => [])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const run = async <T>(action: () => Promise<T>, fallback: string, notFound?: string) => {
    isLoading.value = true
    error.value = null
    try {
      return await action()
    } catch (e) {
      error.value = describeApiError(e, { fallback, notFound })
      return undefined
    } finally {
      isLoading.value = false
    }
  }

  const fetchCollections = () =>
    run(async () => {
      collections.value = await collectionService.list()
      return true
    }, "Your collections couldn't be loaded. Please try again.")

  const createCollection = (name: string) =>
    run(async () => {
      const created = await collectionService.create(name)
      collections.value = [...collections.value, created].sort(byName)
      return created
    }, "The collection couldn't be created. Please try again.")

  const renameCollection = (id: string, name: string) =>
    run(
      async () => {
        const renamed = await collectionService.rename(id, name)
        collections.value = collections.value.map((c) => (c.id === id ? renamed : c)).sort(byName)
        return renamed
      },
      "The collection couldn't be renamed. Please try again.",
      'This collection no longer exists.',
    )

  const deleteCollection = (id: string) =>
    run(
      async () => {
        await collectionService.remove(id)
        collections.value = collections.value.filter((c) => c.id !== id)
        return true
      },
      "The collection couldn't be deleted. Please try again.",
      'This collection no longer exists.',
    )

  return {
    collections,
    isLoading,
    error,
    fetchCollections,
    createCollection,
    renameCollection,
    deleteCollection,
  }
}

/** Same order as the API: alphabetical, ignoring case. */
const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
