export interface Collection {
  id: string
  name: string
  createdAt?: string
  /** Number of the user's cards in the collection (present in list responses). */
  cardCount?: number
}

export interface Tag {
  id: string
  name: string
  createdAt?: string
  /** Number of the user's cards with the tag (present in list responses). */
  cardCount?: number
}
