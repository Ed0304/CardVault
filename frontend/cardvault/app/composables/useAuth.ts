import { getApiStatus } from '~/services/api'
import { authService } from '~/services/auth.service'
import { refreshDuringRender, refreshInBrowser } from '~/services/session'
import { useAuthStore } from '~/stores/auth.store'
import type { LoginPayload, RegisterPayload } from '~/types/user'

export const useAuth = () => {
  const { user, isAuthenticated, setUser } = useAuthStore()

  const fetchUser = async () => {
    try {
      setUser(await authService.me())
    } catch {
      setUser(null)
    }
  }

  /**
   * Signs the user back in on page load. Uses the access cookie if it is still valid, and
   * otherwise the refresh cookie (sessions last up to 7 days without use, 30 days at most).
   */
  const restoreSession = async () => {
    // Captured before the first await: on the server, Nuxt's composable context does not
    // survive an await, and the refresh step needs the request (cookies, response headers).
    const nuxtApp = useNuxtApp()
    const apiBase = String(useRuntimeConfig().public.apiBase)
    try {
      setUser(await authService.me())
      return
    } catch (err) {
      if (getApiStatus(err) !== 401) {
        // The backend could not be reached; render signed out rather than fail the page.
        setUser(null)
        return
      }
    }

    if (import.meta.server) {
      setUser(await nuxtApp.runWithContext(() => refreshDuringRender()))
      return
    }
    const { outcome, user: refreshed } = await refreshInBrowser(apiBase)
    if (outcome === 'refreshed') setUser(refreshed)
    else if (outcome === 'superseded') await fetchUser()
    else setUser(null)
  }

  const login = async (payload: LoginPayload) => {
    setUser((await authService.login(payload)).user)
  }

  const register = async (payload: RegisterPayload) => {
    setUser((await authService.register(payload)).user)
  }

  const logout = async () => {
    await authService.logout()
    setUser(null)
    await navigateTo('/login')
  }

  return { user, isAuthenticated, fetchUser, restoreSession, login, register, logout }
}
