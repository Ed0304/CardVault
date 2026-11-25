<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.id))

const { card, isLoading, error, fetchCard, deleteCard } = useCatalog()

onMounted(() => fetchCard(id.value))
// Related-concept links lead from one card to another on the same page component.
watch(id, (value) => fetchCard(value))

const onDelete = async () => {
  if (!window.confirm('Delete this card permanently?')) return
  // Leave the page only when the delete succeeded; otherwise the error stays visible here.
  if (await deleteCard(id.value)) await navigateTo('/catalog')
}

/** Source metadata recorded when a web page was saved, in display order. */
const SOURCE_META_FIELDS: { key: string; label: string; kind: 'text' | 'date' | 'url' }[] = [
  { key: 'siteName', label: 'Site', kind: 'text' },
  { key: 'author', label: 'Author', kind: 'text' },
  { key: 'publishedAt', label: 'Published', kind: 'date' },
  { key: 'fetchedAt', label: 'Saved from the web', kind: 'date' },
  { key: 'retrievedVia', label: 'Read through', kind: 'text' },
  { key: 'canonicalUrl', label: 'Canonical address', kind: 'url' },
  { key: 'finalUrl', label: 'Read from', kind: 'url' },
]

const sourceMetaEntries = computed(() => {
  const meta = card.value?.sourceMeta ?? {}
  return SOURCE_META_FIELDS.flatMap(({ key, label, kind }) => {
    const value = meta[key]
    if (typeof value !== 'string' || !value) return []
    // The address actually read is worth showing only when a redirect changed it.
    if (kind === 'url' && value === card.value?.sourceUrl) return []
    if (kind === 'url' && !/^https?:\/\//.test(value)) return []
    return [{ key, label, kind, value: kind === 'date' ? formatDate(value) : value }]
  })
})
const sourceWasTruncated = computed(() => card.value?.sourceMeta?.truncated === true)

/** The source's own name, e.g. "Jigglypuff - Wikipedia", kept apart from the catalog title. */
const sourceLabel = computed(() => {
  const c = card.value
  if (!c) return ''
  return c.sourceTitle?.trim() || hostnameOf(c.sourceUrl) || 'Pasted text'
})

/** Eyebrow above the title: catalog number and the most specific subject heading, if any. */
const identity = computed(() => {
  const c = card.value
  if (!c) return ''
  const heading = c.aiSubjects[0]
  return `Catalog entry · No. ${shortId(c.id)}${heading ? ` · ${heading}` : ''}`
})
</script>

<template>
  <section>
    <NuxtLink to="/catalog" class="back-link">
      <CommonAppIcon name="arrow-left" :size="16" />
      My Vault
    </NuxtLink>

    <CommonLoadingState v-if="isLoading" label="Loading card…" />
    <CommonAppAlert v-else-if="error" title="Couldn't load this card">{{ error }}</CommonAppAlert>

    <article v-else-if="card" class="detail">
      <CommonPageHeading :title="displayTitle(card)" :eyebrow="identity">
        <template #meta>
          <CommonAppBadge v-if="card.collection" variant="neutral">
            <CommonAppIcon name="folder" :size="12" />
            {{ card.collection.name }}
          </CommonAppBadge>
          <CommonAppBadge v-for="tag in card.tags" :key="tag.id" variant="outline">
            {{ tag.name }}
          </CommonAppBadge>
          <CommonAppBadge :variant="card.visibility === 'PUBLIC' ? 'success' : 'outline'">
            <CommonAppIcon :name="card.visibility === 'PUBLIC' ? 'globe' : 'lock'" :size="12" />
            {{ card.visibility === 'PUBLIC' ? 'Public' : 'Private' }}
          </CommonAppBadge>
          <span class="mono">
            Saved <time :datetime="card.createdAt">{{ formatDate(card.createdAt) }}</time>
          </span>
          <span v-if="card.sourceUrl" class="detail-from">
            <CommonAppIcon name="link" :size="12" />
            From <a :href="card.sourceUrl" rel="noopener noreferrer nofollow">{{ hostnameOf(card.sourceUrl) ?? card.sourceUrl }}</a>
          </span>
        </template>
        <template #actions>
          <CommonAppButton variant="danger" @click="onDelete">
            <CommonAppIcon name="trash" :size="18" />
            Delete card
          </CommonAppButton>
        </template>
      </CommonPageHeading>

      <!-- Attribution for a copy saved from the Community Catalog (REQ-CAT-014). -->
      <aside v-if="card.savedFrom" class="attribution" aria-label="Attribution">
        <CommonAppIcon name="bookmark" :size="18" />
        <div>
          <p>
            Saved from the Community Catalog. Originally cataloged by
            <strong>{{ card.savedFrom.authorUsername }}</strong>.
          </p>
          <p class="attribution__detail">
            This is your own copy: you can edit it, and changes to the original don't affect it.
            <NuxtLink v-if="card.savedFrom.originalAvailable" :to="`/community/${card.savedFrom.cardId}`">
              View the original
            </NuxtLink>
            <span v-else>The original is no longer in the Community Catalog.</span>
          </p>
        </div>
      </aside>

      <div class="detail__grid">
        <div class="detail__main">
          <!-- The catalog entry: title above, then description, facts, headings, keywords, related. -->
          <AiCatalogPanel :card="card" />

          <!-- The original source, kept apart from the catalog entry and never modified. -->
          <section class="surface detail-section" aria-labelledby="original-heading">
            <header class="detail-section__header">
              <span class="detail-section__icon"><CommonAppIcon name="file-text" :size="18" /></span>
              <div>
                <p class="eyebrow">Original source · never modified</p>
                <h2 id="original-heading" class="detail-section__title">{{ sourceLabel }}</h2>
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
              <div v-for="entry in sourceMetaEntries" :key="entry.key">
                <dt class="mono">{{ entry.label }}</dt>
                <dd>
                  <a v-if="entry.kind === 'url'" :href="entry.value" rel="noopener noreferrer nofollow">{{ entry.value }}</a>
                  <template v-else>{{ entry.value }}</template>
                </dd>
              </div>
            </dl>
            <CommonAppAlert v-if="sourceWasTruncated" variant="info">
              This page was very long, so only its first 100,000 characters were saved.
            </CommonAppAlert>

            <p v-if="card.sourceText" class="detail-original">{{ card.sourceText }}</p>
            <p v-else class="text-muted">
              {{
                card.savedFrom
                  ? "The original author didn't share the source text. Follow the source link to read it."
                  : 'No source text.'
              }}
            </p>
          </section>

        </div>

        <aside class="detail__aside">
          <!-- Personal notes: private, and never sent to AI or published. -->
          <CatalogNotesEditor :key="card.id" :card="card" />
          <CatalogCardPublishing :card="card" />
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

.attribution {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-sunken);
  border: var(--border-width) solid var(--border-subtle);
  border-left: 3px solid var(--color-archive-brown);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}
.attribution :deep(.app-icon) {
  flex-shrink: 0;
  margin-top: 0.15rem;
  color: var(--color-archive-brown);
}
.attribution__detail {
  color: var(--text-secondary);
}

.detail-from {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.detail__grid {
  display: grid;
  gap: var(--space-5);
  align-items: start;
}
.detail__aside {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
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

@media (min-width: 64rem) {
  .detail__grid {
    grid-template-columns: minmax(0, 1fr) 21rem;
    gap: var(--space-8);
  }
  .detail__aside {
    position: sticky;
    top: calc(var(--header-height) + var(--space-6));
    /* The aside holds two panels; keep all of it reachable while it sticks. */
    max-height: calc(100vh - var(--header-height) - var(--space-12));
    overflow-y: auto;
  }
}
</style>
