import type { AuthResponse, LoginPayload, RegisterPayload, User } from '~/types/user'
import { apiFetch } from './api'

export const authService = {
  register: (payload: RegisterPayload) =>
    apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: { ...payload } }),

  login: (payload: LoginPayload) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { ...payload } }),

  logout: () => apiFetch<null>('/auth/logout', { method: 'POST' }),

  me: async () => (await apiFetch<{ user: User }>('/auth/me')).user,
}
