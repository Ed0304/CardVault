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

/**
 * Thin wrapper around $fetch for the Express API.
 * Unwraps the { data, error, message } envelope and returns `data`.
 */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const config = useRuntimeConfig()
  const baseURL = (config.public.apiBase as string | undefined) ?? 'http://localhost:4000/api'

  // During SSR there is no browser to attach cookies, so forward the incoming ones.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  const response = await $fetch<ApiResponse<T>>(path, {
    baseURL,
    credentials: 'include',
    headers,
    ...options,
  })

  return response.data
}
