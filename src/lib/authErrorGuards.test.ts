import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthWeakPasswordError,
  isAuthError as sbIsAuthError,
  isAuthImplicitGrantRedirectError as sbImplicitGrant,
  isAuthPKCECodeVerifierMissingError as sbPkceVerifierMissing,
  isAuthRetryableFetchError as sbRetryableFetch,
  isAuthSessionMissingError as sbSessionMissing,
  isAuthWeakPasswordError as sbWeakPassword,
} from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import {
  isAuthError,
  isAuthImplicitGrantRedirectError,
  isAuthPKCECodeVerifierMissingError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
  isAuthWeakPasswordError,
} from './authErrorGuards'

type Guard = (error: unknown) => boolean
const PAIRS: Array<[string, Guard, Guard]> = [
  ['isAuthError', isAuthError, sbIsAuthError],
  ['isAuthRetryableFetchError', isAuthRetryableFetchError, sbRetryableFetch],
  ['isAuthSessionMissingError', isAuthSessionMissingError, sbSessionMissing],
  ['isAuthWeakPasswordError', isAuthWeakPasswordError, sbWeakPassword],
  ['isAuthPKCECodeVerifierMissingError', isAuthPKCECodeVerifierMissingError, sbPkceVerifierMissing],
  ['isAuthImplicitGrantRedirectError', isAuthImplicitGrantRedirectError, sbImplicitGrant],
]

describe('auth error guards', () => {
  it('agree with the installed supabase-js guards for real error instances and non-errors', () => {
    const samples: unknown[] = [
      new AuthApiError('bad', 400, 'invalid_credentials'),
      new AuthRetryableFetchError('offline', 0),
      new AuthSessionMissingError(),
      new AuthWeakPasswordError('weak', 422, ['length']),
      new TypeError('Failed to fetch'),
      { name: 'AuthWeakPasswordError' },
      null,
      'AuthError',
    ]
    for (const [name, ours, theirs] of PAIRS) {
      for (const sample of samples) {
        expect(ours(sample), `${name}(${String(sample)})`).toBe(theirs(sample))
      }
    }
  })

  it('exposes weak-password reasons', () => {
    const error = new AuthWeakPasswordError('weak', 422, ['length', 'characters'])
    expect(isAuthWeakPasswordError(error) && error.reasons).toEqual(['length', 'characters'])
  })
})
