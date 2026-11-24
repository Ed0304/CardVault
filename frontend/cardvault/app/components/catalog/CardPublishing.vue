<script setup lang="ts">
import type { KnowledgeCard } from '~/types/card'

/**
 * Publish / unpublish controls for the owner's card (REQ-CAT-011).
 * Publishing always goes through a confirmation step that lists what becomes public and asks
 * whether to include the original text, which is off unless the owner ticks it.
 */
const props = defineProps<{ card: KnowledgeCard }>()

// Its own useCatalog instance: loading and errors here must not replace the whole card page.
const { setVisibility, isLoading, error } = useCatalog()

const confirming = ref(false)
const shareSourceText = ref(false)
const notice = ref<string | null>(null)

const isPublic = computed(() => props.card.visibility === 'PUBLIC')
const hasSourceText = computed(() => props.card.sourceText.trim().length > 0)
const sourceLength = computed(() => props.card.sourceText.length.toLocaleString('en-GB'))

const openConfirmation = () => {
  // Re-publishing shows the current choice; a first publication starts with the text unshared.
  shareSourceText.value = isPublic.value && props.card.shareSourceText
  notice.value = null
  confirming.value = true
}

const onPublish = async () => {
  const wasPublic = isPublic.value
  const updated = await setVisibility(props.card.id, {
    visibility: 'PUBLIC',
    shareSourceText: hasSourceText.value && shareSourceText.value,
  })
  if (!updated) return
  confirming.value = false
  notice.value = wasPublic ? 'Sharing updated.' : 'Published. The card is now in the Community Catalog.'
}

const onUnpublish = async () => {
  const ok = window.confirm(
    'Make this card private? It will leave the Community Catalog. Copies that others have already saved stay in their vaults.',
  )
  if (!ok) return
  if (await setVisibility(props.card.id, { visibility: 'PRIVATE' })) {
    notice.value = 'The card is private again.'
  }
}
</script>

<template>
  <section class="surface publishing" aria-labelledby="publishing-heading">
    <header class="publishing__header">
      <span class="publishing__icon">
        <CommonAppIcon :name="isPublic ? 'globe' : 'lock'" :size="18" />
      </span>
      <div>
        <p class="eyebrow">Visibility</p>
        <h2 id="publishing-heading" class="publishing__title">
          {{ isPublic ? 'Published' : 'Private' }}
        </h2>
      </div>
    </header>

    <CommonAppAlert v-if="notice" variant="success">{{ notice }}</CommonAppAlert>
    <CommonAppAlert v-if="error">{{ error }}</CommonAppAlert>

    <!-- Saved copies stay private: the original author's card is the one in the catalog. -->
    <p v-if="card.savedFrom" class="publishing__text">
      This is a copy saved from the Community Catalog. It stays in your vault and can't be
      published, so the original author's card remains the public one.
    </p>

    <form v-else-if="confirming" class="publishing__confirm" @submit.prevent="onPublish">
      <div>
        <h3 class="publishing__label">Becomes public</h3>
        <ul class="publishing__list">
          <li>Title and source link</li>
          <li>Summary, subjects and keywords</li>
          <li>Your username, as the author</li>
          <li v-if="hasSourceText && shareSourceText">The original text</li>
        </ul>
      </div>
      <div>
        <h3 class="publishing__label">Stays private</h3>
        <ul class="publishing__list">
          <li>Your personal notes</li>
          <li>Your collection and tags</li>
          <li v-if="!(hasSourceText && shareSourceText)">The original text</li>
        </ul>
      </div>

      <label v-if="hasSourceText" class="publishing__check">
        <input v-model="shareSourceText" type="checkbox" />
        <span>
          Also share the original text ({{ sourceLength }} characters)
          <span class="publishing__hint">
            Leave this off if the text isn't yours to share. Readers still see the source link.
          </span>
        </span>
      </label>

      <p class="publishing__hint">
        Every signed-in CardVault user can find a published card and save their own copy. Copies
        stay in their vaults even if you make this card private later.
      </p>

      <div class="publishing__actions">
        <CommonAppButton type="submit" :loading="isLoading">
          {{ isPublic ? 'Save sharing choice' : 'Publish card' }}
        </CommonAppButton>
        <CommonAppButton variant="ghost" :disabled="isLoading" @click="confirming = false">
          Cancel
        </CommonAppButton>
      </div>
    </form>

    <template v-else-if="isPublic">
      <p class="publishing__text">
        In the Community Catalog since
        <time :datetime="card.publishedAt ?? undefined">{{ formatDate(card.publishedAt) }}</time>.
        The original text is {{ card.shareSourceText ? 'shared' : 'not shared' }}. Your notes,
        collection and tags stay private.
      </p>
      <div class="publishing__actions">
        <CommonAppButton :to="`/community/${card.id}`" variant="secondary" size="sm">
          <CommonAppIcon name="globe" :size="16" />
          View public card
        </CommonAppButton>
        <CommonAppButton variant="ghost" size="sm" :disabled="isLoading" @click="openConfirmation">
          Change what's shared
        </CommonAppButton>
        <CommonAppButton variant="danger" size="sm" :loading="isLoading" @click="onUnpublish">
          Make private
        </CommonAppButton>
      </div>
    </template>

    <template v-else>
      <p class="publishing__text">
        Only you can see this card. Publish it to share its catalog details in the Community
        Catalog.
      </p>
      <div class="publishing__actions">
        <CommonAppButton variant="secondary" size="sm" @click="openConfirmation">
          <CommonAppIcon name="globe" :size="16" />
          Publish to community…
        </CommonAppButton>
      </div>
    </template>
  </section>
</template>

<style scoped>
.publishing {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.publishing__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.publishing__icon {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-md);
  background: var(--bg-sunken);
  border: var(--border-width) solid var(--border-subtle);
  color: var(--color-archive-brown);
}
.publishing__title {
  font-size: var(--text-xl);
}
.publishing__text {
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}
.publishing__confirm {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.publishing__label {
  margin-bottom: var(--space-1);
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.publishing__list {
  padding-left: var(--space-5);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}
.publishing__check {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-sm);
  cursor: pointer;
}
.publishing__check input {
  margin-top: 0.2rem;
  accent-color: var(--color-terracotta-strong);
}
.publishing__hint {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  line-height: var(--leading-normal);
  color: var(--text-muted);
}
.publishing__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
