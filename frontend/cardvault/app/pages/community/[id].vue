<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.id))

const { card, isLoading, error, isSaving, saveError, fetchCard, saveCard } = useCommunity()

const justSaved = ref(false)

onMounted(() => fetchCard(id.value))
watch(id, (value) => {
  justSaved.value = false
  fetchCard(value)
})

const onSave = async () => {
  if (await saveCard(id.value)) justSaved.value = true
}
</script>

<template>
  <section>
    <NuxtLink to="/community" class="back-link">
      <CommonAppIcon name="arrow-left" :size="16" />
      Community Catalog
    </NuxtLink>

    <CommonLoadingState v-if="isLoading" label="Loading card…" />
    <CommonAppAlert v-else-if="error" title="Couldn't open this card">{{ error }}</CommonAppAlert>

    <article v-else-if="card" class="detail">
      <CommonPageHeading
        :title="displayTitle(card)"
        :eyebrow="`Community catalog entry · No. ${shortId(card.id)}${card.aiSubjects[0] ? ` · ${card.aiSubjects[0]}` : ''}`"
      >
        <template #meta>
          <span class="author">
            <CommonAppIcon name="user" :size="14" />
            Cataloged by <strong>{{ card.author.username }}</strong>
          </span>
          <span class="mono">
            Published <time :datetime="card.publishedAt">{{ formatDate(card.publishedAt) }}</time>
          </span>
        </template>
        <template #actions>
          <CommonAppButton v-if="card.viewer.isOwner" :to="`/catalog/${card.id}`" variant="secondary">
            <CommonAppIcon name="pencil" :size="18" />
            Your card · Open in vault
          </CommonAppButton>
          <CommonAppButton v-else-if="card.viewer.savedCardId" :to="`/catalog/${card.viewer.savedCardId}`" variant="secondary">
            <CommonAppIcon name="check" :size="18" />
            In your vault · Open copy
          </CommonAppButton>
          <CommonAppButton v-else :loading="isSaving" @click="onSave">
            <CommonAppIcon name="bookmark" :size="18" />
            Save to My Vault
          </CommonAppButton>
        </template>
      </CommonPageHeading>

      <div class="stack" style="--stack-gap: var(--space-4)">
        <CommonAppAlert v-if="justSaved && card.viewer.savedCardId" variant="success" title="Saved to your vault">
          Your copy is private and yours to edit. It keeps this card's attribution, and it stays in your
          vault even if the author changes or removes the original.
          <NuxtLink :to="`/catalog/${card.viewer.savedCardId}`">Open your copy</NuxtLink>
        </CommonAppAlert>
        <CommonAppAlert v-if="saveError" title="Not saved">{{ saveError }}</CommonAppAlert>
      </div>

      <div class="detail__stack">
        <AiMetadata
          eyebrow="Catalog entry · published by the author"
          :summary="card.aiSummary"
          :facts="card.aiFacts"
          :subjects="card.aiSubjects"
          :keywords="card.aiKeywords"
          :related="card.aiRelated"
          related-link-base="/community/"
        />

        <section class="surface detail-section" aria-labelledby="source-heading">
          <header class="detail-section__header">
            <span class="detail-section__icon"><CommonAppIcon name="file-text" :size="18" /></span>
            <div>
              <p class="eyebrow">Original source</p>
              <h2 id="source-heading" class="detail-section__title">
                {{ card.sourceTitle?.trim() || hostnameOf(card.sourceUrl) || 'Source' }}
              </h2>
            </div>
          </header>

          <p v-if="card.sourceUrl" class="detail-source">
            <CommonAppIcon name="link" :size="16" />
            <span>
              Source:
              <a :href="card.sourceUrl" rel="noopener noreferrer nofollow" target="_blank">{{ card.sourceUrl }}</a>
            </span>
          </p>

          <p v-if="card.sourceText" class="detail-original">{{ card.sourceText }}</p>
          <p v-else class="text-muted">
            The author shared this card's catalog details but not its original text.
            <template v-if="card.sourceUrl">Follow the source link to read it.</template>
          </p>
        </section>
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
.author {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.detail__stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 56rem;
  margin-top: var(--space-5);
}
.detail-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
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
.detail-original {
  max-width: 68ch;
  font-family: var(--font-heading);
  font-size: var(--text-lg);
  line-height: var(--leading-relaxed);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
