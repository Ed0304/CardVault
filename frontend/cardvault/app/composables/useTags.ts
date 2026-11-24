import { describeApiError } from '~/services/api'
import { tagService } from '~/services/tag.service'
import type { Tag } from '~/types/collection'

/**
 * The signed-in user's tags, shared across pages. Adding and removing tags on a card lives in
 * useCatalog (applyTag, removeTag), because it changes the card.
 */
export const useTags = () => {
  const tags = useState<Tag[]>('tags:list', () => [])
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

  const fetchTags = () =>
    run(async () => {
      tags.value = await tagService.list()
      return true
    }, "Your tags couldn't be loaded. Please try again.")

  const createTag = (name: string) =>
    run(async () => {
      const created = await tagService.create(name)
      tags.value = [...tags.value, created].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      )
      return created
    }, "The tag couldn't be created. Please try again.")

  const deleteTag = (id: string) =>
    run(
      async () => {
        await tagService.remove(id)
        tags.value = tags.value.filter((t) => t.id !== id)
        return true
      },
      "The tag couldn't be deleted. Please try again.",
      'This tag no longer exists.',
    )

  /** Finds a tag by name, ignoring case and surrounding spaces. */
  const findTagByName = (name: string) => {
    const wanted = name.trim().toLocaleLowerCase()
    return tags.value.find((t) => t.name.toLocaleLowerCase() === wanted)
  }

  return { tags, isLoading, error, fetchTags, createTag, deleteTag, findTagByName }
}
