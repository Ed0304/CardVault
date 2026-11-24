<script setup lang="ts">
import type { PublicCardSummary } from '~/types/community'

const props = defineProps<{ card: PublicCardSummary }>()

const MAX_SUBJECTS = 3

const host = computed(() => hostnameOf(props.card.sourceUrl))
const visibleSubjects = computed(() => props.card.aiSubjects.slice(0, MAX_SUBJECTS))
const hiddenSubjectCount = computed(() => Math.max(0, props.card.aiSubjects.length - MAX_SUBJECTS))
</script>

<template>
  <article class="ccard">
    <div class="ccard__strip">
      <span class="mono ccard__number">No. {{ shortId(card.id) }}</span>
      <span v-if="card.hasSourceText" class="ccard__flag">
        <CommonAppIcon name="file-text" :size="12" />
        Full text
      </span>
    </div>

    <div class="ccard__body">
      <h2 class="ccard__title">
        <NuxtLink :to="`/community/${card.id}`" class="ccard__link">
          {{ card.sourceTitle ?? 'Untitled' }}
        </NuxtLink>
      </h2>

      <p v-if="host" class="ccard__source">
        <CommonAppIcon name="link" :size="14" />
        {{ host }}
      </p>

      <p v-if="card.aiSummary" class="ccard__summary">{{ card.aiSummary }}</p>

      <ul v-if="card.aiSubjects.length" class="ccard__subjects" aria-label="Subjects">
        <li v-for="subject in visibleSubjects" :key="subject">
          <CommonAppBadge variant="accent">{{ subject }}</CommonAppBadge>
        </li>
        <li v-if="hiddenSubjectCount">
          <CommonAppBadge variant="outline">+{{ hiddenSubjectCount }}</CommonAppBadge>
        </li>
      </ul>
    </div>

    <footer class="ccard__footer">
      <span class="ccard__author">
        <CommonAppIcon name="user" :size="14" />
        {{ card.author.username }}
      </span>
      <time class="mono ccard__date" :datetime="card.publishedAt">{{ formatDate(card.publishedAt) }}</time>
    </footer>
  </article>
</template>

<style scoped>
.ccard {
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
    border-color var(--transition-base),
    transform var(--transition-base);
}
.ccard:hover {
  border-color: var(--border-default);
  border-top-color: var(--color-terracotta);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
.ccard:focus-within {
  box-shadow: var(--shadow-md), var(--focus-ring);
}
.ccard__strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--card-padding);
  border-bottom: var(--border-width) dashed var(--border-default);
}
.ccard__flag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-muted);
}
.ccard__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--card-padding);
}
.ccard__title {
  font-size: var(--text-xl);
  overflow-wrap: anywhere;
}
/* Stretched link: the whole card is clickable via the title link. */
.ccard__link {
  color: var(--text-primary);
  text-decoration: none;
}
.ccard__link::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
}
.ccard__link:hover {
  color: var(--text-link);
}
.ccard__link:focus-visible {
  outline: none;
}
.ccard__source {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-muted);
}
.ccard__summary {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}
.ccard__subjects {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  list-style: none;
}
.ccard__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3) var(--card-padding);
  border-top: var(--border-width) dashed var(--border-default);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
.ccard__author {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-weight: var(--weight-medium);
}
.ccard__date {
  margin-left: auto;
}
</style>
