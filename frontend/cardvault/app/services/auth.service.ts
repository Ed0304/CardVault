import type { LoginPayload, RegisterPayload, User } from '~/types/user'
import { apiFetch } from './api'

export const authService = {
  register: (payload: RegisterPayload) =>
    apiFetch<User>('/auth/register', { method: 'POST', body: { ...payload } }),

  login: (payload: LoginPayload) =>
    apiFetch<User>('/auth/login', { method: 'POST', body: { ...payload } }),

  logout: () => apiFetch<null>('/auth/logout', { method: 'POST' }),

  me: () => apiFetch<User>('/auth/me'),
}
