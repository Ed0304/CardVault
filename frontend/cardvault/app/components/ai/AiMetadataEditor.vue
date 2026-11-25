<script setup lang="ts">
import type { CatalogFact, RelatedConcept, UpdateAiMetadataPayload } from '~/types/card'

/**
 * Editable catalog entry: title, description, facts, subject headings, keywords and related
 * concepts. Used to review Muse's suggestions before saving them, and to edit the saved entry.
 * Limits match the API: title 200 characters; description 2,000; 8 facts (label 60, value 200);
 * 5 headings; 15 keywords (100 each); 8 related concepts (name 100, relation 60).
 */
const props = withDefaults(
  defineProps<{
    catalogTitle: string | null
    /** Shown as the placeholder: what the card displays when the title is left empty. */
    sourceTitle?: string | null
    summary: string | null
    facts: CatalogFact[]
    subjects: string[]
    keywords: string[]
    related: RelatedConcept[]
    submitLabel?: string
    cancelLabel?: string
    loading?: boolean
  }>(),
  { sourceTitle: null, submitLabel: 'Save details', cancelLabel: 'Cancel', loading: false },
)

const emit = defineEmits<{ save: [payload: Required<UpdateAiMetadataPayload>]; cancel: [] }>()

const MAX_FACTS = 8
const MAX_RELATED = 8

const title = ref(props.catalogTitle ?? '')
const summary = ref(props.summary ?? '')
const subjects = ref(props.subjects.join(', '))
const keywords = ref(props.keywords.join(', '))
const facts = ref(props.facts.map((f) => ({ label: f.label, value: f.value })))
const related = ref(props.related.map((r) => ({ name: r.name, relation: r.relation })))

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
/** Rows with both parts filled in; half-filled rows are reported, fully empty ones ignored. */
const filledFacts = computed(() =>
  facts.value.map((f) => ({ label: f.label.trim(), value: f.value.trim() })).filter((f) => f.label || f.value),
)
const filledRelated = computed(() =>
  related.value.map((r) => ({ name: r.name.trim(), relation: r.relation.trim() })).filter((r) => r.name || r.relation),
)

const listError = (items: string[], max: number, noun: string) => {
  if (items.length > max) return `Use at most ${max} ${noun}.`
  if (items.some((item) => item.length > 100)) return 'Each entry must be at most 100 characters.'
  return null
}
const titleError = computed(() => (title.value.trim().length > 200 ? 'The title must be at most 200 characters.' : null))
const summaryError = computed(() =>
  summary.value.trim().length > 2000 ? 'The description must be at most 2,000 characters.' : null,
)
const subjectsError = computed(() => listError(parsedSubjects.value, 5, 'subject headings'))
const keywordsError = computed(() => listError(parsedKeywords.value, 15, 'keywords'))
const factsError = computed(() => {
  if (filledFacts.value.some((f) => !f.label || !f.value)) return 'Each fact needs both a label and a value.'
  if (filledFacts.value.some((f) => f.label.length > 60 || f.value.length > 200))
    return 'Labels can be 60 characters and values 200.'
  return null
})
const relatedError = computed(() => {
  if (filledRelated.value.some((r) => !r.name || !r.relation)) return 'Each related concept needs a name and a relation.'
  if (filledRelated.value.some((r) => r.name.length > 100 || r.relation.length > 60))
    return 'Names can be 100 characters and relations 60.'
  return null
})
const isValid = computed(
  () =>
    !titleError.value &&
    !summaryError.value &&
    !subjectsError.value &&
    !keywordsError.value &&
    !factsError.value &&
    !relatedError.value,
)

const onSubmit = () => {
  if (!isValid.value) return
  emit('save', {
    catalogTitle: title.value.trim() || null,
    aiSummary: summary.value.trim() || null,
    aiFacts: filledFacts.value,
    aiSubjects: parsedSubjects.value,
    aiKeywords: parsedKeywords.value,
    aiRelated: filledRelated.value,
  })
}

const idBase = `catalog-editor-${useId()}`
</script>

