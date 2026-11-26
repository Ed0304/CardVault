<script setup lang="ts">
import type { CardSummary } from '~/types/card'

const props = withDefaults(
  defineProps<{
    cards: CardSummary[]
    emptyTitle?: string
    emptyDescription?: string
    /** Show the "create a card" call to action in the empty state. */
    showCreateAction?: boolean
  }>(),
  {
    emptyTitle: undefined,
    emptyDescription: undefined,
    showCreateAction: true,
  },
)

/** The first-run vault (no search, no filter) gets the full explanation and example. */
const isFirstRun = computed(() => props.showCreateAction && !props.emptyTitle)
</script>

<template>
  <ul v-if="cards.length" class="catalog-grid">
    <li v-for="card in cards" :key="card.id">
      <CatalogKnowledgeCard :card="card" />
    </li>
  </ul>

  <div v-else-if="isFirstRun" class="vault-empty">
    <CommonEmptyState
      title="Your vault is empty"
      description="Save something worth keeping: paste text, or give the address of a public web page. Each card keeps that source and a catalog entry you can fill in with Muse's help."
      icon="catalog"
    >
      <div class="vault-empty__actions">
        <CommonAppButton to="/catalog/create">
          <CommonAppIcon name="plus" :size="18" />
          Add your first card
        </CommonAppButton>
        <CommonAppButton to="/community" variant="secondary">
          <CommonAppIcon name="globe" :size="18" />
          Browse the Community Catalog
        </CommonAppButton>
      </div>
    </CommonEmptyState>

    <!-- A static picture of a card, labelled as an example. It is not a card in your vault. -->
    <figure class="vault-empty__example" aria-labelledby="example-caption">
      <figcaption id="example-caption" class="vault-empty__example-label">
        <CommonAppBadge variant="outline">Example only</CommonAppBadge>
        What a card holds
      </figcaption>
      <dl class="example-card">
        <div class="example-card__part">
          <dt class="mono">Source</dt>
          <dd>The text or web page you saved, kept as it was.</dd>
        </div>
        <div class="example-card__part">
          <dt class="mono">Catalog entry</dt>
          <dd>A title, a short description, facts, subject headings, keywords and related concepts. Muse can draft it when you ask; you edit and save it.</dd>
        </div>
        <div class="example-card__part">
          <dt class="mono">Your notes, collection and tags</dt>
          <dd>Private to you, never shared or sent to Muse.</dd>
        </div>
      </dl>
    </figure>
  </div>

  <CommonEmptyState
    v-else
    :title="emptyTitle ?? 'No cards here'"
    :description="emptyDescription"
    icon="catalog"
  >
    <CommonAppButton v-if="showCreateAction" to="/catalog/create">
      <CommonAppIcon name="plus" :size="18" />
      Add a card
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

.vault-empty {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-5);
}
.vault-empty__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
}
.vault-empty__example {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.vault-empty__example-label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--text-secondary);
}
.example-card {
  display: grid;
  margin: 0;
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-subtle);
  border-top: 3px solid var(--color-antique-beige);
  border-radius: var(--radius-lg);
}
.example-card__part {
  padding: var(--space-3) var(--card-padding);
  border-bottom: var(--border-width) dashed var(--border-default);
}
.example-card__part:last-child {
  border-bottom: none;
}
.example-card__part dt {
  margin-bottom: var(--space-1);
}
.example-card__part dd {
  margin: 0;
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}
@media (min-width: 64rem) {
  .vault-empty {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
  }
}
</style>
