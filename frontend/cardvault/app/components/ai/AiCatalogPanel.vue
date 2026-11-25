<script setup lang="ts">
import { catalogService } from '~/services/catalog.service'
import type { KnowledgeCard, UpdateAiMetadataPayload } from '~/types/card'

/**
 * The card's catalog layer with AI-assisted cataloging (AI Cataloging REQ-AI-001, REQ-AI-007).
 *
 * The owner asks Muse to catalog the card. Muse's answer arrives as a draft, clearly labelled
 * as AI-generated, which the owner reviews, edits and saves, or discards. Nothing on the card
 * (or on its public page, if published) changes until they save.
 */
const props = defineProps<{ card: KnowledgeCard }>()

// Its own useCatalog instance: loading and errors here must not replace the whole card page.
const { requestCatalog, discardCatalogDraft, updateAiMetadata, isLoading, error } = useCatalog()

// Whether the server can offer AI cataloging; asked once per visit.
const aiAvailable = useState<boolean | null>('ai:catalog-available', () => null)
onMounted(async () => {
  if (aiAvailable.value !== null) return
  aiAvailable.value = await catalogService
    .aiStatus()
    .then((status) => status.catalog.available)
    .catch(() => false)
})

const editing = ref(false)
const cataloging = ref(false)
const notice = ref<string | null>(null)

const draft = computed(() => props.card.aiCatalogDraft)
const hasSourceText = computed(() => props.card.sourceText.trim().length > 0)
const hasDetails = computed(
  () => Boolean(props.card.aiSummary) || props.card.aiSubjects.length > 0 || props.card.aiKeywords.length > 0,
)
const modelLabel = computed(() => (draft.value ? museModelName(draft.value.model) : ''))

const onCatalog = async () => {
  notice.value = null
  editing.value = false
  cataloging.value = true
  await requestCatalog(props.card.id)
  cataloging.value = false
}

const onSaveDraft = async (payload: Required<UpdateAiMetadataPayload>) => {
  if (await updateAiMetadata(props.card.id, payload)) {
    notice.value = props.card.visibility === 'PUBLIC'
      ? 'Saved. The new catalog details now appear on your public card.'
      : 'Saved to your card.'
  }
}

const onDiscard = async () => {
  if (await discardCatalogDraft(props.card.id)) notice.value = 'Suggestions discarded. Your card is unchanged.'
}

const onSaveEdit = async (payload: Required<UpdateAiMetadataPayload>) => {
  if (await updateAiMetadata(props.card.id, payload)) {
    editing.value = false
    notice.value = 'Catalog details saved.'
  }
}
</script>

<template>
  <AiMetadata
    v-if="!draft && !editing"
    :summary="card.aiSummary"
    :subjects="card.aiSubjects"
    :keywords="card.aiKeywords"
    :status="cataloging ? 'PENDING' : card.aiCatalogStatus"
  >
    <CommonAppAlert v-if="notice" variant="success">{{ notice }}</CommonAppAlert>
    <CommonAppAlert v-if="error" title="Not cataloged">{{ error }}</CommonAppAlert>

    <div class="catalog-actions">
      <CommonAppButton
        v-if="aiAvailable && hasSourceText"
        size="sm"
        :loading="cataloging"
        @click="onCatalog"
      >
        <CommonAppIcon name="sparkle" :size="16" />
        {{ cataloging ? 'Cataloging…' : hasDetails ? 'Suggest new details with Muse' : 'Catalog with Muse' }}
      </CommonAppButton>
      <CommonAppButton variant="secondary" size="sm" :disabled="cataloging" @click="editing = true; notice = null">
        <CommonAppIcon name="pencil" :size="16" />
        {{ hasDetails ? 'Edit details' : 'Add details yourself' }}
      </CommonAppButton>
    </div>
    <p v-if="aiAvailable && hasSourceText" class="catalog-hint">
      Muse reads this card's title and original text, never your notes, and suggests a summary,
      subjects and keywords for you to review.
    </p>
    <p v-else-if="aiAvailable === false" class="catalog-hint">AI cataloging isn't set up on this server.</p>
  </AiMetadata>

  <!-- Reviewing Muse's suggestions -->
  <section v-else-if="draft" class="surface surface--ai review" aria-labelledby="review-heading">
    <header class="review__header">
      <span class="review__icon"><CommonAppIcon name="sparkle" :size="18" /></span>
      <div>
        <p class="eyebrow">AI-generated · needs your review</p>
        <h2 id="review-heading" class="review__title">Suggested by {{ modelLabel }}</h2>
      </div>
    </header>

    <p class="review__text">
      Check and edit these suggestions, then save them to your card. Nothing changes until you save.
    </p>
    <CommonAppAlert v-if="draft.truncated" variant="info">
      This card is long, so Muse cataloged its opening part only.
    </CommonAppAlert>
    <CommonAppAlert v-if="card.visibility === 'PUBLIC'" variant="warning">
      This card is published. Saved details will appear on its public page.
    </CommonAppAlert>
    <CommonAppAlert v-if="error">{{ error }}</CommonAppAlert>

    <AiMetadataEditor
      :key="draft.generatedAt"
      :summary="draft.summary"
      :subjects="draft.subjects"
      :keywords="draft.keywords"
      submit-label="Save to card"
      cancel-label="Discard suggestions"
      :loading="isLoading"
      @save="onSaveDraft"
      @cancel="onDiscard"
    />
    <p class="review__meta mono">
      {{ draft.model }} · <time :datetime="draft.generatedAt">{{ formatDate(draft.generatedAt) }}</time>
    </p>
  </section>

  <!-- Editing the saved details by hand -->
  <section v-else class="surface surface--ai review" aria-labelledby="edit-heading">
    <header class="review__header">
      <span class="review__icon"><CommonAppIcon name="pencil" :size="18" /></span>
      <div>
        <p class="eyebrow">Layer 3 · your edits</p>
        <h2 id="edit-heading" class="review__title">Edit catalog details</h2>
      </div>
    </header>
    <CommonAppAlert v-if="card.visibility === 'PUBLIC'" variant="warning">
      This card is published. Saved details will appear on its public page.
    </CommonAppAlert>
    <CommonAppAlert v-if="error">{{ error }}</CommonAppAlert>
    <AiMetadataEditor
      :summary="card.aiSummary"
      :subjects="card.aiSubjects"
      :keywords="card.aiKeywords"
      :loading="isLoading"
      @save="onSaveEdit"
      @cancel="editing = false"
    />
  </section>
</template>

<style scoped>
.catalog-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.catalog-hint {
  font-size: var(--text-xs);
  line-height: var(--leading-normal);
  color: var(--text-muted);
}
.review {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.review__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.review__icon {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-md);
  background: var(--color-terracotta-strong);
  color: var(--color-ivory);
}
.review__title {
  font-size: var(--text-xl);
}
.review__text {
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}
.review__meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
}
</style>
