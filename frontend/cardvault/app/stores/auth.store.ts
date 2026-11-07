import type { User } from '~/types/user'

/**
 * Auth state shared across the app.
 * Uses Nuxt's built-in useState (SSR-safe), so no extra state library is needed.
 * The session itself lives in an HttpOnly cookie managed by the Express backend.
 */
export const useAuthStore = () => {
  const user = useState<User | null>('auth:user', () => null)
  const isAuthenticated = computed(() => user.value !== null)

  const setUser = (value: User | null) => {
    user.value = value
  }

  return { user, isAuthenticated, setUser }
}
