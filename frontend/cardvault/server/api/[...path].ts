/**
 * Same-origin proxy: forwards /api/** to the Express backend.
 *
 * Used when the browser must talk to a single origin (for example on Railway, where the
 * frontend and backend run on different *.up.railway.app sites and a SameSite=Lax auth
 * cookie would not be sent across them). The browser calls this origin, and this handler
 * relays the request, including the Cookie header and any Set-Cookie response, to Express.
 *
 * Enabled by setting NUXT_PUBLIC_API_BASE=/api. Without that, the client calls Express
 * directly (local development) and this route is not used.
 *
 * The target comes from NUXT_API_PROXY_TARGET (server-only runtime config), for example
 * http://backend.railway.internal:8080 over a private network. Only the Express API is
 * proxied: the path always starts with /api, and the target is never taken from the request.
 */
export default defineEventHandler(async (event) => {
  const { apiProxyTarget } = useRuntimeConfig(event)

  // Local fallback only; production must configure the target explicitly.
  const target = (apiProxyTarget || (import.meta.dev ? 'http://localhost:5000' : '')).replace(/\/+$/, '')
  if (!target) {
    throw createError({
      statusCode: 503,
      statusMessage: 'API proxy target is not configured (NUXT_API_PROXY_TARGET)',
    })
  }

  // event.path is the incoming path plus query, e.g. /api/auth/login?x=1
  try {
    return await proxyRequest(event, `${target}${event.path}`)
  } catch (error) {
    // A 502 here means the backend could not be reached at all. Log why, so the cause shows
    // in the frontend service logs. Only the target address and the error code are logged:
    // never cookies, headers or request bodies.
    console.error(`[api-proxy] ${event.method} ${event.path} -> ${describeTarget(target)} failed: ${describeError(error)}`)
    throw error
  }
})

/** The configured target without credentials, e.g. "http://backend.railway.internal:8080". */
function describeTarget(target: string): string {
  try {
    const url = new URL(target)
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ' (no port)'}`
  } catch {
    return `an invalid URL "${target}" (it must look like http://host:port)`
  }
}

/** The innermost error code or message, e.g. "ECONNREFUSED" or "ENOTFOUND". */
function describeError(error: unknown): string {
  const parts: string[] = []
  let current: unknown = error
  for (let depth = 0; current && depth < 6; depth++) {
    const e = current as { code?: unknown; message?: unknown; cause?: unknown }
    if (typeof e.code === 'string') parts.push(e.code)
    else if (typeof e.message === 'string' && e.message !== 'Bad Gateway') parts.push(e.message)
    current = e.cause
  }
  return parts.length ? [...new Set(parts)].join(' <- ') : 'unknown error'
}
