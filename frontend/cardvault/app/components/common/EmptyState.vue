<script setup lang="ts">
import type { IconName } from '~/utils/icons'

withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: IconName
  }>(),
  { icon: 'catalog' },
)
</script>

<template>
  <div class="empty-state">
    <span class="empty-state__icon">
      <CommonAppIcon :name="icon" :size="26" />
    </span>
    <h2 class="empty-state__title">{{ title }}</h2>
    <p v-if="description" class="empty-state__description">{{ description }}</p>
    <div v-if="$slots.default" class="empty-state__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-12) var(--space-6);
  text-align: center;
  background: var(--bg-surface);
  border: var(--border-width) dashed var(--border-default);
  border-radius: var(--radius-lg);
}
.empty-state__icon {
  display: grid;
  place-items: center;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 50%;
  background: var(--bg-sunken);
  color: var(--color-archive-brown);
}
.empty-state__title {
  font-size: var(--text-xl);
}
.empty-state__description {
  max-width: 34ch;
  color: var(--text-secondary);
}
.empty-state__actions {
  margin-top: var(--space-2);
}
</style>
