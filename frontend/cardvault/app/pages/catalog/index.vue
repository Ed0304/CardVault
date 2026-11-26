<script setup lang="ts">
const route = useRoute()
const { cards, isLoading, error, fetchCards } = useCatalog()
const { collections, fetchCollections } = useCollections()
const { tags, fetchTags } = useTags()

// Keyword search over your own cards: titles, text, notes and saved catalog details. Semantic
// search is a future milestone, so the search-mode selector is not shown (D-10).
const query = ref('')
const activeQuery = ref('')

// A collection or tag chosen on the Collections page or a card's page arrives in the URL.
const firstOf = (value: unknown) => (Array.isArray(value) ? value[0] : value)
const collectionId = computed(() => (firstOf(route.query.collectionId) as string | undefined) || undefined)
const tagId = computed(() => (firstOf(route.query.tagId) as string | undefined) || undefined)
const isFiltered = computed(() => Boolean(collectionId.value || tagId.value))

/** "the collection “Reading list”", for the filter summary, once the names have loaded. */
const filterLabel = computed(() => {
  if (collectionId.value) {
    const name = collections.value.find((c) => c.id === collectionId.value)?.name
    return name ? `the collection “${name}”` : 'this collection'
  }
  const name = tags.value.find((t) => t.id === tagId.value)?.name
  return name ? `the tag “${name}”` : 'this tag'
})

const load = () =>
  fetchCards({ q: activeQuery.value || undefined, collectionId: collectionId.value, tagId: tagId.value })

const onSearch = async (q: string) => {
  activeQuery.value = q.trim()
  await load()
}

const clearSearch = () => {
  query.value = ''
  onSearch('')
}

onMounted(() => {
  load()
  if (isFiltered.value) Promise.all([fetchCollections(), fetchTags()])
})
watch([collectionId, tagId], () => {
  load()
  if (isFiltered.value) Promise.all([fetchCollections(), fetchTags()])
})

const emptyTitle = computed(() => {
  if (activeQuery.value) return 'No matching cards'
  if (isFiltered.value) return 'Nothing filed here yet'
  return undefined
})
const emptyDescription = computed(() => {
  if (activeQuery.value) return 'Try different words. Search covers titles, text, notes, and saved summaries, subjects and keywords.'
  if (isFiltered.value) return "Open a card and use “Collection and tags” on its page to file it here."
  return undefined
})
</script>

<template>
  <section>
    <CommonPageHeading
      title="My Vault"
      description="Your private catalog: each card keeps the source you saved and a catalog entry that describes it. Only you can see your cards unless you publish one."
    >
      <template #actions>
        <CommonAppButton to="/catalog/create">
          <CommonAppIcon name="plus" :size="18" />
          New card
        </CommonAppButton>
      </template>
    </CommonPageHeading>

    <div class="stack catalog-page" style="--stack-gap: var(--space-5)">
      <CatalogSearch v-model="query" :show-modes="false" @search="onSearch" />

      <p v-if="isFiltered" class="catalog-page__summary">
        <CommonAppIcon :name="collectionId ? 'folder' : 'catalog'" :size="14" />
        Showing cards in {{ filterLabel }}.
        <NuxtLink to="/catalog">Show all cards</NuxtLink>
      </p>

      <p v-if="activeQuery && !isLoading && !error" class="catalog-page__summary">
        Showing cards matching <strong>“{{ activeQuery }}”</strong>.
        <button type="button" class="catalog-page__clear" @click="clearSearch">Clear search</button>
      </p>

      <CommonLoadingState v-if="isLoading" variant="cards" label="Loading your catalog…" />
      <CommonAppAlert v-else-if="error" title="Your catalog didn't load">
        {{ error }}
      </CommonAppAlert>
      <CatalogGrid
        v-else
        :cards="cards"
        :empty-title="emptyTitle"
        :empty-description="emptyDescription"
        :show-create-action="!activeQuery && !isFiltered"
      />
    </div>
  </section>
</template>

<style scoped>
.catalog-page__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1) var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.catalog-page__clear {
  padding: 0;
  background: none;
  border: none;
  color: var(--text-link);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
</style>
