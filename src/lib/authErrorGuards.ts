/**
 * Structural equivalents of supabase-js's `isAuth*Error` guards (auth-js marks its errors with
 * `__isAuthError` and a class `name`). Kept local so error mapping never imports the Supabase client
 * at runtime: the client is loaded lazily, only when cloud mode is configured.
 */
export interface AuthErrorLike {
  __isAuthError: true
  name: string
  message: string
  status?: number
  code?: string
  /** AuthWeakPasswordError only. */
  reasons?: string[]
}

export function isAuthError(error: unknown): error is AuthErrorLike {
  return typeof error === 'object' && error !== null && '__isAuthError' in error
}

function named(error: unknown, name: string): error is AuthErrorLike {
  return isAuthError(error) && error.name === name
}

export const isAuthRetryableFetchError = (error: unknown) => named(error, 'AuthRetryableFetchError')
export const isAuthSessionMissingError = (error: unknown) => named(error, 'AuthSessionMissingError')
export const isAuthWeakPasswordError = (error: unknown): error is AuthErrorLike & { reasons: string[] } =>
  named(error, 'AuthWeakPasswordError') && Array.isArray(error.reasons)
export const isAuthPKCECodeVerifierMissingError = (error: unknown) => named(error, 'AuthPKCECodeVerifierMissingError')
export const isAuthImplicitGrantRedirectError = (error: unknown) => named(error, 'AuthImplicitGrantRedirectError')
