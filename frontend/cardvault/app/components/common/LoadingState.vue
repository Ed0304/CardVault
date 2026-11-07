<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    /** "inline" shows a spinner; "cards" shows a skeleton card grid. */
    variant?: 'inline' | 'cards'
  }>(),
  { label: 'Loading…', variant: 'inline' },
)
</script>

<template>
  <div v-if="variant === 'inline'" class="loading" role="status">
    <span class="loading__spinner" aria-hidden="true" />
    <span>{{ label }}</span>
  </div>

  <div v-else role="status">
    <span class="visually-hidden">{{ label }}</span>
    <div class="loading-grid" aria-hidden="true">
      <div v-for="n in 6" :key="n" class="loading-card">
        <span class="loading-bar loading-bar--short" />
        <span class="loading-bar loading-bar--title" />
        <span class="loading-bar" />
        <span class="loading-bar" />
        <span class="loading-bar loading-bar--medium" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-12) var(--space-4);
  color: var(--text-secondary);
}
.loading__spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid var(--color-antique-beige);
  border-top-color: var(--color-terracotta-strong);
  border-radius: 50%;
  animation: loading-spin 0.8s linear infinite;
}
@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
  gap: var(--space-4);
}
.loading-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--card-padding);
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-lg);
}
.loading-bar {
  height: 0.75rem;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--bg-sunken) 25%,
    color-mix(in srgb, var(--color-antique-beige) 45%, var(--color-ivory)) 50%,
    var(--bg-sunken) 75%
  );
  background-size: 200% 100%;
  animation: loading-shimmer 1.4s ease-in-out infinite;
}
.loading-bar--short {
  width: 30%;
  height: 0.625rem;
}
.loading-bar--title {
  width: 70%;
  height: 1.25rem;
}
.loading-bar--medium {
  width: 55%;
}
@keyframes loading-shimmer {
  to {
    background-position: -200% 0;
  }
}
</style>
