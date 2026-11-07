<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    label: string
    id?: string
    type?: string
    hint?: string
    error?: string | null
    optional?: boolean
    multiline?: boolean
  }>(),
  { type: 'text', optional: false, multiline: false },
)

const autoId = useId()
const inputId = computed(() => props.id ?? `field-${autoId}`)
const hintId = computed(() => `${inputId.value}-hint`)
const errorId = computed(() => `${inputId.value}-error`)
const describedBy = computed(
  () =>
    [props.hint ? hintId.value : null, props.error ? errorId.value : null]
      .filter(Boolean)
      .join(' ') || undefined,
)
</script>

<template>
  <div :class="['field', { 'field--error': !!error }]">
    <label :for="inputId" class="field__label">
      {{ label }}
      <span v-if="optional" class="field__optional">(optional)</span>
    </label>

    <textarea
      v-if="multiline"
      :id="inputId"
      v-model="model"
      class="field__control field__control--multiline"
      :aria-invalid="!!error || undefined"
      :aria-describedby="describedBy"
      v-bind="$attrs"
    />
    <input
      v-else
      :id="inputId"
      v-model="model"
      class="field__control"
      :type="type"
      :aria-invalid="!!error || undefined"
      :aria-describedby="describedBy"
      v-bind="$attrs"
    />

    <p v-if="hint" :id="hintId" class="field__hint">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="field__error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.field__label {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--text-primary);
}
.field__optional {
  font-weight: var(--weight-regular);
  color: var(--text-muted);
}
.field__control {
  width: 100%;
  min-height: var(--control-height);
  padding: 0 var(--space-3);
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-control);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-base);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}
.field__control--multiline {
  min-height: 12rem;
  padding: var(--space-3);
  line-height: var(--leading-relaxed);
  resize: vertical;
}
.field__control::placeholder {
  color: var(--text-muted);
  opacity: 1;
}
.field__control:hover:not(:disabled) {
  border-color: var(--color-archive-brown);
}
.field__control:focus-visible {
  outline: none;
  border-color: var(--focus-color);
  box-shadow: var(--focus-ring);
}
.field__control:disabled {
  background: var(--disabled-bg);
  color: var(--disabled-text);
  cursor: not-allowed;
}
.field--error .field__control {
  border-color: var(--error-text);
}
.field__hint {
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.field__error {
  font-size: var(--text-sm);
  color: var(--error-text);
}
</style>
