export interface User {
  id: string
  username: string
  email: string
  createdAt?: string
  /** False until the user chooses interests in the welcome onboarding. */
  onboardingCompleted: boolean
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload extends LoginPayload {
  username: string
}

/**
 * Body of `data` returned by POST /auth/register and /auth/login.
 * The JWT itself is delivered in an HttpOnly cookie and is not readable here.
 */
export interface AuthResponse {
  user: User
  expiresIn: number
}
