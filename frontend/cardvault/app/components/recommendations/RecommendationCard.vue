<script setup lang="ts">
import type { IconName } from '~/utils/icons'
import type { Recommendation, RecommendationReasonKind } from '~/types/recommendation'

/** One recommended Community card with the reason it was picked. */
const props = defineProps<{ item: Recommendation }>()

const REASON_ICONS: Record<RecommendationReasonKind, IconName> = {
  INTEREST: 'sparkle',
  BRIDGE: 'link',
  VAULT: 'bookmark',
  ADJACENT: 'compass',
  EXPLORE: 'compass',
}
const REASON_LABELS: Record<RecommendationReasonKind, string> = {
  INTEREST: 'For you',
  BRIDGE: 'Connection',
  VAULT: 'From your vault',
  ADJACENT: 'Nearby topic',
  EXPLORE: 'Something new',
}

const card = computed(() => props.item.card)
const host = computed(() => hostnameOf(card.value.sourceUrl))
const heading = computed(() => card.value.aiSubjects[0] ?? card.value.aiKeywords[0] ?? null)
const isDiscovery = computed(() => ['ADJACENT', 'EXPLORE'].includes(props.item.reason.kind))
</script>

<template>
  <article :class="['rcard', { 'rcard--discovery': isDiscovery }]">
    <div class="rcard__strip">
      <span class="rcard__label">
        <CommonAppIcon :name="REASON_ICONS[item.reason.kind]" :size="14" />
        {{ REASON_LABELS[item.reason.kind] }}
      </span>
      <span class="mono">No. {{ shortId(card.id) }}</span>
    </div>

    <div class="rcard__body">
      <p v-if="heading" class="rcard__subject mono">{{ heading }}</p>
      <h3 class="rcard__title">
        <NuxtLink :to="`/community/${card.id}`" class="rcard__link">{{ displayTitle(card) }}</NuxtLink>
      </h3>
      <!-- Provenance on one compact line: who cataloged it, and where the source lives. -->
      <p class="rcard__provenance">
        <span>by {{ card.author.username }}</span>
        <template v-if="host"><span aria-hidden="true">·</span><span class="rcard__host">{{ host }}</span></template>
      </p>
      <p class="rcard__reason">
        <span class="visually-hidden">Why it's here: </span>{{ item.reason.text }}
      </p>
      <p v-if="card.aiSummary" class="rcard__summary">{{ card.aiSummary }}</p>
      <p v-else class="rcard__summary text-muted">No catalog description yet. Open the card to read more.</p>
    </div>
  </article>
</template>

<style scoped>
.rcard {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-subtle);
  border-top: 3px solid var(--color-archive-brown);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition:
    box-shadow var(--transition-base),
    transform var(--transition-base);
}
.rcard--discovery {
  border-top-color: var(--color-terracotta);
}
.rcard:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
.rcard:focus-within {
  box-shadow: var(--shadow-md), var(--focus-ring);
}
.rcard__strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--card-padding);
  border-bottom: var(--border-width) dashed var(--border-default);
}
.rcard__label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-archive-brown);
}
.rcard--discovery .rcard__label {
  color: var(--color-terracotta-deeper);
}
.rcard__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--card-padding);
}
.rcard__subject {
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.rcard__title {
  font-size: var(--text-xl);
  overflow-wrap: anywhere;
}
.rcard__summary {
  margin-top: var(--space-1);
}
/* Stretched link: the whole card opens the public card. */
.rcard__link {
  color: var(--text-primary);
  text-decoration: none;
}
.rcard__link::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
}
.rcard__link:hover {
  color: var(--text-link);
}
.rcard__link:focus-visible {
  outline: none;
}
.rcard__summary {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}
/* The reason sits right under the title, so it can be scanned before the description. */
.rcard__reason {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-sunken);
  border-left: 3px solid var(--color-archive-brown);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  overflow-wrap: anywhere;
}
.rcard--discovery .rcard__reason {
  border-left-color: var(--color-terracotta);
}
.rcard__provenance {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-1);
  margin-top: calc(-1 * var(--space-1));
  font-size: var(--text-xs);
  color: var(--text-muted);
}
.rcard__host {
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}
</style>
