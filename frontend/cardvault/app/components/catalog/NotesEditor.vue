<script setup lang="ts">
import type { KnowledgeCard } from '~/types/card'

/**
 * Personal notes editor (TASK-CAT-019, REQ-CAT-005). Saves on its own a moment after the owner
 * stops typing, and when the field loses focus or the page is left. Notes are private: they are
 * never published, copied with a saved card, or sent to Muse.
 *
 * Render it with `:key="card.id"` so moving to another card starts a fresh editor.
 */
const props = defineProps<{ card: KnowledgeCard }>()

// Its own useCatalog instance: saving and errors here must not replace the whole card page.
const { updateNotes, error } = useCatalog()

/** Matches the API limit in `updateNotesSchema`. */
const MAX_NOTES_CHARS = 20_000
const AUTOSAVE_DELAY_MS = 1200

// The card this editor was opened for; a save after leaving still goes to this card.
const cardId = props.card.id
const draft = ref(props.card.notes ?? '')
/** The last value the API confirmed. */
const saved = ref(draft.value)
const isSaving = ref(false)
const savedOnce = ref(false)

const isDirty = computed(() => draft.value !== saved.value)
const tooLong = computed(() => draft.value.length > MAX_NOTES_CHARS)
const lengthError = computed(() =>
  tooLong.value
    ? `Notes can be at most ${MAX_NOTES_CHARS.toLocaleString('en-GB')} characters. Shorten them to save.`
    : null,
)

let timer: ReturnType<typeof setTimeout> | undefined

const save = async () => {
  clearTimeout(timer)
  if (isSaving.value || !isDirty.value || tooLong.value) return
  const value = draft.value
  isSaving.value = true
  const updated = await updateNotes(cardId, value)
  isSaving.value = false
  if (!updated) return
  saved.value = value
  savedOnce.value = true
  // The owner kept typing while the request was in flight.
  if (isDirty.value) schedule()
}

const schedule = () => {
  clearTimeout(timer)
  timer = setTimeout(save, AUTOSAVE_DELAY_MS)
}

watch(draft, () => {
  if (isDirty.value) schedule()
})

const status = computed(() => {
  if (isSaving.value) return 'Saving…'
  if (tooLong.value || error.value) return ''
  if (isDirty.value) return 'Unsaved changes'
  return savedOnce.value ? 'Saved' : ''
})

// Warn before closing the tab while an edit hasn't reached the server.
const onBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!isDirty.value && !isSaving.value) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  // Leaving the card inside the app: send the last edit instead of dropping it.
  void save()
})
</script>

<template>
  <section class="surface surface--sunken notes" aria-labelledby="notes-heading">
    <header class="notes__header">
      <span class="notes__icon"><CommonAppIcon name="pencil" :size="18" /></span>
      <div>
        <p class="eyebrow">Yours · always private</p>
        <h2 id="notes-heading" class="notes__title">Personal notes</h2>
      </div>
    </header>

    <CommonAppInput
      v-model="draft"
      label="Your notes"
      multiline
      :error="lengthError"
      hint="Only you can see these. They're never published, copied, or sent to Muse."
      placeholder="Your observations, questions, and where this fits in your work…"
      @blur="save"
    />

    <CommonAppAlert v-if="error && !tooLong">
      {{ error }}
      <CommonAppButton variant="ghost" size="sm" :disabled="isSaving" @click="save">Try again</CommonAppButton>
    </CommonAppAlert>

    <p class="notes__status mono" aria-live="polite">
      <span>{{ status }}</span>
      <span :class="{ 'notes__count--over': tooLong }">
        {{ draft.length.toLocaleString('en-GB') }} / {{ MAX_NOTES_CHARS.toLocaleString('en-GB') }}
      </span>
    </p>
  </section>
</template>

<style scoped>
.notes {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.notes__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.notes__icon {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-subtle);
  color: var(--color-archive-brown);
}
.notes__title {
  font-size: var(--text-xl);
}
.notes__status {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 1.25rem;
  font-size: var(--text-xs);
  color: var(--text-muted);
}
.notes__count--over {
  color: var(--error-text);
}
</style>
