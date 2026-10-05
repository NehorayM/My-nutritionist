import {
  AuthApiError,
  AuthImplicitGrantRedirectError,
  AuthPKCECodeVerifierMissingError,
  AuthPKCEGrantCodeExchangeError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthUnknownError,
  AuthWeakPasswordError,
} from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { AUTH_MESSAGES, describeAuthFailure, toAuthFailure } from './authErrors'

const api = (code: string, status = 400) => new AuthApiError('server text that must not be shown', status, code)

describe('toAuthFailure', () => {
  it.each([
    ['invalid_credentials', 'invalid_credentials'],
    ['user_already_exists', 'user_already_exists'],
    ['email_exists', 'user_already_exists'],
    ['email_not_confirmed', 'email_not_confirmed'],
    ['same_password', 'same_password'],
    ['validation_failed', 'invalid_email'],
    ['email_address_invalid', 'invalid_email'],
    ['over_request_rate_limit', 'rate_limited'],
    ['over_email_send_rate_limit', 'email_rate_limited'],
    ['otp_expired', 'link_invalid'],
    ['flow_state_not_found', 'link_invalid'],
    ['bad_code_verifier', 'link_invalid'],
    ['refresh_token_not_found', 'session_expired'],
    ['signup_disabled', 'signup_disabled'],
    ['request_timeout', 'service_unavailable'],
  ])('maps the Supabase code %s to %s with a friendly message', (code, expected) => {
    const result = toAuthFailure(api(code))
    expect(result.code).toBe(expected)
    expect(result.message).toBe(AUTH_MESSAGES[result.code])
    expect(result.message).not.toMatch(/server text/)
  })

  it('explains weak passwords by their most important reason', () => {
    expect(toAuthFailure(new AuthWeakPasswordError('weak', 422, ['length', 'pwned'])).message).toMatch(/data leak/)
    expect(toAuthFailure(new AuthWeakPasswordError('weak', 422, ['length']))).toEqual({
      code: 'weak_password',
      message: expect.stringMatching(/too short/),
    })
    expect(toAuthFailure(new AuthWeakPasswordError('weak', 422, ['characters'])).message).toMatch(/mix of character types/)
    expect(toAuthFailure(new AuthWeakPasswordError('weak', 422, [])).message).toBe(AUTH_MESSAGES.weak_password)
  })

  it('asks to open links on the same device for every PKCE and expired-link error', () => {
    const errors = [
      new AuthPKCECodeVerifierMissingError(),
      new AuthImplicitGrantRedirectError('Email link is invalid or has expired', { error: 'access_denied', code: 'otp_expired' }),
      new AuthImplicitGrantRedirectError('Error in URL', { error: 'server_error', code: 'unspecified_code' }),
      new AuthPKCEGrantCodeExchangeError('Not a valid PKCE flow url.'),
    ]
    for (const error of errors) {
      expect(toAuthFailure(error).code).toBe('link_invalid')
    }
    expect(AUTH_MESSAGES.link_invalid).toMatch(/same device and browser/)
    expect(AUTH_MESSAGES.link_invalid).toMatch(/request a new link/)
  })

  it('separates network failures, server trouble and rate limits', () => {
    expect(toAuthFailure(new AuthRetryableFetchError('Failed to fetch', 0)).code).toBe('network')
    expect(toAuthFailure(new TypeError('Failed to fetch')).code).toBe('network')
    expect(toAuthFailure(new AuthRetryableFetchError('Bad gateway', 502)).code).toBe('service_unavailable')
    expect(toAuthFailure(new AuthApiError('slow down', 429, undefined)).code).toBe('rate_limited')
    expect(toAuthFailure(new AuthUnknownError('odd', null)).code).toBe('unknown')
  })

  it('treats a missing session as an ended session and anything unrecognised as unknown', () => {
    expect(toAuthFailure(new AuthSessionMissingError()).code).toBe('session_expired')
    expect(toAuthFailure(api('some_future_code'))).toEqual({ code: 'unknown', message: AUTH_MESSAGES.unknown })
    expect(toAuthFailure(new TypeError('x is not a function')).code).toBe('unknown')
    expect(toAuthFailure('boom').code).toBe('unknown')
  })
})

describe('describeAuthFailure', () => {
  it('names the operation and codes only', () => {
    const error = api('otp_expired')
    expect(describeAuthFailure('completeRedirect', error, toAuthFailure(error))).toBe('auth.completeRedirect failed (link_invalid, otp_expired)')
    const same = api('invalid_credentials')
    expect(describeAuthFailure('signIn', same, toAuthFailure(same))).toBe('auth.signIn failed (invalid_credentials)')
  })
})
