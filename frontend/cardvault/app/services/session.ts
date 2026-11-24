import type { ApiResponse } from './api'
import type { AuthResponse, User } from '~/types/user'

/**
 * Keeps the session alive with the refresh cookie (TASK-AUTH-025).
 *
 * The access cookie (cv_token) lasts 15 minutes. The refresh cookie (cv_refresh) lasts up to
 * 7 days without use and 30 days after login. Both are HttpOnly, so this code never sees the
 * tokens: it only asks the backend to rotate them.
 */

export type RefreshOutcome = 'refreshed' | 'superseded' | 'signed-out'

const SUPERSEDED = 'REFRESH_SUPERSEDED'

const errorCodeOf = (err: unknown): string | undefined =>
  (err as { data?: { error?: { code?: string } } } | null)?.data?.error?.code

const statusOf = (err: unknown): number | undefined => {
  const e = err as { statusCode?: number; status?: number; response?: { status?: number } } | null
  return e?.statusCode ?? e?.status ?? e?.response?.status
}

// One refresh at a time in the browser: requests that fail together share it.
let inFlight: Promise<{ outcome: RefreshOutcome; user: User | null }> | null = null

/**
 * Browser only. Rotates the session cookies. "superseded" means another request (or tab)
 * refreshed at the same moment: the browser already has the new cookies, so callers retry.
 */
export function refreshInBrowser(baseURL: string) {
  inFlight ??= $fetch<ApiResponse<AuthResponse>>('/auth/refresh', {
    baseURL,
    method: 'POST',
    credentials: 'include',
  })
    .then((response) => ({ outcome: 'refreshed' as const, user: response.data.user }))
    .catch((err) => ({
      outcome: errorCodeOf(err) === SUPERSEDED ? ('superseded' as const) : ('signed-out' as const),
      user: null,
    }))
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/**
 * Server only (page render). The browser's access cookie has expired but it sent a refresh
 * cookie: rotate it, pass the new Set-Cookie headers on to the browser with the page, and
 * return the user. The request goes straight to Express, not through this app's /api route,
 * so the backend's Set-Cookie headers can be read and forwarded.
 */
export async function refreshDuringRender(): Promise<User | null> {
  const cookie = useRequestHeaders(['cookie']).cookie ?? ''
  if (!/(?:^|;\s*)cv_refresh=/.test(cookie)) return null

  const event = useRequestEvent()
  const config = useRuntimeConfig()
  const apiBase = String(config.public.apiBase)
  const target = String(config.apiProxyTarget || (import.meta.dev ? 'http://localhost:5000' : ''))
  const base = /^https?:\/\//.test(apiBase) ? apiBase : target ? `${target.replace(/\/+$/, '')}${apiBase}` : ''
  if (!base || !event) return null

  try {
    const res = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { cookie } })
    const { appendResponseHeader } = await import('h3')
    // Success sets new cookies; a real failure clears them. Either way the browser should get them.
    for (const header of res.headers.getSetCookie()) appendResponseHeader(event, 'set-cookie', header)
    if (!res.ok) return null
    const body = (await res.json()) as ApiResponse<AuthResponse>
    return body.data.user
  } catch (err) {
    // The backend could not be reached: render signed out without touching the cookies.
    console.error('[session] refresh during render failed:', statusOf(err) ?? (err as Error)?.message)
    return null
  }
}
