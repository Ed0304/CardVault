export interface ApiResponse<T> {
  data: T
  error: string | null
  message: string
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
  query?: Record<string, string | number | undefined>
}

/**
 * Thin wrapper around $fetch for the Express API.
 * Unwraps the { data, error, message } envelope and returns `data`.
 */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const config = useRuntimeConfig()
  const baseURL = (config.public.apiBase as string | undefined) ?? 'http://localhost:4000/api'

  const response = await $fetch<ApiResponse<T>>(path, {
    baseURL,
    credentials: 'include',
    ...options,
  })

  return response.data
}
