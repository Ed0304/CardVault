<script setup lang="ts">
import type { SearchMode } from '~/types/card'

const { cards, isLoading, error, fetchCards } = useCatalog()
const {
  results,
  isFallback,
  isLoading: isSearching,
  error: searchError,
  search,
} = useSearch()

const query = ref('')
const hasSearched = ref(false)

const visibleCards = computed(() => (hasSearched.value ? results.value : cards.value))
const loading = computed(() => isLoading.value || isSearching.value)
const errorMessage = computed(() => error.value ?? searchError.value)

const onSearch = async (q: string, mode: SearchMode) => {
  hasSearched.value = q.trim().length > 0
  await search(q, mode)
}

onMounted(fetchCards)
</script>

<template>
  <section>
    <CommonPageHeading
      title="Catalog"
      description="Everything you've saved, cataloged and ready to rediscover."
    >
      <template #actions>
        <CommonAppButton to="/catalog/create">
          <CommonAppIcon name="plus" :size="18" />
          New card
        </CommonAppButton>
      </template>
    </CommonPageHeading>

    <div class="stack catalog-page" style="--stack-gap: var(--space-5)">
      <CatalogSearch v-model="query" @search="onSearch" />

      <CommonAppAlert v-if="isFallback" variant="info">
        No semantic results found. Showing keyword matches.
      </CommonAppAlert>

      <CommonLoadingState v-if="loading" variant="cards" label="Loading your catalog…" />
      <CommonAppAlert v-else-if="errorMessage" title="Something went wrong">
        {{ errorMessage }}
      </CommonAppAlert>
      <CatalogGrid
        v-else
        :cards="visibleCards"
        :empty-title="hasSearched ? 'No matching cards' : undefined"
        :empty-description="
          hasSearched ? 'Try different words, or switch the search mode.' : undefined
        "
        :show-create-action="!hasSearched"
      />
    </div>
  </section>
</template>
