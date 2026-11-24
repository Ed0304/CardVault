import { useAuthStore } from '~/stores/auth.store'
import { refreshInBrowser } from './session'

export interface ApiResponse<T> {
  data: T
  error: { code: string; details?: { field: string; message: string }[] } | null
  message: string
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
  query?: Record<string, string | number | undefined>
}

/**
 * Extracts a readable message from a failed API call, preferring the first
 * field-level validation detail, then the envelope message, then `fallback`.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  const body = (err as { data?: Partial<ApiResponse<null>> } | null)?.data
  const detail = body?.error?.details?.[0]
  if (detail) return `${detail.field} ${detail.message}`
  return body?.message ?? fallback
}

/** The envelope's error code of a failed API call (for example "CARD_ALREADY_SAVED"). */
export function getApiErrorCode(err: unknown): string | undefined {
  return (err as { data?: Partial<ApiResponse<null>> } | null)?.data?.error?.code
}

/** HTTP status of a failed API call, or undefined when the server was not reached at all. */
export function getApiStatus(err: unknown): number | undefined {
  const e = err as { statusCode?: number; status?: number; response?: { status?: number } } | null
  return e?.statusCode ?? e?.status ?? e?.response?.status
}

export interface ApiErrorMessages {
  /** Shown when the resource or endpoint does not exist (HTTP 404). */
  notFound?: string
  /** Shown for any other failure without a more specific message. */
  fallback: string
}

/**
 * Turns a failed API call into a sentence for the UI. Raw details such as
 * `[GET] "/api/cards": 404` are never shown to users.
 */
export function describeApiError(err: unknown, messages: ApiErrorMessages): string {
  const status = getApiStatus(err)
  if (status === undefined || status >= 500) {
    return "CardVault couldn't reach the server. Please try again in a moment."
  }
  if (status === 401) return 'Your session has ended. Please log in again.'
  if (status === 404) return messages.notFound ?? messages.fallback
  return getApiErrorMessage(err, messages.fallback)
}

/**
 * Thin wrapper around $fetch for the Express API.
 * Unwraps the { data, error, message } envelope and returns `data`.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiOptions = {},
  isRetry = false,
): Promise<T> {
  const nuxtApp = useNuxtApp()
  const config = useRuntimeConfig()
  const baseURL = (config.public.apiBase as string | undefined) ?? 'http://localhost:4000/api'

  // During SSR there is no browser to attach cookies, so forward the incoming ones.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  try {
    const response = await $fetch<ApiResponse<T>>(path, {
      baseURL,
      credentials: 'include',
      headers,
      ...options,
    })
    return response.data
  } catch (err) {
    // A 401 from a protected endpoint means the 15-minute access cookie expired. In the browser,
    // use the refresh cookie once and retry the request. Only if that fails is the user signed
    // out and sent to log in, then back to where they were. Auth endpoints are excluded: their
    // 401s are handled by the login form and by restoreSession.
    if (getApiStatus(err) === 401 && !path.startsWith('/auth/')) {
      if (import.meta.client && !isRetry) {
        const { outcome, user } = await refreshInBrowser(baseURL)
        if (outcome !== 'signed-out') {
          if (user) nuxtApp.runWithContext(() => useAuthStore().setUser(user))
          return apiFetch<T>(path, options, true)
        }
      }
      await nuxtApp.runWithContext(async () => {
        useAuthStore().setUser(null)
        if (import.meta.client) {
          const route = useRoute()
          await navigateTo({ path: '/login', query: { redirect: route.fullPath } })
        }
      })
    }
    throw err
  }
}
