<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'outline' | 'mono'
  }>(),
  { variant: 'neutral' },
)
</script>

<template>
  <span :class="['app-badge', `app-badge--${variant}`]">
    <slot />
  </span>
</template>

<style scoped>
.app-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  max-width: 100%;
  padding: 0.125rem var(--space-2);
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.app-badge--neutral {
  background: var(--bg-sunken);
  border-color: var(--border-subtle);
  color: var(--text-secondary);
}
.app-badge--accent {
  background: var(--bg-ai);
  border-color: var(--border-ai);
  color: var(--color-terracotta-deeper);
}
.app-badge--outline {
  background: transparent;
  border-color: var(--border-default);
  color: var(--text-secondary);
}
.app-badge--mono {
  background: var(--bg-sunken);
  border-color: var(--border-subtle);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-weight: var(--weight-regular);
}
.app-badge--success {
  background: var(--success-bg);
  border-color: var(--success-border);
  color: var(--success-text);
}
.app-badge--warning {
  background: var(--warning-bg);
  border-color: var(--warning-border);
  color: var(--warning-text);
}
.app-badge--error {
  background: var(--error-bg);
  border-color: var(--error-border);
  color: var(--error-text);
}
</style>
