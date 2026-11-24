import type { Collection } from '~/types/collection'
import { apiFetch } from './api'

export const collectionService = {
  list: () => apiFetch<Collection[]>('/collections'),

  create: (name: string) => apiFetch<Collection>('/collections', { method: 'POST', body: { name } }),

  rename: (id: string, name: string) =>
    apiFetch<Collection>(`/collections/${id}`, { method: 'PATCH', body: { name } }),

  remove: (id: string) => apiFetch<null>(`/collections/${id}`, { method: 'DELETE' }),
}
