<script setup lang="ts">
import type { AiStatus } from '~/types/card'

defineProps<{
  summary: string | null
  subjects: string[]
  keywords: string[]
  status: AiStatus
}>()
</script>

<template>
  <section class="ai-metadata surface surface--ai" aria-labelledby="ai-metadata-heading">
    <div class="ai-metadata__header">
      <span class="ai-metadata__icon"><CommonAppIcon name="sparkle" :size="18" /></span>
      <div>
        <p class="eyebrow">AI-generated</p>
        <h2 id="ai-metadata-heading" class="ai-metadata__title">AI catalog</h2>
      </div>
    </div>

    <AiProcessingStatus :status="status" />

    <div v-if="status === 'COMPLETE'" class="ai-metadata__body">
      <p v-if="summary" class="ai-metadata__summary">{{ summary }}</p>

      <div v-if="subjects.length" class="ai-metadata__group">
        <h3 class="ai-metadata__label">Subjects</h3>
        <ul class="ai-metadata__list">
          <li v-for="subject in subjects" :key="subject">
            <CommonAppBadge variant="accent">{{ subject }}</CommonAppBadge>
          </li>
        </ul>
      </div>

      <div v-if="keywords.length" class="ai-metadata__group">
        <h3 class="ai-metadata__label">Keywords</h3>
        <ul class="ai-metadata__list">
          <li v-for="keyword in keywords" :key="keyword">
            <CommonAppBadge variant="mono">{{ keyword }}</CommonAppBadge>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ai-metadata {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.ai-metadata__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.ai-metadata__icon {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-md);
  background: var(--color-terracotta-strong);
  color: var(--color-ivory);
}
.ai-metadata__title {
  font-size: var(--text-xl);
}
.ai-metadata__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.ai-metadata__summary {
  line-height: var(--leading-relaxed);
  overflow-wrap: anywhere;
}
.ai-metadata__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.ai-metadata__label {
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.ai-metadata__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  list-style: none;
}
</style>
