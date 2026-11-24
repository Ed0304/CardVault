/**
 * Restores the signed-in user on first load.
 * - SSR: runs on the server with the browser's cookies. If the 15-minute access cookie has
 *   expired, the refresh cookie is used to start a fresh one (the new cookies are sent back with
 *   the page). The client then hydrates the same state, so it does not run again there.
 * - SPA/static: runs in the browser, which attaches the cookies itself.
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  if (import.meta.client && nuxtApp.payload.serverRendered) return
  await useAuth().restoreSession()
})
