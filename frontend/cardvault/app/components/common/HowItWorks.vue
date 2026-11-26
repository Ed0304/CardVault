<script setup lang="ts">
import type { IconName } from '~/utils/icons'

/**
 * The CardVault workflow in four short steps. Every step describes behaviour that exists:
 * sources are kept as saved; Muse runs only when the owner asks and its suggestions are a draft
 * until saved; collections, tags, keyword search and Home recommendations; private by default,
 * with publishing as an explicit choice.
 */
withDefaults(defineProps<{ headingLevel?: 'h2' | 'h3' }>(), { headingLevel: 'h2' })

const steps: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'file-text',
    title: 'Capture a source',
    text: 'Paste text or a public web page. CardVault keeps the source exactly as saved.',
  },
  {
    icon: 'pencil',
    title: 'Review its catalog entry',
    text: "Write the entry yourself, or ask Muse for suggestions. Nothing changes until you review and save.",
  },
  {
    icon: 'folder',
    title: 'Connect and rediscover',
    text: 'Shelve cards in collections, tag them, search your vault, and find related cards here on Home.',
  },
  {
    icon: 'globe',
    title: 'Share if you choose',
    text: 'Cards are private. Publish one to the Community Catalog; your notes, collection and tags stay private.',
  },
]
</script>

<template>
  <section class="how" aria-labelledby="how-heading">
    <component :is="headingLevel" id="how-heading" class="how__title">How CardVault works</component>
    <ol class="how__steps">
      <li v-for="(step, index) in steps" :key="step.title" class="how__step">
        <span class="how__icon" aria-hidden="true"><CommonAppIcon :name="step.icon" :size="18" /></span>
        <div>
          <p class="how__name">
            <span class="mono how__number">{{ String(index + 1).padStart(2, '0') }}</span>
            {{ step.title }}
          </p>
          <p class="how__text">{{ step.text }}</p>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.how {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.how__title {
  font-size: var(--text-xl);
}
.how__steps {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  list-style: none;
}
.how__step {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-md);
}
.how__icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-md);
  background: var(--bg-sunken);
  color: var(--color-archive-brown);
}
.how__name {
  font-weight: var(--weight-semibold);
}
.how__number {
  margin-right: var(--space-1);
}
.how__text {
  margin-top: var(--space-1);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}
</style>
