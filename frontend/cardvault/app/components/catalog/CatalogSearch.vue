<script setup lang="ts">
import type { SearchMode } from '~/types/card'

withDefaults(
  defineProps<{
    label?: string
    /** The search-mode selector applies to the vault search only. */
    showModes?: boolean
  }>(),
  { label: 'Search your catalog', showModes: true },
)

const query = defineModel<string>({ default: '' })
const mode = ref<SearchMode>('auto')
const inputId = `catalog-search-${useId()}`

const emit = defineEmits<{ search: [query: string, mode: SearchMode] }>()
</script>

<template>
  <form class="catalog-search" role="search" @submit.prevent="emit('search', query, mode)">
    <div class="catalog-search__field">
      <label :for="inputId" class="visually-hidden">{{ label }}</label>
      <CommonAppIcon name="search" :size="18" class="catalog-search__icon" />
      <input
        :id="inputId"
        v-model="query"
        class="catalog-search__input"
        type="search"
        :placeholder="label"
        maxlength="500"
        autocomplete="off"
      />
    </div>

    <div v-if="showModes" class="catalog-search__mode">
      <label for="catalog-search-mode" class="visually-hidden">Search mode</label>
      <select id="catalog-search-mode" v-model="mode" class="catalog-search__select">
        <option value="auto">Auto</option>
        <option value="semantic">Semantic</option>
        <option value="keyword">Keyword</option>
      </select>
    </div>

    <CommonAppButton type="submit" class="catalog-search__submit">Search</CommonAppButton>
  </form>
</template>

<style scoped>
.catalog-search {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.catalog-search__field {
  position: relative;
  flex: 1 1 14rem;
  min-width: 0;
}
.catalog-search__icon {
  position: absolute;
  top: 50%;
  left: var(--space-3);
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
.catalog-search__input,
.catalog-search__select {
  width: 100%;
  min-height: var(--control-height);
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-control);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-base);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}
.catalog-search__input {
  padding: 0 var(--space-3) 0 calc(var(--space-3) + 1.6rem);
}
.catalog-search__select {
  padding: 0 var(--space-3);
  cursor: pointer;
}
.catalog-search__input::placeholder {
  color: var(--text-muted);
  opacity: 1;
}
.catalog-search__input:hover,
.catalog-search__select:hover {
  border-color: var(--color-archive-brown);
}
.catalog-search__input:focus-visible,
.catalog-search__select:focus-visible {
  outline: none;
  border-color: var(--focus-color);
  box-shadow: var(--focus-ring);
}
.catalog-search__mode {
  flex: 0 0 auto;
}

@media (max-width: 39.99rem) {
  .catalog-search__mode {
    flex: 1 1 8rem;
  }
  .catalog-search__submit {
    flex: 1 1 8rem;
  }
}
</style>
