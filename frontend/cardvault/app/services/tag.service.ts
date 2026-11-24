import type { Tag } from '~/types/collection'
import { apiFetch } from './api'

export const tagService = {
  list: () => apiFetch<Tag[]>('/tags'),

  create: (name: string) => apiFetch<Tag>('/tags', { method: 'POST', body: { name } }),

  remove: (id: string) => apiFetch<null>(`/tags/${id}`, { method: 'DELETE' }),
}
