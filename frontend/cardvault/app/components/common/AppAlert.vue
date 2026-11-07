<script setup lang="ts">
import type { IconName } from '~/utils/icons'

const props = withDefaults(
  defineProps<{
    variant?: 'error' | 'warning' | 'success' | 'info'
    title?: string
  }>(),
  { variant: 'error' },
)

const icons: Record<NonNullable<typeof props.variant>, IconName> = {
  error: 'alert',
  warning: 'alert',
  success: 'check',
  info: 'info',
}
</script>

<template>
  <div
    :class="['app-alert', `app-alert--${variant}`]"
    :role="variant === 'error' ? 'alert' : 'status'"
  >
    <CommonAppIcon :name="icons[variant]" :size="18" />
    <div class="app-alert__body">
      <p v-if="title" class="app-alert__title">{{ title }}</p>
      <div class="app-alert__text"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.app-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: var(--border-width) solid;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}
.app-alert :deep(.app-icon) {
  margin-top: 0.15rem;
}
.app-alert__body {
  min-width: 0;
}
.app-alert__title {
  font-weight: var(--weight-semibold);
}
.app-alert__text {
  overflow-wrap: anywhere;
}
.app-alert--error {
  background: var(--error-bg);
  border-color: var(--error-border);
  color: var(--error-text);
}
.app-alert--warning {
  background: var(--warning-bg);
  border-color: var(--warning-border);
  color: var(--warning-text);
}
.app-alert--success {
  background: var(--success-bg);
  border-color: var(--success-border);
  color: var(--success-text);
}
.app-alert--info {
  background: var(--info-bg);
  border-color: var(--info-border);
  color: var(--info-text);
}
</style>
