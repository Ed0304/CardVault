<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.id))

const { card, isLoading, error, fetchCard, deleteCard } = useCatalog()

onMounted(() => fetchCard(id.value))

const onDelete = async () => {
  if (!window.confirm('Delete this card permanently?')) return
  await deleteCard(id.value)
  await navigateTo('/catalog')
}

/** Source metadata entries that can be shown as plain text. */
const sourceMetaEntries = computed(() =>
  Object.entries(card.value?.sourceMeta ?? {}).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0,
  ),
)
</script>

<template>
  <section>
    <NuxtLink to="/catalog" class="back-link">
      <CommonAppIcon name="arrow-left" :size="16" />
      Catalog
    </NuxtLink>

    <CommonLoadingState v-if="isLoading" label="Loading card…" />
    <CommonAppAlert v-else-if="error" title="Couldn't load this card">{{ error }}</CommonAppAlert>

    <article v-else-if="card" class="detail">
      <CommonPageHeading :title="card.sourceTitle ?? 'Untitled'" :eyebrow="`Knowledge card · No. ${shortId(card.id)}`">
        <template #meta>
          <CommonAppBadge v-if="card.collection" variant="neutral">
            <CommonAppIcon name="folder" :size="12" />
            {{ card.collection.name }}
          </CommonAppBadge>
          <CommonAppBadge v-for="tag in card.tags" :key="tag.id" variant="outline">
            {{ tag.name }}
          </CommonAppBadge>
          <span class="mono">
            Saved <time :datetime="card.createdAt">{{ formatDate(card.createdAt) }}</time>
          </span>
        </template>
        <template #actions>
          <CommonAppButton variant="danger" @click="onDelete">
            <CommonAppIcon name="trash" :size="18" />
            Delete card
          </CommonAppButton>
        </template>
      </CommonPageHeading>

      <div class="detail__grid">
        <div class="detail__main">
          <!-- Layer 1: original source -->
          <section class="surface detail-section" aria-labelledby="original-heading">
            <header class="detail-section__header">
              <span class="detail-section__icon"><CommonAppIcon name="file-text" :size="18" /></span>
              <div>
                <p class="eyebrow">Layer 1 · Never modified</p>
                <h2 id="original-heading" class="detail-section__title">Original</h2>
              </div>
            </header>

            <p v-if="card.sourceUrl" class="detail-source">
              <CommonAppIcon name="link" :size="16" />
              <span>
                Source:
                <a :href="card.sourceUrl" rel="noopener noreferrer">{{ card.sourceUrl }}</a>
              </span>
            </p>

            <dl v-if="sourceMetaEntries.length" class="detail-meta">
              <div v-for="[key, value] in sourceMetaEntries" :key="key">
                <dt class="mono">{{ key }}</dt>
                <dd>{{ value }}</dd>
              </div>
            </dl>

            <p class="detail-original">{{ card.sourceText }}</p>
          </section>

          <!-- Layer 2: personal notes -->
          <section class="surface surface--sunken detail-section" aria-labelledby="notes-heading">
            <header class="detail-section__header">
              <span class="detail-section__icon"><CommonAppIcon name="pencil" :size="18" /></span>
              <div>
                <p class="eyebrow">Layer 2 · Yours</p>
                <h2 id="notes-heading" class="detail-section__title">Personal notes</h2>
              </div>
            </header>
            <p v-if="card.notes" class="detail-notes">{{ card.notes }}</p>
            <p v-else class="text-muted">No notes yet.</p>
          </section>
        </div>

        <!-- Layer 3: AI catalog -->
        <aside class="detail__aside">
          <AiMetadata
            :summary="card.aiSummary"
            :subjects="card.aiSubjects"
            :keywords="card.aiKeywords"
            :status="card.aiStatus"
          />
        </aside>
      </div>
    </article>
  </section>
</template>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-decoration: none;
}
.back-link:hover {
  text-decoration: underline;
}

.detail__grid {
  display: grid;
  gap: var(--space-5);
  align-items: start;
}
.detail__main {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-width: 0;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.detail-section__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.detail-section__icon {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-md);
  background: var(--bg-sunken);
  border: var(--border-width) solid var(--border-subtle);
  color: var(--color-archive-brown);
}
.surface--sunken .detail-section__icon {
  background: var(--bg-surface);
}
.detail-section__title {
  font-size: var(--text-xl);
}

.detail-source {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}
.detail-source :deep(.app-icon) {
  margin-top: 0.2rem;
}

.detail-meta {
  display: grid;
  gap: var(--space-2) var(--space-6);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-sunken);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}
.detail-meta dd {
  margin: 0;
  overflow-wrap: anywhere;
}

/* Long-form reading text: serif, generous leading, capped measure */
.detail-original {
  max-width: 68ch;
  font-family: var(--font-heading);
  font-size: var(--text-lg);
  line-height: var(--leading-relaxed);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.detail-notes {
  max-width: 68ch;
  line-height: var(--leading-relaxed);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (min-width: 64rem) {
  .detail__grid {
    grid-template-columns: minmax(0, 1fr) 21rem;
    gap: var(--space-8);
  }
  .detail__aside {
    position: sticky;
    top: calc(var(--header-height) + var(--space-6));
  }
}
</style>
