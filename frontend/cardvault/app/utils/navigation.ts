import type { IconName } from './icons'

export interface NavLink {
  to: string
  label: string
  icon: IconName
  /** Decides whether the link is "current" for a given route path. */
  isActive: (path: string) => boolean
}

/** Single source of truth for the primary navigation (sidebar and header menu). */
export const primaryNavLinks: NavLink[] = [
  {
    to: '/catalog',
    label: 'Catalog',
    icon: 'catalog',
    isActive: (path) =>
      path === '/catalog' || (path.startsWith('/catalog/') && path !== '/catalog/create'),
  },
  {
    to: '/catalog/create',
    label: 'New card',
    icon: 'plus',
    isActive: (path) => path === '/catalog/create',
  },
  {
    to: '/collections',
    label: 'Collections',
    icon: 'folder',
    isActive: (path) => path.startsWith('/collections'),
  },
]
