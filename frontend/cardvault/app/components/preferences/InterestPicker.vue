<script setup lang="ts">
import {
  MAX_INTEREST_LENGTH,
  MAX_INTERESTS,
  type RecommendationPreferences,
  type RecommendationPriority,
  type SavePreferencesPayload,
  type TopicOption,
} from '~/types/preferences'

/**
 * Interest selection for the welcome onboarding and Settings (REQ-DISC-005, REQ-DISC-007).
 * Topics come from the API (a starter list plus subject headings used on published cards), and
 * the user can add their own. A valid choice is at least one topic, or "Surprise me".
 */
const props = withDefaults(
  defineProps<{
    topics: TopicOption[]
    initial?: RecommendationPreferences | null
    submitLabel: string
    /** Settings also offers the priority between interests and the vault. */
    showPriority?: boolean
    isSaving?: boolean
    error?: string | null
  }>(),
  { initial: null, showPriority: false, isSaving: false, error: null },
)

const emit = defineEmits<{ submit: [payload: SavePreferencesPayload] }>()

const selected = ref<string[]>([...(props.initial?.interests ?? [])])
const surpriseMe = ref(props.initial?.surpriseMe ?? false)
const priority = ref<RecommendationPriority>(props.initial?.priority ?? 'BALANCED')
const custom = ref('')
const customError = ref<string | null>(null)
const choiceError = ref<string | null>(null)

const key = (label: string) => label.trim().toLowerCase()

/** True when the form differs from what was saved, so Settings can say a save is needed. */
const isDirty = computed(() => {
  const initial = props.initial
  const savedTopics = new Set((initial?.interests ?? []).map(key))
  const sameTopics =
    savedTopics.size === selected.value.length && selected.value.every((label) => savedTopics.has(key(label)))
  return (
    !sameTopics ||
    surpriseMe.value !== (initial?.surpriseMe ?? false) ||
    (props.showPriority && priority.value !== (initial?.priority ?? 'BALANCED'))
  )
})
const isSelected = (label: string) => selected.value.some((s) => key(s) === key(label))

const starterTopics = computed(() => props.topics.filter((t) => t.source === 'STARTER'))
const catalogTopics = computed(() => props.topics.filter((t) => t.source === 'CATALOG'))
/** Interests the user typed, or saved earlier, that aren't in the offered lists. */
const ownTopics = computed(() => selected.value.filter((s) => !props.topics.some((t) => key(t.label) === key(s))))

const toggle = (label: string) => {
  choiceError.value = null
  if (isSelected(label)) {
    selected.value = selected.value.filter((s) => key(s) !== key(label))
    return
  }
  if (selected.value.length >= MAX_INTERESTS) {
    choiceError.value = `You can follow up to ${MAX_INTERESTS} topics. Remove one to add another.`
    return
  }
  selected.value = [...selected.value, label]
}

const addCustom = () => {
  customError.value = null
  const label = custom.value.trim().replace(/\s+/g, ' ')
  if (!label) return
  if (label.length > MAX_INTEREST_LENGTH) {
    customError.value = `Keep a topic under ${MAX_INTEREST_LENGTH} characters.`
    return
  }
  if (/[<>]/.test(label)) {
    customError.value = 'Use plain words for a topic.'
    return
  }
  if (!isSelected(label)) toggle(label)
  custom.value = ''
}

watch(surpriseMe, () => {
  choiceError.value = null
})

const onSubmit = () => {
  if (selected.value.length === 0 && !surpriseMe.value) {
    choiceError.value = 'Choose at least one topic, or choose “Surprise me”.'
    return
  }
  emit('submit', {
    interests: selected.value,
    surpriseMe: surpriseMe.value,
    ...(props.showPriority ? { priority: priority.value } : {}),
  })
}

const PRIORITIES: { value: RecommendationPriority; label: string; hint: string }[] = [
  { value: 'BALANCED', label: 'Both equally', hint: 'Mix your topics with cards related to your vault.' },
  { value: 'INTERESTS', label: 'My topics first', hint: 'Lead with the topics chosen above.' },
  { value: 'VAULT', label: 'My vault first', hint: 'Lead with cards related to what you have saved.' },
]
</script>