<template>
  <form class="ai-editor" novalidate @submit.prevent="onSubmit">
    <CommonAppInput
      v-model="title"
      label="Catalog title"
      maxlength="200"
      :placeholder="sourceTitle ?? 'Untitled'"
      hint="The name of the card's subject. Leave empty to use the source's title."
      :error="titleError"
    />
    <CommonAppInput v-model="summary" label="Description" multiline rows="4" :error="summaryError" />

    <fieldset class="ai-editor__rows" :aria-describedby="factsError ? `${idBase}-facts-error` : undefined">
      <legend class="ai-editor__legend">Facts <span class="ai-editor__hint">(up to {{ MAX_FACTS }})</span></legend>
      <div v-for="(fact, index) in facts" :key="index" class="ai-editor__row">
        <input v-model="fact.label" class="ai-editor__control" maxlength="60" placeholder="Label, e.g. Author" :aria-label="`Fact ${index + 1} label`" />
        <input v-model="fact.value" class="ai-editor__control" maxlength="200" placeholder="Value" :aria-label="`Fact ${index + 1} value`" />
        <button type="button" class="ai-editor__remove" :aria-label="`Remove fact ${index + 1}`" @click="facts.splice(index, 1)">
          <CommonAppIcon name="close" :size="16" />
        </button>
      </div>
      <CommonAppButton
        v-if="facts.length < MAX_FACTS"
        variant="ghost"
        size="sm"
        @click="facts.push({ label: '', value: '' })"
      >
        <CommonAppIcon name="plus" :size="16" />
        Add fact
      </CommonAppButton>
      <p v-if="factsError" :id="`${idBase}-facts-error`" class="ai-editor__error" role="alert">{{ factsError }}</p>
    </fieldset>

    <CommonAppInput
      v-model="subjects"
      label="Subject headings"
      hint="Up to 5, most specific first, separated by commas."
      :error="subjectsError"
    />
    <CommonAppInput v-model="keywords" label="Keywords" hint="Up to 15, separated by commas." :error="keywordsError" />

    <fieldset class="ai-editor__rows" :aria-describedby="relatedError ? `${idBase}-related-error` : undefined">
      <legend class="ai-editor__legend">
        Related concepts <span class="ai-editor__hint">(up to {{ MAX_RELATED }})</span>
      </legend>
      <div v-for="(concept, index) in related" :key="index" class="ai-editor__row">
        <input v-model="concept.name" class="ai-editor__control" maxlength="100" placeholder="Name" :aria-label="`Related concept ${index + 1} name`" />
        <input v-model="concept.relation" class="ai-editor__control" maxlength="60" placeholder="Relation, e.g. Successor" :aria-label="`Related concept ${index + 1} relation`" />
        <button type="button" class="ai-editor__remove" :aria-label="`Remove related concept ${index + 1}`" @click="related.splice(index, 1)">
          <CommonAppIcon name="close" :size="16" />
        </button>
      </div>
      <CommonAppButton
        v-if="related.length < MAX_RELATED"
        variant="ghost"
        size="sm"
        @click="related.push({ name: '', relation: '' })"
      >
        <CommonAppIcon name="plus" :size="16" />
        Add related concept
      </CommonAppButton>
      <p v-if="relatedError" :id="`${idBase}-related-error`" class="ai-editor__error" role="alert">{{ relatedError }}</p>
    </fieldset>

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
  min-height: 7rem;
}
.ai-editor__rows {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.ai-editor__legend {
  margin-bottom: var(--space-1);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}
.ai-editor__hint {
  font-weight: var(--weight-regular);
  color: var(--text-muted);
}
.ai-editor__row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr) auto;
  gap: var(--space-2);
  width: 100%;
}
.ai-editor__control {
  width: 100%;
  min-height: var(--control-height-sm);
  padding: 0 var(--space-3);
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-control);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
}
.ai-editor__control:focus-visible {
  outline: none;
  border-color: var(--focus-color);
  box-shadow: var(--focus-ring);
}
.ai-editor__remove {
  display: grid;
  place-items: center;
  width: var(--control-height-sm);
  height: var(--control-height-sm);
  padding: 0;
  background: transparent;
  border: var(--border-width) solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
}
.ai-editor__remove:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.ai-editor__error {
  font-size: var(--text-sm);
  color: var(--error-text);
}
.ai-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
