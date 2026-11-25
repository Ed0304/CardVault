/** Which signal leads the recommendations when both apply. */
export type RecommendationPriority = 'BALANCED' | 'INTERESTS' | 'VAULT'

/** The signed-in user's recommendation preferences. Private: never part of a public card. */
export interface RecommendationPreferences {
  interests: string[]
  surpriseMe: boolean
  priority: RecommendationPriority
  onboardedAt: string
  updatedAt: string
}

export interface SavePreferencesPayload {
  interests: string[]
  surpriseMe: boolean
  priority?: RecommendationPriority
}

/** A topic offered in onboarding and Settings. */
export interface TopicOption {
  label: string
  description: string | null
  /** STARTER: CardVault's starter list. CATALOG: a subject heading used on published cards. */
  source: 'STARTER' | 'CATALOG'
  publicCardCount: number | null
}

/** Mirrors the API limits in `preferences.schemas.ts`. */
export const MAX_INTERESTS = 20
export const MAX_INTEREST_LENGTH = 60
