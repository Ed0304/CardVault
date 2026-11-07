<script setup lang="ts">
defineProps<{
  title: string
  eyebrow?: string
  description?: string
}>()
</script>

<template>
  <header class="page-heading">
    <div class="page-heading__text">
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h1 class="page-heading__title">{{ title }}</h1>
      <p v-if="description" class="page-heading__description">{{ description }}</p>
      <div v-if="$slots.meta" class="page-heading__meta"><slot name="meta" /></div>
    </div>
    <div v-if="$slots.actions" class="page-heading__actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.page-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}
.page-heading__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  flex: 1 1 18rem;
}
.page-heading__title {
  font-size: var(--text-3xl);
  overflow-wrap: anywhere;
}
.page-heading__description {
  max-width: 60ch;
  color: var(--text-secondary);
}
.page-heading__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
.page-heading__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
