<script setup lang="ts">
import type { Collection } from '~/types/collection'

const props = defineProps<{
  collection: Collection
  /** When set, the name links here (for example the catalog filtered by this collection). */
  to?: string
}>()

const countLabel = computed(() => {
  const count = props.collection.cardCount
  if (count === undefined) return null
  return count === 1 ? '1 card' : `${count} cards`
})
</script>

<template>
  <article class="collection-card">
    <span class="collection-card__icon"><CommonAppIcon name="folder" :size="22" /></span>
    <div class="collection-card__text">
      <h2 class="collection-card__name">
        <NuxtLink v-if="to" :to="to" class="collection-card__link">{{ collection.name }}</NuxtLink>
        <template v-else>{{ collection.name }}</template>
      </h2>
      <p class="mono">
        <span v-if="countLabel">{{ countLabel }}</span>
        <template v-if="countLabel && collection.createdAt"> · </template>
        <template v-if="collection.createdAt">
          Created <time :datetime="collection.createdAt">{{ formatDate(collection.createdAt) }}</time>
        </template>
      </p>
      <div v-if="$slots.default" class="collection-card__extra"><slot /></div>
    </div>
    <div v-if="$slots.actions" class="collection-card__actions"><slot name="actions" /></div>
  </article>
</template>

<style scoped>
.collection-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
  padding: var(--card-padding);
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition:
    box-shadow var(--transition-base),
    border-color var(--transition-base);
}
.collection-card:hover {
  border-color: var(--border-default);
  box-shadow: var(--shadow-md);
}
.collection-card__icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-md);
  background: var(--bg-sunken);
  color: var(--color-archive-brown);
}
.collection-card__text {
  display: flex;
  flex: 1 1 12rem;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}
.collection-card__name {
  font-size: var(--text-xl);
  overflow-wrap: anywhere;
}
.collection-card__link {
  color: inherit;
  text-decoration: none;
}
.collection-card__link:hover {
  text-decoration: underline;
}
.collection-card__extra {
  margin-top: var(--space-2);
}
.collection-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
