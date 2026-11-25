import { DEFAULT_SIGNED_IN_PATH, ONBOARDING_PATH, safeRedirectPath } from '~/utils/navigation'

/**
 * Route guard. Pages are signed-in only unless they set `public: true`; `guestOnly` pages
 * (login, register) send signed-in users on. The guard is for navigation only: the API enforces
 * every permission itself.
 *
 * Signed-in users who have not chosen interests yet (new accounts, and existing accounts from
 * before onboarding existed) are sent to the welcome onboarding before any signed-in page, then
 * back to where they were going. Public pages, such as a Community card they came to save, stay
 * reachable.
 */
export default defineNuxtRouteMiddleware((to) => {
  // Unknown URLs fall through to the 404 page.
  if (to.matched.length === 0) return

  const { user, isAuthenticated } = useAuth()

  if (to.meta.guestOnly) {
    if (isAuthenticated.value) return navigateTo(safeRedirectPath(to.query.redirect))
    return
  }

  // The landing page is for visitors; signed-in users have their own home.
  if (to.path === '/' && isAuthenticated.value) return navigateTo(DEFAULT_SIGNED_IN_PATH)

  if (to.meta.public) return

  if (!isAuthenticated.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  const onboarded = user.value?.onboardingCompleted === true
  if (to.meta.onboarding) {
    // Already done: Settings is where interests change from now on.
    if (onboarded) return navigateTo(safeRedirectPath(to.query.redirect))
    return
  }
  if (!onboarded) {
    return navigateTo({ path: ONBOARDING_PATH, query: { redirect: to.fullPath } })
  }
})
