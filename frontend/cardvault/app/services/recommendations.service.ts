import type { RecommendationShelf } from '~/types/recommendation'
import { apiFetch } from './api'

export const recommendationsService = {
  /** Today's picks from the Community Catalog for the signed-in user. */
  today: () => apiFetch<RecommendationShelf>('/recommendations'),
}
