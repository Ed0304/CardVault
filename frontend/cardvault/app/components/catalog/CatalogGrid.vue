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

  <CommonEmptyState
    v-else-if="isFirstRun"
    title="Your vault is empty"
    description="Save text or a public web page. Each card keeps that source beside a catalog entry describing it."
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

    <!-- A static picture of a card, labelled as an example. It is not a card in your vault. -->
    <details class="vault-empty__example">
      <summary class="vault-empty__summary">
        <CommonAppIcon name="arrow-right" :size="14" class="vault-empty__chevron" />
        See what a card holds
      </summary>
      <p class="vault-empty__example-label">
        <CommonAppBadge variant="outline">Example only</CommonAppBadge>
        Not a card in your vault
      </p>
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
    </details>
  </CommonEmptyState>

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

.vault-empty__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
}
/* The example sits under the actions, inside the empty state, so it needs no scrolling to find. */
.vault-empty__example {
  width: min(100%, 32rem);
  margin: var(--space-4) auto 0;
  text-align: left;
}
.vault-empty__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--control-height-sm);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-link);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
}
.vault-empty__summary::-webkit-details-marker {
  display: none;
}
.vault-empty__chevron {
  transition: transform var(--transition-fast);
}
.vault-empty__example[open] .vault-empty__chevron {
  transform: rotate(90deg);
}
.vault-empty__summary:hover {
  background: var(--bg-hover);
}
.vault-empty__summary:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}
.vault-empty__example-label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-muted);
}
.example-card {
  display: grid;
  margin: var(--space-2) 0 0;
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
</style>
