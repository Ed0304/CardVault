<script setup lang="ts">
import type { KnowledgeCard } from '~/types/card'

/**
 * Shelve the card: one collection, any number of tags (REQ-CAT-008, REQ-CAT-009). Both are
 * private, never published or copied. Uses the existing card endpoints through useCatalog, so
 * the card page updates from the API's answer.
 */
const props = defineProps<{ card: KnowledgeCard }>()

// Its own useCatalog instance: errors here must not replace the whole card page.
const { setCollection, applyTag, removeTag, isLoading, error } = useCatalog()
const { collections, fetchCollections } = useCollections()
const { tags, fetchTags, createTag, findTagByName, error: tagError } = useTags()

onMounted(() => Promise.all([fetchCollections(), fetchTags()]))

const idBase = `organise-${useId()}`
const notice = ref<string | null>(null)

const collectionId = computed(() => props.card.collection?.id ?? '')
const onCollectionChange = async (event: Event) => {
  notice.value = null
  const select = event.target as HTMLSelectElement
  const updated = await setCollection(props.card.id, select.value || null)
  if (updated) notice.value = updated.collection ? `Filed in “${updated.collection.name}”.` : 'Removed from its collection.'
  // On failure, show the card's actual collection again.
  else select.value = collectionId.value
}

const newTag = ref('')
/** Tags the card doesn't have yet, offered as suggestions while typing. */
const suggestions = computed(() => tags.value.filter((t) => !props.card.tags.some((own) => own.id === t.id)))

const onAddTag = async () => {
  notice.value = null
  const name = newTag.value.trim()
  if (!name) return
  const tag = findTagByName(name) ?? (await createTag(name))
  if (!tag) return
  if (props.card.tags.some((t) => t.id === tag.id)) {
    newTag.value = ''
    return
  }
  if (await applyTag(props.card.id, tag.id)) {
    newTag.value = ''
    notice.value = `Tagged “${tag.name}”.`
  }
}

const onRemoveTag = async (tagId: string, name: string) => {
  notice.value = null
  if (await removeTag(props.card.id, tagId)) notice.value = `Tag “${name}” removed.`
}
</script>

<template>
  <section class="surface organise" aria-labelledby="organise-heading">
    <header class="organise__header">
      <span class="organise__icon"><CommonAppIcon name="folder" :size="18" /></span>
      <div>
        <p class="eyebrow">Yours · always private</p>
        <h2 id="organise-heading" class="organise__title">Collection and tags</h2>
      </div>
    </header>

    <p class="organise__hint">
      File the card on one shelf and label it with tags, to find it again with related cards in
      My Vault.
    </p>

    <div class="organise__field">
      <label :for="`${idBase}-collection`" class="organise__label">Collection</label>
      <select
        :id="`${idBase}-collection`"
        class="organise__select"
        :value="collectionId"
        :disabled="isLoading"
        @change="onCollectionChange"
      >
        <option value="">No collection</option>
        <option v-for="collection in collections" :key="collection.id" :value="collection.id">
          {{ collection.name }}
        </option>
      </select>
      <p v-if="collections.length === 0" class="organise__small">
        No collections yet. <NuxtLink to="/collections">Create one</NuxtLink>, then file cards here.
      </p>
    </div>

    <div class="organise__field">
      <span :id="`${idBase}-tags-label`" class="organise__label">Tags</span>
      <ul v-if="card.tags.length" class="organise__tags" :aria-labelledby="`${idBase}-tags-label`">
        <li v-for="tag in card.tags" :key="tag.id" class="organise__tag">
          <NuxtLink :to="`/catalog?tagId=${tag.id}`" class="organise__tag-link">{{ tag.name }}</NuxtLink>
          <button
            type="button"
            class="organise__tag-remove"
            :disabled="isLoading"
            @click="onRemoveTag(tag.id, tag.name)"
          >
            <CommonAppIcon name="close" :size="14" />
            <span class="visually-hidden">Remove tag {{ tag.name }}</span>
          </button>
        </li>
      </ul>
      <p v-else class="organise__small">No tags yet.</p>

      <form class="organise__add" @submit.prevent="onAddTag">
        <label :for="`${idBase}-new-tag`" class="visually-hidden">Add a tag</label>
        <input
          :id="`${idBase}-new-tag`"
          v-model="newTag"
          class="organise__input"
          maxlength="100"
          :list="`${idBase}-tag-options`"
          placeholder="Add a tag"
          autocomplete="off"
        />
        <datalist :id="`${idBase}-tag-options`">
          <option v-for="tag in suggestions" :key="tag.id" :value="tag.name" />
        </datalist>
        <CommonAppButton type="submit" variant="secondary" size="sm" :disabled="!newTag.trim() || isLoading">
          <CommonAppIcon name="plus" :size="16" />
          Add
        </CommonAppButton>
      </form>
      <p class="organise__small">Type an existing tag or a new one; new tags are created for you.</p>
    </div>

    <p class="visually-hidden" aria-live="polite">{{ notice }}</p>
    <CommonAppAlert v-if="error || tagError">{{ error || tagError }}</CommonAppAlert>
  </section>
</template>

<style scoped>
.organise {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.organise__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.organise__icon {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-md);
  background: var(--bg-sunken);
  border: var(--border-width) solid var(--border-subtle);
  color: var(--color-archive-brown);
}
.organise__title {
  font-size: var(--text-xl);
}
.organise__hint,
.organise__small {
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}
.organise__small {
  font-size: var(--text-xs);
  color: var(--text-muted);
}
.organise__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.organise__label {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}
.organise__select,
.organise__input {
  width: 100%;
  min-height: var(--control-height);
  padding: 0 var(--space-3);
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-control);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-base);
}
.organise__select:focus-visible,
.organise__input:focus-visible {
  outline: none;
  border-color: var(--focus-color);
  box-shadow: var(--focus-ring);
}
.organise__add {
  display: flex;
  gap: var(--space-2);
}
.organise__add .organise__input {
  flex: 1;
  min-width: 0;
}
.organise__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  list-style: none;
}
.organise__tag {
  display: inline-flex;
  align-items: center;
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-default);
  border-radius: var(--radius-pill);
}
.organise__tag-link {
  padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
  color: var(--text-primary);
  font-size: var(--text-sm);
  text-decoration: none;
}
.organise__tag-link:hover {
  text-decoration: underline;
}
.organise__tag-remove {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
}
.organise__tag-remove:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--error-text);
}
.organise__tag-remove:focus-visible,
.organise__tag-link:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}
</style>
