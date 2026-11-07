<script setup lang="ts">
import { iconPaths } from '~/utils/icons'
import type { IconName } from '~/utils/icons'

withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 20 })
</script>

<template>
  <svg
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="iconPaths[name]" />
  </svg>
</template>

<style scoped>
.app-icon {
  flex-shrink: 0;
}
</style>
