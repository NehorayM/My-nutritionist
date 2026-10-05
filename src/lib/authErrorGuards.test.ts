import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, AuthWeakPasswordError } from '@supabase/supabase-js'
import * as supabase from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import * as guards from './authErrorGuards'

const GUARDS = [
  'isAuthError',
  'isAuthRetryableFetchError',
  'isAuthSessionMissingError',
  'isAuthWeakPasswordError',
  'isAuthPKCECodeVerifierMissingError',
  'isAuthImplicitGrantRedirectError',
] as const

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
    for (const name of GUARDS) {
      for (const sample of samples) {
        expect(guards[name](sample), `${name}(${String(sample)})`).toBe(supabase[name](sample))
      }
    }
  })

  it('exposes weak-password reasons', () => {
    const error = new AuthWeakPasswordError('weak', 422, ['length', 'characters'])
    expect(guards.isAuthWeakPasswordError(error) && error.reasons).toEqual(['length', 'characters'])
  })
})
