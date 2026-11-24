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
    to: '/catalog',
    label: 'Catalog',
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
]

/** Where users land after logging in or registering when no other page was requested. */
export const DEFAULT_SIGNED_IN_PATH = '/catalog'

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
  return path
}
