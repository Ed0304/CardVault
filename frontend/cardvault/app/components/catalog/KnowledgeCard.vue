<script setup lang="ts">
import type { CardSummary } from '~/types/card'

const props = defineProps<{ card: CardSummary }>()

const MAX_SUBJECTS = 3

const host = computed(() => hostnameOf(props.card.sourceUrl))
const visibleSubjects = computed(() => props.card.aiSubjects.slice(0, MAX_SUBJECTS))
const hiddenSubjectCount = computed(() => Math.max(0, props.card.aiSubjects.length - MAX_SUBJECTS))
</script>

<template>
  <article class="kcard">
    <div class="kcard__strip">
      <span class="mono kcard__number">No. {{ shortId(card.id) }}</span>
      <AiProcessingStatus :status="card.aiStatus" compact />
    </div>

    <div class="kcard__body">
      <h2 class="kcard__title">
        <NuxtLink :to="`/catalog/${card.id}`" class="kcard__link">
          {{ card.sourceTitle ?? 'Untitled' }}
        </NuxtLink>
      </h2>

      <p v-if="host" class="kcard__source">
        <CommonAppIcon name="link" :size="14" />
        {{ host }}
      </p>

      <p v-if="card.aiSummary" class="kcard__summary">{{ card.aiSummary }}</p>

      <ul v-if="card.aiSubjects.length" class="kcard__subjects" aria-label="Subjects">
        <li v-for="subject in visibleSubjects" :key="subject">
          <CommonAppBadge variant="accent">{{ subject }}</CommonAppBadge>
        </li>
        <li v-if="hiddenSubjectCount">
          <CommonAppBadge variant="outline">+{{ hiddenSubjectCount }}</CommonAppBadge>
        </li>
      </ul>
    </div>

    <footer class="kcard__footer">
      <span v-if="card.collection" class="kcard__collection">
        <CommonAppIcon name="folder" :size="14" />
        {{ card.collection.name }}
      </span>
      <ul v-if="card.tags.length" class="kcard__tags" aria-label="Tags">
        <li v-for="tag in card.tags" :key="tag.id">
          <CommonAppBadge variant="outline">{{ tag.name }}</CommonAppBadge>
        </li>
      </ul>
      <time class="mono kcard__date" :datetime="card.createdAt">{{ formatDate(card.createdAt) }}</time>
    </footer>
  </article>
</template>

<style scoped>
.kcard {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-subtle);
  border-top: 3px solid var(--color-antique-beige);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition:
    box-shadow var(--transition-base),
    border-color var(--transition-base),
    transform var(--transition-base);
}
.kcard:hover {
  border-color: var(--border-default);
  border-top-color: var(--color-terracotta);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
.kcard:focus-within {
  box-shadow: var(--shadow-md), var(--focus-ring);
}

/* Ruled catalog-card header strip */
.kcard__strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--card-padding);
  border-bottom: var(--border-width) dashed var(--border-default);
}

.kcard__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--card-padding);
}
.kcard__title {
  font-size: var(--text-xl);
  overflow-wrap: anywhere;
}
/* Stretched link: the whole card is clickable via the title link. */
.kcard__link {
  color: var(--text-primary);
  text-decoration: none;
}
.kcard__link::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
}
.kcard__link:hover {
  color: var(--text-link);
}
.kcard__link:focus-visible {
  outline: none;
}
.kcard__source {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-muted);
}
.kcard__summary {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}
.kcard__subjects,
.kcard__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  list-style: none;
}

.kcard__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3) var(--card-padding);
  border-top: var(--border-width) dashed var(--border-default);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
.kcard__collection {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-weight: var(--weight-medium);
}
.kcard__date {
  margin-left: auto;
}
</style>
