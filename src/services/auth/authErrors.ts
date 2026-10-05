import {
  isAuthError,
  isAuthImplicitGrantRedirectError,
  isAuthPKCECodeVerifierMissingError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
  isAuthWeakPasswordError,
} from '@supabase/supabase-js'
import type { AuthErrorCode, AuthFailure } from './authTypes'

/** Neutral, supportive messages shown to the user for each failure kind. */
export const AUTH_MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: 'That email and password don’t match an account. Check them and try again.',
  user_already_exists: 'An account with this email already exists. Try signing in, or reset your password if you’ve forgotten it.',
  weak_password: 'Please choose a stronger password.',
  same_password: 'Your new password needs to be different from your current one.',
  email_not_confirmed: 'Please confirm your email first — the confirmation link is in your inbox.',
  invalid_email: 'Please check the email address and try again.',
  rate_limited: 'There have been a lot of attempts in a short time. Please wait a few minutes and try again.',
  email_rate_limited: 'We’ve sent several emails recently. Please wait a little while before requesting another one.',
  link_invalid:
    'This link couldn’t be used. Open it on the same device and browser where you requested it, or request a new link — links expire after a short time and work once.',
  session_expired: 'Your session has ended. Please sign in again.',
  signup_disabled: 'New accounts can’t be created right now. Please try again later.',
  network: 'Can’t reach the server. Check your connection and try again.',
  service_unavailable: 'The sign-in service is having trouble right now. Please try again in a moment.',
  unknown: 'Something went wrong. Please try again.',
}

const WEAK_PASSWORD_MESSAGES: Record<string, string> = {
  pwned: 'This password has appeared in a known data leak. Please choose a different one.',
  length: 'That password is too short. Please choose a longer one.',
  characters: 'Please use a mix of character types, for example letters, numbers and symbols.',
}

const CODE_MAP: Record<string, AuthErrorCode> = {
  invalid_credentials: 'invalid_credentials',
  user_already_exists: 'user_already_exists',
  email_exists: 'user_already_exists',
  identity_already_exists: 'user_already_exists',
  weak_password: 'weak_password',
  same_password: 'same_password',
  email_not_confirmed: 'email_not_confirmed',
  validation_failed: 'invalid_email',
  email_address_invalid: 'invalid_email',
  email_address_not_authorized: 'invalid_email',
  over_request_rate_limit: 'rate_limited',
  over_sms_send_rate_limit: 'rate_limited',
  over_email_send_rate_limit: 'email_rate_limited',
  otp_expired: 'link_invalid',
  flow_state_not_found: 'link_invalid',
  flow_state_expired: 'link_invalid',
  bad_code_verifier: 'link_invalid',
  pkce_code_verifier_not_found: 'link_invalid',
  bad_oauth_state: 'link_invalid',
  session_not_found: 'session_expired',
  session_expired: 'session_expired',
  refresh_token_not_found: 'session_expired',
  refresh_token_already_used: 'session_expired',
  signup_disabled: 'signup_disabled',
  email_provider_disabled: 'signup_disabled',
  request_timeout: 'service_unavailable',
  unexpected_failure: 'service_unavailable',
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined
}

/** Error code from an AuthError, or from the `details` of a redirect error (e.g. `#error_code=otp_expired`). */
function errorCodeOf(error: unknown): string | null {
  const code = field(error, 'code')
  if (typeof code === 'string' && code !== '') return code
  const detailsCode = field(field(error, 'details'), 'code')
  return typeof detailsCode === 'string' && detailsCode !== '' ? detailsCode : null
}

function failure(code: AuthErrorCode, message: string = AUTH_MESSAGES[code]): AuthFailure {
  return { code, message }
}

function weakPasswordMessage(reasons: readonly string[]): string {
  const reason = ['pwned', 'length', 'characters'].find((candidate) => reasons.includes(candidate))
  return reason === undefined ? AUTH_MESSAGES.weak_password : (WEAK_PASSWORD_MESSAGES[reason] ?? AUTH_MESSAGES.weak_password)
}

/** A fetch that never got a response (browser wording differs: Chrome, Firefox, Safari, Node). */
const FETCH_FAILURE = /failed to fetch|networkerror|load failed|fetch failed/i

/**
 * Maps anything an auth call can produce (AuthApiError, AuthWeakPasswordError, retryable fetch errors,
 * PKCE errors, redirect errors, thrown TypeErrors) to an app failure. Uses codes and classes only —
 * server messages are never shown or logged.
 */
export function toAuthFailure(error: unknown): AuthFailure {
  if (isAuthWeakPasswordError(error)) return failure('weak_password', weakPasswordMessage(error.reasons))
  if (isAuthPKCECodeVerifierMissingError(error)) return failure('link_invalid')
  if (isAuthRetryableFetchError(error)) {
    return failure(typeof error.status === 'number' && error.status >= 500 ? 'service_unavailable' : 'network')
  }
  if (isAuthSessionMissingError(error)) return failure('session_expired')
  const code = errorCodeOf(error)
  const mapped = code === null ? undefined : CODE_MAP[code]
  if (mapped !== undefined) return failure(mapped)
  // An email link that could not be completed (error in the URL, or not a usable PKCE callback).
  if (isAuthImplicitGrantRedirectError(error) || field(error, 'name') === 'AuthPKCEGrantCodeExchangeError') {
    return failure('link_invalid')
  }
  const status = field(error, 'status')
  if (status === 429) return failure('rate_limited')
  if (typeof status === 'number' && status >= 500) return failure('service_unavailable')
  if (!isAuthError(error) && error instanceof TypeError && FETCH_FAILURE.test(error.message)) return failure('network')
  return failure('unknown')
}

/** Short, secret-free description for logs: the failure code plus the provider error code when present. */
export function describeAuthFailure(operation: string, error: unknown, mapped: AuthFailure): string {
  const code = errorCodeOf(error)
  return `auth.${operation} failed (${mapped.code}${code !== null && code !== mapped.code ? `, ${code}` : ''})`
}
