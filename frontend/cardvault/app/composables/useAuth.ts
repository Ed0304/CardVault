import { authService } from '~/services/auth.service'
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

  const login = async (payload: LoginPayload) => {
    setUser(await authService.login(payload))
  }

  const register = async (payload: RegisterPayload) => {
    setUser(await authService.register(payload))
  }

  const logout = async () => {
    await authService.logout()
    setUser(null)
    await navigateTo('/login')
  }

  return { user, isAuthenticated, fetchUser, login, register, logout }
}
