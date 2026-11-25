import type { RecommendationPreferences, SavePreferencesPayload, TopicOption } from '~/types/preferences'
import { apiFetch } from './api'

export const preferencesService = {
  /** Null until the user completes the welcome onboarding. */
  get: async () =>
    (await apiFetch<{ preferences: RecommendationPreferences | null }>('/preferences')).preferences,

  save: async (payload: SavePreferencesPayload) =>
    (
      await apiFetch<{ preferences: RecommendationPreferences }>('/preferences', {
        method: 'PUT',
        body: { ...payload },
      })
    ).preferences,

  topics: async () => (await apiFetch<{ topics: TopicOption[] }>('/preferences/topics')).topics,
}
