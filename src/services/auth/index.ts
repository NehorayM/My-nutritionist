/**
 * Supabase Auth for the app: `createAuthService(getSupabase())` once at bootstrap, subscribe with
 * `onAuthStateChange` in the same tick, and run follow-ups through `deferAuthWork`.
 */
export { createAuthService, deferAuthWork } from './authService'
export { AUTH_MESSAGES, toAuthFailure } from './authErrors'
export {
  AUTH_ERROR_CODES,
  AUTH_EVENTS,
  type AuthApi,
  type AuthClientLike,
  type AuthErrorCode,
  type AuthEvent,
  type AuthFailure,
  type AuthListener,
  type AuthResult,
  type AuthService,
  type AuthSession,
} from './authTypes'
