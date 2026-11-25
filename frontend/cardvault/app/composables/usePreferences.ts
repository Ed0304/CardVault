import { describeApiError } from '~/services/api'
import { preferencesService } from '~/services/preferences.service'
import { useAuthStore } from '~/stores/auth.store'
import type { RecommendationPreferences, SavePreferencesPayload, TopicOption } from '~/types/preferences'

/** Recommendation preferences for the welcome onboarding and Settings. */
export const usePreferences = () => {
  const preferences = ref<RecommendationPreferences | null>(null)
  const topics = ref<TopicOption[]>([])
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<string | null>(null)
  const saveError = ref<string | null>(null)

  /** Loads the topic choices and the current preferences together. */
  const load = async () => {
    isLoading.value = true
    error.value = null
    try {
      const [current, options] = await Promise.all([preferencesService.get(), preferencesService.topics()])
      preferences.value = current
      topics.value = options
    } catch (e) {
      error.value = describeApiError(e, { fallback: "Your preferences couldn't be loaded. Please try again." })
    } finally {
      isLoading.value = false
    }
  }

  /** Saves the preferences. The first save completes onboarding for this session too. */
  const save = async (payload: SavePreferencesPayload) => {
    isSaving.value = true
    saveError.value = null
    try {
      preferences.value = await preferencesService.save(payload)
      const { user, setUser } = useAuthStore()
      if (user.value && !user.value.onboardingCompleted) setUser({ ...user.value, onboardingCompleted: true })
      return preferences.value
    } catch (e) {
      saveError.value = describeApiError(e, { fallback: "Your preferences couldn't be saved. Please try again." })
      return undefined
    } finally {
      isSaving.value = false
    }
  }

  return { preferences, topics, isLoading, isSaving, error, saveError, load, save }
}
