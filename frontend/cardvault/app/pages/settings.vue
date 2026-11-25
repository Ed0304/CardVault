<script setup lang="ts">
import type { SavePreferencesPayload } from '~/types/preferences'

/** Settings: edit recommendation preferences at any time (REQ-DISC-007). */
const { preferences, topics, isLoading, error, isSaving, saveError, load, save } = usePreferences()

const notice = ref<string | null>(null)
// Re-created after each save, so the form starts from what was stored.
const formKey = ref(0)

onMounted(load)

const onSubmit = async (payload: SavePreferencesPayload) => {
  notice.value = null
  if (await save(payload)) {
    notice.value = 'Saved. Your next recommendations will use these choices.'
    formKey.value++
  }
}
</script>

<template>
  <section>
    <CommonPageHeading
      title="Settings"
      eyebrow="Your account"
      description="Choose what CardVault recommends on your home page. These choices are private to you."
    />

    <section class="surface settings" aria-labelledby="interests-heading">
      <header class="settings__header">
        <span class="settings__icon"><CommonAppIcon name="sparkle" :size="18" /></span>
        <div>
          <p class="eyebrow">Recommendations</p>
          <h2 id="interests-heading" class="settings__title">Your interests</h2>
        </div>
      </header>

      <CommonAppAlert v-if="notice" variant="success">{{ notice }}</CommonAppAlert>
      <CommonLoadingState v-if="isLoading" label="Loading your preferences…" />
      <CommonAppAlert v-else-if="error" title="Preferences didn't load">
        {{ error }}
        <CommonAppButton variant="ghost" size="sm" @click="load">Try again</CommonAppButton>
      </CommonAppAlert>
      <PreferencesInterestPicker
        v-else
        :key="formKey"
        :topics="topics"
        :initial="preferences"
        submit-label="Save preferences"
        show-priority
        :is-saving="isSaving"
        :error="saveError"
        @submit="onSubmit"
      />
    </section>
  </section>
</template>

<style scoped>
.settings {
  max-width: var(--container-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.settings__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.settings__icon {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-md);
  background: var(--bg-sunken);
  border: var(--border-width) solid var(--border-subtle);
  color: var(--color-archive-brown);
}
.settings__title {
  font-size: var(--text-xl);
}
</style>
