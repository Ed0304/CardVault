<script setup lang="ts">
const { cards, isLoading, error, fetchCards } = useCatalog()

// Keyword search over your own cards: titles, text, notes and saved catalog details. Semantic
// search is a future milestone, so the search-mode selector is not shown (D-10).
const query = ref('')
const activeQuery = ref('')

const onSearch = async (q: string) => {
  activeQuery.value = q.trim()
  await fetchCards({ q: activeQuery.value || undefined })
}

const clearSearch = () => {
  query.value = ''
  onSearch('')
}

onMounted(() => fetchCards())
</script>

<template>
  <section>
    <CommonPageHeading
      title="My Vault"
      description="Everything you've saved, cataloged and ready to rediscover. Private unless you publish a card."
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
        :empty-title="activeQuery ? 'No matching cards' : undefined"
        :empty-description="
          activeQuery
            ? 'Try different words. Search covers titles, text, notes, and saved summaries, subjects and keywords.'
            : undefined
        "
        :show-create-action="!activeQuery"
      />
    </div>
  </section>
</template>

<style scoped>
.catalog-page__summary {
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
