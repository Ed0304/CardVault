<script setup lang="ts">
import type { UpdateAiMetadataPayload } from '~/types/card'

/**
 * Editable summary, subjects and keywords. Used to review Muse's suggestions before saving them,
 * and to edit the saved catalog details. Limits match the API (2,000 characters; 5 subjects;
 * 15 keywords; 100 characters per label).
 */
const props = withDefaults(
  defineProps<{
    summary: string | null
    subjects: string[]
    keywords: string[]
    submitLabel?: string
    cancelLabel?: string
    loading?: boolean
  }>(),
  { submitLabel: 'Save details', cancelLabel: 'Cancel', loading: false },
)

const emit = defineEmits<{ save: [payload: Required<UpdateAiMetadataPayload>]; cancel: [] }>()

const summary = ref(props.summary ?? '')
const subjects = ref(props.subjects.join(', '))
const keywords = ref(props.keywords.join(', '))

/** Splits a comma-separated list, trims it and drops empty and repeated entries. */
const parseList = (value: string) => {
  const seen = new Set<string>()
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item && !seen.has(item.toLowerCase()) && seen.add(item.toLowerCase()))
}

const parsedSubjects = computed(() => parseList(subjects.value))
const parsedKeywords = computed(() => parseList(keywords.value))

const listError = (items: string[], max: number, noun: string) => {
  if (items.length > max) return `Use at most ${max} ${noun}.`
  if (items.some((item) => item.length > 100)) return `Each entry must be at most 100 characters.`
  return null
}
const summaryError = computed(() =>
  summary.value.trim().length > 2000 ? 'The summary must be at most 2,000 characters.' : null,
)
const subjectsError = computed(() => listError(parsedSubjects.value, 5, 'subjects'))
const keywordsError = computed(() => listError(parsedKeywords.value, 15, 'keywords'))
const isValid = computed(() => !summaryError.value && !subjectsError.value && !keywordsError.value)

const onSubmit = () => {
  if (!isValid.value) return
  emit('save', {
    aiSummary: summary.value.trim() || null,
    aiSubjects: parsedSubjects.value,
    aiKeywords: parsedKeywords.value,
  })
}
</script>

<template>
  <form class="ai-editor" novalidate @submit.prevent="onSubmit">
    <CommonAppInput
      v-model="summary"
      label="Summary"
      multiline
      rows="5"
      :error="summaryError"
    />
    <CommonAppInput
      v-model="subjects"
      label="Subjects"
      hint="Up to 5, separated by commas."
      :error="subjectsError"
    />
    <CommonAppInput
      v-model="keywords"
      label="Keywords"
      hint="Up to 15, separated by commas."
      :error="keywordsError"
    />
    <div class="ai-editor__actions">
      <CommonAppButton type="submit" size="sm" :loading="loading" :disabled="!isValid">
        {{ submitLabel }}
      </CommonAppButton>
      <CommonAppButton variant="ghost" size="sm" :disabled="loading" @click="emit('cancel')">
        {{ cancelLabel }}
      </CommonAppButton>
    </div>
  </form>
</template>

<style scoped>
.ai-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.ai-editor :deep(.field__control--multiline) {
  min-height: 8rem;
}
.ai-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
