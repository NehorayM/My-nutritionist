/**
 * Public types of the auth service. Features and stores use these app-shaped types only — never
 * supabase-js sessions, users or error classes.
 */
export const AUTH_ERROR_CODES = [
  'invalid_credentials',
  'user_already_exists',
  'weak_password',
  'same_password',
  'email_not_confirmed',
  'invalid_email',
  'rate_limited',
  'email_rate_limited',
  /** An email link was opened in another browser/device, was already used, or expired. */
  'link_invalid',
  'session_expired',
  'signup_disabled',
  'network',
  'service_unavailable',
  'unknown',
] as const
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number]

export interface AuthFailure {
  code: AuthErrorCode
  /** Neutral, user-facing message (never contains the email, password or server text). */
  message: string
}

/** `{ ok: true, …data }` on success, `{ ok: false, error }` otherwise. Auth methods never throw. */
export type AuthResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: AuthFailure }

/** The signed-in account as the app sees it. */
export interface AuthSession {
  userId: string
  email: string | null
}

export const AUTH_EVENTS = [
  /** The stored session (or none) was loaded at startup. */
  'INITIAL_SESSION',
  'SIGNED_IN',
  'SIGNED_OUT',
  'TOKEN_REFRESHED',
  'USER_UPDATED',
  /** A password-recovery link was opened: ask the user for a new password. */
  'PASSWORD_RECOVERY',
] as const
export type AuthEvent = (typeof AUTH_EVENTS)[number]

/** Called synchronously by the auth client: update state only, defer async work (`deferAuthWork`). */
export type AuthListener = (event: AuthEvent, session: AuthSession | null) => void

export interface AuthService {
  getSession(): Promise<AuthResult<{ session: AuthSession | null }>>
  /** Subscribe at bootstrap (same tick as the client is created) so PASSWORD_RECOVERY is never missed. */
  onAuthStateChange(listener: AuthListener): () => void
  /** `needsConfirmation`: the account was created and a confirmation email was sent (no session yet). */
  signUp(email: string, password: string, redirectTo: string): Promise<AuthResult<{ needsConfirmation: boolean; session: AuthSession | null }>>
  signIn(email: string, password: string): Promise<AuthResult<{ session: AuthSession }>>
  /** Signs out on this device only. */
  signOut(): Promise<AuthResult>
  /** Always succeeds for unknown emails too (Supabase never reveals whether an account exists). */
  requestPasswordReset(email: string, redirectTo: string): Promise<AuthResult>
  updatePassword(password: string): Promise<AuthResult>
  /**
   * Result of the email link the page was opened with (confirmation or password recovery), once the
   * client has processed it. A link opened in another browser/device, reused or expired gives `link_invalid`.
   */
  completeRedirect(currentUrl: string): Promise<AuthResult<{ session: AuthSession | null }>>
}

/*
 * The subset of supabase-js `client.auth` the service uses. A real `SupabaseClient` satisfies it
 * structurally; tests pass small fakes.
 */
export interface AuthUserLike {
  id: string
  email?: string | undefined
  identities?: readonly unknown[] | undefined
}

export interface AuthSessionLike {
  user: AuthUserLike
}

export interface AuthResponseLike {
  data: { user: AuthUserLike | null; session: AuthSessionLike | null }
  error: unknown
}

export interface AuthApi {
  initialize(): Promise<{ error: unknown }>
  getSession(): Promise<{ data: { session: AuthSessionLike | null }; error: unknown }>
  onAuthStateChange(callback: (event: string, session: AuthSessionLike | null) => void): {
    data: { subscription: { unsubscribe(): void } }
  }
  signUp(credentials: { email: string; password: string; options?: { emailRedirectTo?: string } }): Promise<AuthResponseLike>
  signInWithPassword(credentials: { email: string; password: string }): Promise<AuthResponseLike>
  signOut(options?: { scope?: 'global' | 'local' | 'others' }): Promise<{ error: unknown }>
  resetPasswordForEmail(email: string, options?: { redirectTo?: string }): Promise<{ error: unknown }>
  updateUser(attributes: { password?: string }): Promise<{ error: unknown }>
}

export interface AuthClientLike {
  auth: AuthApi
}
