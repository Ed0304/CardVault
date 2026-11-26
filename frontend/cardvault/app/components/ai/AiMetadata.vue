<script setup lang="ts">
import type { AiStatus, CatalogFact, RelatedConceptLink } from '~/types/card'

/**
 * A card's catalog entry, laid out like a library catalog record: description, facts, subject
 * headings, keywords and related concepts. Each section appears only when it has content.
 * Related concepts link to a card when the API found one (`cardId`), and are plain text otherwise.
 */
const props = withDefaults(
  defineProps<{
    summary: string | null
    subjects: string[]
    keywords: string[]
    facts?: CatalogFact[]
    related?: RelatedConceptLink[]
    /**
     * Catalog-generation status. Metadata is shown whenever it exists, whatever this is. Omitted
     * on public cards, which do not expose processing statuses.
     */
    status?: AiStatus
    /**
     * Who the entry comes from. Saved entries don't record whether Muse drafted a field, so the
     * default makes no AI claim; AI styling is kept for Muse's unsaved drafts.
     */
    eyebrow?: string
    /** Path prefix for related-concept links: "/catalog/" (own vault) or "/community/". */
    relatedLinkBase?: string
  }>(),
  {
    facts: () => [],
    related: () => [],
    status: undefined,
    eyebrow: 'Catalog entry · describes the source',
    relatedLinkBase: '/catalog/',
  },
)

const hasMetadata = computed(
  () =>
    Boolean(props.summary) ||
    props.subjects.length > 0 ||
    props.keywords.length > 0 ||
    props.facts.length > 0 ||
    props.related.length > 0,
)
</script>

<template>
  <section class="ai-metadata surface" aria-labelledby="ai-metadata-heading">
    <div class="ai-metadata__header">
      <span class="ai-metadata__icon"><CommonAppIcon name="catalog" :size="18" /></span>
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h2 id="ai-metadata-heading" class="ai-metadata__title">Catalog entry</h2>
      </div>
    </div>

    <AiProcessingStatus v-if="status" :status="status" />
    <p v-else-if="!hasMetadata" class="text-muted">No catalog details yet.</p>

    <div v-if="hasMetadata" class="ai-metadata__body">
      <p v-if="summary" class="ai-metadata__summary">{{ summary }}</p>

      <dl v-if="facts.length" class="ai-metadata__facts" aria-label="Facts">
        <div v-for="fact in facts" :key="fact.label" class="ai-metadata__fact">
          <dt class="mono">{{ fact.label }}</dt>
          <dd>{{ fact.value }}</dd>
        </div>
      </dl>

      <div v-if="subjects.length" class="ai-metadata__group">
        <h3 class="ai-metadata__label">Subject headings</h3>
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

      <div v-if="related.length" class="ai-metadata__group">
        <h3 class="ai-metadata__label">Related concepts</h3>
        <ul class="ai-metadata__related">
          <li v-for="concept in related" :key="concept.name">
            <NuxtLink v-if="concept.cardId" :to="`${relatedLinkBase}${concept.cardId}`" class="ai-metadata__concept">
              {{ concept.name }}
            </NuxtLink>
            <span v-else class="ai-metadata__concept">{{ concept.name }}</span>
            <span class="ai-metadata__relation">{{ concept.relation }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div v-if="$slots.default" class="ai-metadata__extra"><slot /></div>
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
  background: var(--color-archive-brown);
  color: var(--color-ivory);
}
.ai-metadata__title {
  font-size: var(--text-xl);
}
.ai-metadata__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
/* The description reads like the lead of a catalog card. */
.ai-metadata__summary {
  max-width: 68ch;
  font-family: var(--font-heading);
  font-size: var(--text-lg);
  line-height: var(--leading-relaxed);
  overflow-wrap: anywhere;
}
.ai-metadata__facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
  gap: var(--space-3) var(--space-5);
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-sunken);
  border: var(--border-width) dashed var(--border-default);
  border-radius: var(--radius-md);
}
.ai-metadata__fact dt {
  font-size: var(--text-xs);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.ai-metadata__fact dd {
  margin: 0;
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
.ai-metadata__related {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: none;
}
.ai-metadata__related li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-1) var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: var(--border-width) dotted var(--border-default);
}
.ai-metadata__related li:last-child {
  padding-bottom: 0;
  border-bottom: none;
}
.ai-metadata__concept {
  font-weight: var(--weight-medium);
  overflow-wrap: anywhere;
}
.ai-metadata__relation {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.ai-metadata__extra {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-4);
  border-top: var(--border-width) dashed var(--border-default);
}
</style>
