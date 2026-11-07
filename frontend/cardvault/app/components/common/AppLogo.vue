<script setup lang="ts">
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })
</script>

<template>
  <span :class="['app-logo', `app-logo--${size}`]">
    <svg class="app-logo__mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="2" y="4.5" width="20" height="15" rx="3" fill="var(--color-archive-brown)" />
      <path
        d="M6.5 10h8M6.5 14h5"
        stroke="var(--color-ivory)"
        stroke-width="1.6"
        stroke-linecap="round"
      />
      <circle cx="18" cy="14.5" r="1.4" fill="var(--color-terracotta)" />
    </svg>
    <span class="app-logo__text">CardVault</span>
  </span>
</template>

<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-primary);
  font-family: var(--font-heading);
  font-weight: var(--weight-semibold);
  letter-spacing: -0.01em;
  line-height: 1;
}
.app-logo--sm {
  font-size: var(--text-lg);
}
.app-logo--md {
  font-size: var(--text-xl);
}
.app-logo--lg {
  font-size: var(--text-2xl);
}
.app-logo__mark {
  width: 1.4em;
  height: 1.4em;
}
</style>