<template>
  <form class="picker" @submit.prevent="onSubmit">
    <fieldset class="picker__group">
      <legend class="picker__legend">Topics</legend>
      <ul class="picker__chips">
        <li v-for="topic in starterTopics" :key="topic.label">
          <button
            type="button"
            class="chip"
            :aria-pressed="isSelected(topic.label)"
            :title="topic.description ?? undefined"
            @click="toggle(topic.label)"
          >
            <CommonAppIcon v-if="isSelected(topic.label)" name="check" :size="14" />
            {{ topic.label }}
          </button>
        </li>
      </ul>
    </fieldset>

    <fieldset v-if="catalogTopics.length" class="picker__group">
      <legend class="picker__legend">Popular in the Community Catalog</legend>
      <ul class="picker__chips">
        <li v-for="topic in catalogTopics" :key="topic.label">
          <button type="button" class="chip" :aria-pressed="isSelected(topic.label)" @click="toggle(topic.label)">
            <CommonAppIcon v-if="isSelected(topic.label)" name="check" :size="14" />
            {{ topic.label }}
            <span class="chip__count mono">{{ topic.publicCardCount }}</span>
          </button>
        </li>
      </ul>
    </fieldset>

    <div class="picker__group">
      <div class="picker__custom">
        <CommonAppInput
          v-model="custom"
          label="Add your own topic"
          optional
          :maxlength="MAX_INTEREST_LENGTH"
          :error="customError"
          placeholder="e.g. Paleontology"
          @keydown.enter.prevent="addCustom"
        />
        <CommonAppButton variant="secondary" :disabled="!custom.trim()" @click="addCustom">
          <CommonAppIcon name="plus" :size="16" />
          Add
        </CommonAppButton>
      </div>
      <p class="picker__note">
        Your own topics can be up to {{ MAX_INTEREST_LENGTH }} characters of plain text. A card
        matches when all the topic's words appear in one of its subject headings, keywords, title
        or related concepts, in any order, or when its description contains the exact phrase.
      </p>
      <ul v-if="ownTopics.length" class="picker__chips" aria-label="Your own topics">
        <li v-for="label in ownTopics" :key="label">
          <button type="button" class="chip" aria-pressed="true" @click="toggle(label)">
            {{ label }}
            <CommonAppIcon name="close" :size="14" />
            <span class="visually-hidden">Remove</span>
          </button>
        </li>
      </ul>
    </div>

    <label :class="['surprise', { 'surprise--on': surpriseMe }]">
      <input v-model="surpriseMe" type="checkbox" />
      <span class="surprise__icon"><CommonAppIcon name="compass" :size="20" /></span>
      <span>
        <strong>Surprise me</strong> — recommend a variety of topics
        <span class="surprise__hint">
          Home always includes at least one card from outside your topics when there is one;
          Surprise me makes it two. Choose it on its own if you'd rather not pick, and Home shows a
          variety.
        </span>
      </span>
    </label>

    <fieldset v-if="showPriority" class="picker__group">
      <legend class="picker__legend">When both apply, lead with</legend>
      <div class="priority">
        <label v-for="option in PRIORITIES" :key="option.value" class="priority__option">
          <input v-model="priority" type="radio" name="priority" :value="option.value" />
          <span>
            <strong>{{ option.label }}</strong>
            <span class="priority__hint">{{ option.hint }}</span>
          </span>
        </label>
      </div>
    </fieldset>

    <CommonAppAlert v-if="choiceError" variant="warning">{{ choiceError }}</CommonAppAlert>
    <CommonAppAlert v-if="error">{{ error }}</CommonAppAlert>

    <div class="picker__footer">
      <div class="picker__status" aria-live="polite">
        <p class="mono">
          {{ selected.length }} of {{ MAX_INTERESTS }} topics{{ surpriseMe ? ' · Surprise me on' : '' }}
        </p>
        <p v-if="showPriority" :class="['picker__save-note', { 'picker__save-note--dirty': isDirty }]">
          {{ isDirty ? 'Unsaved changes. Nothing changes until you save.' : 'All changes saved.' }}
        </p>
      </div>
      <!-- In Settings there is nothing to save until something changes. -->
      <CommonAppButton type="submit" :loading="isSaving" :disabled="showPriority && !isDirty">
        {{ submitLabel }}
      </CommonAppButton>
    </div>
  </form>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.picker__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  border: 0;
}
.picker__legend {
  margin-bottom: var(--space-3);
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.picker__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  list-style: none;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--control-height-sm);
  padding: 0 var(--space-3);
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-default);
  border-radius: var(--radius-pill);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast);
}
.chip:hover {
  border-color: var(--color-archive-brown);
}
.chip:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.chip[aria-pressed='true'] {
  background: var(--bg-ai);
  border-color: var(--color-terracotta);
  color: var(--color-terracotta-deeper);
  font-weight: var(--weight-medium);
}
.chip__count {
  margin-left: var(--space-1);
}
.picker__custom {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-2);
}
.picker__custom > :first-child {
  flex: 1 1 14rem;
  min-width: 0;
}
.surprise {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--bg-sunken);
  border: var(--border-width) dashed var(--border-default);
  border-radius: var(--radius-lg);
  cursor: pointer;
  line-height: var(--leading-normal);
}
.surprise--on {
  border-style: solid;
  border-color: var(--color-terracotta);
  background: var(--bg-ai);
}
.surprise input {
  margin-top: 0.3rem;
  accent-color: var(--color-terracotta-strong);
}
.surprise__icon {
  color: var(--color-archive-brown);
}
.surprise__hint,
.priority__hint {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-muted);
}
.priority {
  display: grid;
  gap: var(--space-2);
}
.priority__option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-sm);
  cursor: pointer;
}
.priority__option input {
  margin-top: 0.2rem;
  accent-color: var(--color-terracotta-strong);
}
.picker__note {
  font-size: var(--text-xs);
  line-height: var(--leading-normal);
  color: var(--text-muted);
}
.picker__status {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.picker__save-note {
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.picker__save-note--dirty {
  color: var(--warning-text);
  font-weight: var(--weight-medium);
}
.picker__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
</style>
