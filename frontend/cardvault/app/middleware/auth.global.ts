import { safeRedirectPath } from '~/utils/navigation'

/**
 * Route guard, applied to every page.
 *
 * Pages need a signed-in user unless they opt out with `definePageMeta({ public: true })`,
 * so a new page is protected by default. Pages marked `guestOnly` (login, register) send
 * signed-in users on to the catalog instead.
 *
 * The user is restored before this runs (plugins/auth.ts), on the server and in the browser.
 * This guard only controls navigation. The real protection is the backend, which rejects
 * every request without a valid session cookie.
 */
export default defineNuxtRouteMiddleware((to) => {
  // Unknown URLs fall through to the 404 page.
  if (to.matched.length === 0) return

  const { isAuthenticated } = useAuth()

  if (to.meta.guestOnly) {
    if (isAuthenticated.value) return navigateTo(safeRedirectPath(to.query.redirect))
    return
  }

  if (to.meta.public) return

  if (!isAuthenticated.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
