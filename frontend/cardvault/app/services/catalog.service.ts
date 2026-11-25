import type {
  CardSummary,
  CreateCardPayload,
  KnowledgeCard,
  PaginatedResult,
  SetVisibilityPayload,
  UpdateAiMetadataPayload,
} from '~/types/card'
import { apiFetch } from './api'

export const catalogService = {
  list: (query: { q?: string; page?: number; pageSize?: number; collectionId?: string; tagId?: string } = {}) =>
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

  /** Puts the card in a collection, or takes it out with null. */
  setCollection: (id: string, collectionId: string | null) =>
    apiFetch<KnowledgeCard>(`/cards/${id}/collection`, { method: 'PATCH', body: { collectionId } }),

  /** Publishes the card to the Community Catalog, or makes it private again. */
  setVisibility: (id: string, payload: SetVisibilityPayload) =>
    apiFetch<KnowledgeCard>(`/cards/${id}/visibility`, { method: 'PATCH', body: { ...payload } }),

  /** Asks Muse for catalog suggestions. They come back as a draft on the card. */
  requestCatalog: (id: string) => apiFetch<KnowledgeCard>(`/cards/${id}/catalog`, { method: 'POST' }),

  discardCatalogDraft: (id: string) =>
    apiFetch<KnowledgeCard>(`/cards/${id}/catalog/draft`, { method: 'DELETE' }),

  aiStatus: () => apiFetch<{ catalog: { available: boolean } }>('/ai/status'),

  addTag: (id: string, tagId: string) =>
    apiFetch<KnowledgeCard>(`/cards/${id}/tags/${tagId}`, { method: 'POST' }),

  removeTag: (id: string, tagId: string) =>
    apiFetch<KnowledgeCard>(`/cards/${id}/tags/${tagId}`, { method: 'DELETE' }),

  related: (id: string) => apiFetch<{ items: CardSummary[] }>(`/cards/${id}/related`),
}
