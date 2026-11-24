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
export default defineEventHandler((event) => {
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
  return proxyRequest(event, `${target}${event.path}`)
})
