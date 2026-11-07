<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'md' | 'sm'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    block?: boolean
    /** Renders a router link styled as a button. */
    to?: string
  }>(),
  { variant: 'primary', size: 'md', type: 'button', disabled: false, loading: false, block: false },
)

const NuxtLinkComponent = resolveComponent('NuxtLink')
const isDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
  <component
    :is="to ? NuxtLinkComponent : 'button'"
    :to="to || undefined"
    :type="to ? undefined : type"
    :disabled="to ? undefined : isDisabled"
    :aria-busy="loading || undefined"
    :class="[
      'app-button',
      `app-button--${variant}`,
      `app-button--${size}`,
      { 'app-button--block': block, 'app-button--loading': loading },
    ]"
  >
    <span v-if="loading" class="app-button__spinner" aria-hidden="true" />
    <slot />
  </component>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--control-height);
  padding: 0 var(--space-5);
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}
.app-button:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}
.app-button:active:not(:disabled) {
  transform: translateY(1px);
}
.app-button--sm {
  min-height: var(--control-height-sm);
  padding: 0 var(--space-4);
}
.app-button--block {
  display: flex;
  width: 100%;
}

/* Primary */
.app-button--primary {
  background: var(--action-primary-bg);
  color: var(--text-on-action);
  box-shadow: var(--shadow-sm);
}
.app-button--primary:hover:not(:disabled) {
  background: var(--action-primary-hover);
  color: var(--text-on-action);
}
.app-button--primary:active:not(:disabled) {
  background: var(--action-primary-active);
}

/* Secondary */
.app-button--secondary {
  background: var(--action-secondary-bg);
  color: var(--text-primary);
  border-color: var(--border-control);
}
.app-button--secondary:hover:not(:disabled) {
  background: var(--action-secondary-hover);
  color: var(--text-primary);
}

/* Ghost */
.app-button--ghost {
  background: transparent;
  color: var(--text-primary);
}
.app-button--ghost:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* Danger (destructive, outlined until hovered) */
.app-button--danger {
  background: transparent;
  color: var(--action-danger);
  border-color: var(--action-danger);
}
.app-button--danger:hover:not(:disabled) {
  background: var(--action-danger);
  color: var(--text-on-action);
}

/* Disabled / loading */
.app-button:disabled {
  background: var(--disabled-bg);
  border-color: transparent;
  color: var(--disabled-text);
  box-shadow: none;
  cursor: not-allowed;
}
.app-button--loading:disabled {
  cursor: progress;
}

.app-button__spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: app-button-spin 0.7s linear infinite;
}
@keyframes app-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
