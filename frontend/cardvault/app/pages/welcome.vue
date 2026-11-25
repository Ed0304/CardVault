<script setup lang="ts">
import type { SavePreferencesPayload } from '~/types/preferences'
import { safeRedirectPath } from '~/utils/navigation'

/**
 * Welcome onboarding (REQ-DISC-004 to REQ-DISC-006). Shown once to signed-in users who have not
 * chosen interests, before any signed-in page; the route guard sends them here and back.
 */
definePageMeta({ layout: 'landing', onboarding: true })

const route = useRoute()
const { user } = useAuth()
const { topics, isLoading, error, isSaving, saveError, load, save } = usePreferences()

onMounted(load)

const onSubmit = async (payload: SavePreferencesPayload) => {
  if (await save(payload)) await navigateTo(safeRedirectPath(route.query.redirect))
}
</script>

<template>
  <div class="welcome page">
    <section class="welcome__card surface" aria-labelledby="welcome-title">
      <header class="welcome__header">
        <p class="eyebrow">Your library card · step 1 of 1</p>
        <h1 id="welcome-title" class="welcome__title">Welcome, {{ user?.username }}!</h1>
        <p class="welcome__lead">Let's personalize your CardVault discovery experience.</p>
        <p class="welcome__question">What topics are you interested in?</p>
        <p class="welcome__hint">
          Pick as many as you like, or let CardVault surprise you. Your choices are private, and you
          can change them any time in Settings.
        </p>
      </header>

      <CommonLoadingState v-if="isLoading" label="Loading topics…" />
      <CommonAppAlert v-else-if="error" title="Topics didn't load">
        {{ error }}
        <CommonAppButton variant="ghost" size="sm" @click="load">Try again</CommonAppButton>
      </CommonAppAlert>
      <PreferencesInterestPicker
        v-else
        :topics="topics"
        submit-label="Open my library"
        :is-saving="isSaving"
        :error="saveError"
        @submit="onSubmit"
      />
    </section>
  </div>
</template>

<style scoped>
.welcome {
  padding-block: var(--space-10);
}
.welcome__card {
  max-width: var(--container-md);
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-6);
  box-shadow: var(--shadow-md);
  border-top: 3px solid var(--color-archive-brown);
}
.welcome__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.welcome__title {
  font-size: var(--text-3xl);
}
.welcome__lead {
  font-size: var(--text-lg);
  color: var(--text-secondary);
}
.welcome__question {
  margin-top: var(--space-3);
  font-family: var(--font-heading);
  font-size: var(--text-xl);
}
.welcome__hint {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

@media (min-width: 40rem) {
  .welcome__card {
    padding: var(--space-8);
  }
}
</style>
