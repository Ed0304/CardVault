/**
 * Restores the signed-in user from the HttpOnly session cookie on first load.
 * - SSR: runs on the server (cookie forwarded by apiFetch); the client then
 *   hydrates the same state, so it is not fetched twice.
 * - SPA/static: runs on the client, where the browser attaches the cookie.
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  if (import.meta.client && nuxtApp.payload.serverRendered) return
  await useAuth().fetchUser()
})
