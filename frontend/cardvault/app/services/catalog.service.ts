import type {
  CardSummary,
  CreateCardPayload,
  KnowledgeCard,
  PaginatedResult,
  UpdateAiMetadataPayload,
} from '~/types/card'
import { apiFetch } from './api'

export const catalogService = {
  list: (query: { page?: number; pageSize?: number; collectionId?: string; tagId?: string } = {}) =>
    apiFetch<PaginatedResult<CardSummary>>('/cards', { query }),

  get: (id: string) => apiFetch<KnowledgeCard>(`/cards/${id}`),

  create: (payload: CreateCardPayload) =>
    apiFetch<KnowledgeCard>('/cards', { method: 'POST', body: { ...payload } }),

  createFromUrl: (url: string) =>
    apiFetch<KnowledgeCard>('/cards/from-url', { method: 'POST', body: { url } }),

  updateNotes: (id: string, notes: string) =>
    apiFetch<KnowledgeCard>(`/cards/${id}/notes`, { method: 'PATCH', body: { notes } }),

  updateAiMetadata: (id: string, payload: UpdateAiMetadataPayload) =>
    apiFetch<KnowledgeCard>(`/cards/${id}/ai-metadata`, { method: 'PATCH', body: { ...payload } }),

  remove: (id: string) => apiFetch<null>(`/cards/${id}`, { method: 'DELETE' }),

  related: (id: string) => apiFetch<{ items: CardSummary[] }>(`/cards/${id}/related`),
}
