export interface User {
  id: string
  email: string
  displayName: string | null
  createdAt?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload extends LoginPayload {
  displayName?: string
}
