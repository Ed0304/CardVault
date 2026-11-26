<script setup lang="ts">
/**
 * The original source text of a card, kept exactly as saved. Long texts start collapsed to a
 * preview so the catalog entry above stays easy to reach; the full text is one click away.
 * When there is no text (a Community copy whose author didn't share it), says so and points to
 * the source link, if there is one.
 */
const props = withDefaults(
  defineProps<{
    text: string | null
    sourceUrl?: string | null
    /** Why there is no text, in a sentence. */
    unavailableReason?: string
  }>(),
  { sourceUrl: null, unavailableReason: 'No source text was saved with this card.' },
)

/** Texts longer than this many characters start collapsed. */
const PREVIEW_CHARS = 1500

const id = `source-text-${useId()}`
const expanded = ref(false)
const hasText = computed(() => Boolean(props.text?.trim()))
const isLong = computed(() => (props.text?.length ?? 0) > PREVIEW_CHARS)
const length = computed(() => (props.text?.length ?? 0).toLocaleString('en-GB'))
const shown = computed(() => {
  const text = props.text ?? ''
  if (!isLong.value || expanded.value) return text
  // Cut at a word boundary near the preview length.
  const cut = text.lastIndexOf(' ', PREVIEW_CHARS)
  return `${text.slice(0, cut > PREVIEW_CHARS * 0.8 ? cut : PREVIEW_CHARS).trimEnd()}…`
})
</script>

<template>
  <div v-if="hasText" class="source-text">
    <p :id="id" class="source-text__body">{{ shown }}</p>
    <p v-if="isLong && !expanded" class="mono">Preview · {{ length }} characters in full</p>
    <CommonAppButton
      v-if="isLong"
      variant="ghost"
      size="sm"
      :aria-expanded="expanded"
      :aria-controls="id"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'Show less' : 'Show full text' }}
    </CommonAppButton>
  </div>
  <div v-else class="source-text__missing">
    <CommonAppIcon name="info" :size="18" />
    <p>
      {{ unavailableReason }}
      <template v-if="sourceUrl">
        To read the original,
        <a :href="sourceUrl" rel="noopener noreferrer nofollow" target="_blank">visit the source</a>.
      </template>
    </p>
  </div>
</template>

<style scoped>
.source-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}
/* Long-form reading text: serif, generous leading, capped measure */
.source-text__body {
  max-width: 68ch;
  font-family: var(--font-heading);
  font-size: var(--text-lg);
  line-height: var(--leading-relaxed);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.source-text__missing {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-sunken);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}
.source-text__missing :deep(.app-icon) {
  flex-shrink: 0;
  margin-top: 0.1rem;
  color: var(--color-archive-brown);
}
</style>
