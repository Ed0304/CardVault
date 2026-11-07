<script setup lang="ts">
import type { Collection } from '~/types/collection'

defineProps<{ collection: Collection }>()
</script>

<template>
  <article class="collection-card">
    <span class="collection-card__icon"><CommonAppIcon name="folder" :size="22" /></span>
    <div class="collection-card__text">
      <h2 class="collection-card__name">{{ collection.name }}</h2>
      <p v-if="collection.createdAt" class="mono">
        Created <time :datetime="collection.createdAt">{{ formatDate(collection.createdAt) }}</time>
      </p>
    </div>
  </article>
</template>

<style scoped>
.collection-card {
  display: flex;
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
  min-width: 0;
}
.collection-card__name {
  font-size: var(--text-xl);
  overflow-wrap: anywhere;
}
</style>
