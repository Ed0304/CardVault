import { describeApiError, getApiErrorCode } from '~/services/api'
import { recommendationsService } from '~/services/recommendations.service'
import { useAuthStore } from '~/stores/auth.store'
import type { RecommendationShelf } from '~/types/recommendation'

/** "Recommended for today" on the personal home page. */
export const useRecommendations = () => {
  const shelf = ref<RecommendationShelf | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const fetchToday = async () => {
    isLoading.value = true
    error.value = null
    try {
      shelf.value = await recommendationsService.today()
    } catch (e) {
      // The session said onboarding was done but no preferences exist (removed, or a stale
      // session): mark it undone so the route guard allows the onboarding page, and go there.
      if (getApiErrorCode(e) === 'ONBOARDING_REQUIRED') {
        const { user, setUser } = useAuthStore()
        if (user.value) setUser({ ...user.value, onboardingCompleted: false })
        await navigateTo({ path: '/welcome', query: { redirect: '/home' } })
        return
      }
      error.value = describeApiError(e, { fallback: "Today's recommendations couldn't be loaded. Please try again." })
    } finally {
      isLoading.value = false
    }
  }

  return { shelf, isLoading, error, fetchToday }
}
