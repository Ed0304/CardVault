import type { IconName } from './icons'

export interface NavLink {
  to: string
  label: string
  icon: IconName
  /** The page needs a signed-in user; shown with a lock icon to signed-out visitors. */
  requiresAuth: boolean
  /** Decides whether the link is "current" for a given route path. */
  isActive: (path: string) => boolean
}

/** Single source of truth for the primary navigation (sidebar and header menu). */
export const primaryNavLinks: NavLink[] = [
  {
    to: '/home',
    label: 'Home',
    icon: 'home',
    requiresAuth: true,
    isActive: (path) => path === '/home',
  },
  {
    to: '/catalog',
    label: 'My Vault',
    icon: 'catalog',
    requiresAuth: true,
    isActive: (path) =>
      path === '/catalog' || (path.startsWith('/catalog/') && path !== '/catalog/create'),
  },
  {
    to: '/catalog/create',
    label: 'New card',
    icon: 'plus',
    requiresAuth: true,
    isActive: (path) => path === '/catalog/create',
  },
  {
    to: '/collections',
    label: 'Collections',
    icon: 'folder',
    requiresAuth: true,
    isActive: (path) => path.startsWith('/collections'),
  },
  {
    // Guests may browse published cards (REQ-DISC-001).
    to: '/community',
    label: 'Community',
    icon: 'globe',
    requiresAuth: false,
    isActive: (path) => path.startsWith('/community'),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: 'sliders',
    requiresAuth: true,
    isActive: (path) => path.startsWith('/settings'),
  },
]

/** Where users land after logging in or registering when no other page was requested. */
export const DEFAULT_SIGNED_IN_PATH = '/home'

/** The welcome onboarding, shown once before the personal home page. */
export const ONBOARDING_PATH = '/welcome'

/**
 * Returns `value` when it is a safe in-app path to redirect to after login, otherwise `fallback`.
 * Only same-site paths are allowed ("/catalog", not "https://…" or "//evil.example"), which
 * prevents the login page from being used as an open redirect.
 */
export function safeRedirectPath(value: unknown, fallback = DEFAULT_SIGNED_IN_PATH): string {
  const path = Array.isArray(value) ? value[0] : value
  if (typeof path !== 'string' || !path.startsWith('/')) return fallback
  if (path.startsWith('//') || path.includes('\\')) return fallback
  if (path.startsWith('/login') || path.startsWith('/register')) return fallback
  // The onboarding page redirects on completion; returning to it would loop.
  if (path.startsWith(ONBOARDING_PATH)) return fallback
  return path
}

/**
 * The login page, set to come back to `returnTo` afterwards, e.g. a Community card the guest
 * wanted to save. The landing page needs no return path.
 */
export function loginPath(returnTo?: string, page: 'login' | 'register' = 'login'): string {
  const path = `/${page}`
  if (!returnTo || returnTo === '/') return path
  return `${path}?redirect=${encodeURIComponent(safeRedirectPath(returnTo))}`
}
