<script setup lang="ts">
import type { CardSummary } from '~/types/card'

withDefaults(
  defineProps<{
    cards: CardSummary[]
    emptyTitle?: string
    emptyDescription?: string
    /** Show the "create a card" call to action in the empty state. */
    showCreateAction?: boolean
  }>(),
  {
    emptyTitle: 'No cards yet',
    emptyDescription: 'Save your first piece of knowledge and it will be cataloged here.',
    showCreateAction: true,
  },
)
</script>

<template>
  <ul v-if="cards.length" class="catalog-grid">
    <li v-for="card in cards" :key="card.id">
      <CatalogKnowledgeCard :card="card" />
    </li>
  </ul>

  <CommonEmptyState v-else :title="emptyTitle" :description="emptyDescription" icon="catalog">
    <CommonAppButton v-if="showCreateAction" to="/catalog/create">
      <CommonAppIcon name="plus" :size="18" />
      Create your first card
    </CommonAppButton>
  </CommonEmptyState>
</template>

<style scoped>
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
  gap: var(--space-4);
  list-style: none;
}
@media (min-width: 48rem) {
  .catalog-grid {
    gap: var(--space-5);
  }
}
</style>
