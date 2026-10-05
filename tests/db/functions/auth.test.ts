import { describe, expect, it, vi } from 'vitest'
import { bearerToken, createUserVerifier, type ClaimsResult } from '../../../supabase/functions/food-search/auth.ts'
import { pickPublishableKey, readFdcApiKey, readFunctionEnv } from '../../../supabase/functions/food-search/config.ts'

const JWT = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ1In0.c2lnbmF0dXJl'
const USER_ID = '6a1f2b9c-1d2e-4f30-8a4b-5c6d7e8f9a0b'

function verifierReturning(result: ClaimsResult | Error) {
  return {
    getClaims: vi.fn<(jwt: string) => Promise<ClaimsResult>>(async () => {
      if (result instanceof Error) throw result
      return result
    }),
  }
}

describe('bearerToken', () => {
  it('extracts a JWT from a Bearer header (case-insensitive scheme)', () => {
    expect(bearerToken(`Bearer ${JWT}`)).toBe(JWT)
    expect(bearerToken(`bearer   ${JWT} `)).toBe(JWT)
  })

  it.each([
    ['no header', null],
    ['an empty header', ''],
    ['another scheme', `Basic ${JWT}`],
    ['a publishable key', 'Bearer sb_publishable_abc123'],
    ['a secret key', 'Bearer sb_secret_abc123'],
    ['a two-part token', 'Bearer abc.def'],
    ['two tokens', `Bearer ${JWT} ${JWT}`],
  ])('returns null for %s', (_label, header) => {
    expect(bearerToken(header)).toBeNull()
  })
})

describe('createUserVerifier', () => {
  it('returns the user id for a verified, signed-in user token', async () => {
    const verifier = verifierReturning({ data: { claims: { sub: USER_ID, role: 'authenticated' } }, error: null })
    await expect(createUserVerifier(verifier)(`Bearer ${JWT}`)).resolves.toBe(USER_ID)
    expect(verifier.getClaims).toHaveBeenCalledWith(JWT)
  })

  it('never calls the verifier for a missing or non-JWT credential', async () => {
    const verifier = verifierReturning({ data: { claims: { sub: USER_ID, role: 'authenticated' } }, error: null })
    const verify = createUserVerifier(verifier)
    await expect(verify(null)).resolves.toBeNull()
    await expect(verify('Bearer sb_publishable_abc')).resolves.toBeNull()
    expect(verifier.getClaims).not.toHaveBeenCalled()
  })

  it.each([
    ['a verification error', { data: null, error: new Error('Invalid JWT signature') }],
    ['the anon role (legacy anon key)', { data: { claims: { role: 'anon' } }, error: null }],
    ['the service_role role', { data: { claims: { sub: USER_ID, role: 'service_role' } }, error: null }],
    ['a missing subject', { data: { claims: { role: 'authenticated' } }, error: null }],
    ['an anonymous sign-in', { data: { claims: { sub: USER_ID, role: 'authenticated', is_anonymous: true } }, error: null }],
  ])('rejects %s', async (_label, result) => {
    await expect(createUserVerifier(verifierReturning(result))(`Bearer ${JWT}`)).resolves.toBeNull()
  })

  it('treats an unexpected verifier failure as unauthenticated and reports it', async () => {
    const onError = vi.fn<(error: unknown) => void>()
    const failure = new Error('JWKS unreachable')
    await expect(createUserVerifier(verifierReturning(failure), onError)(`Bearer ${JWT}`)).resolves.toBeNull()
    expect(onError).toHaveBeenCalledWith(failure)
  })
})

describe('function environment', () => {
  const envOf = (values: Record<string, string>) => (name: string) => values[name]

  it('prefers the default key of SUPABASE_PUBLISHABLE_KEYS', () => {
    const get = envOf({
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ mobile: 'sb_publishable_m', default: 'sb_publishable_d' }),
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_single',
      SUPABASE_ANON_KEY: 'legacy',
    })
    expect(pickPublishableKey(get)).toBe('sb_publishable_d')
  })

  it('falls back to any named key, then the single key, then the legacy anon key', () => {
    expect(pickPublishableKey(envOf({ SUPABASE_PUBLISHABLE_KEYS: '{"web":"sb_publishable_w"}' }))).toBe('sb_publishable_w')
    expect(pickPublishableKey(envOf({ SUPABASE_PUBLISHABLE_KEYS: 'not json', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_s' }))).toBe(
      'sb_publishable_s',
    )
    expect(pickPublishableKey(envOf({ SUPABASE_PUBLISHABLE_KEYS: '[]', SUPABASE_ANON_KEY: ' legacy ' }))).toBe('legacy')
    expect(pickPublishableKey(envOf({}))).toBeNull()
  })

  it('reads the project URL and treats blank values as missing', () => {
    expect(readFunctionEnv(envOf({ SUPABASE_URL: 'http://kong:8000', SUPABASE_ANON_KEY: 'k' }))).toEqual({
      supabaseUrl: 'http://kong:8000',
      publishableKey: 'k',
    })
    expect(readFunctionEnv(envOf({ SUPABASE_URL: '  ' }))).toEqual({ supabaseUrl: null, publishableKey: null })
  })

  it('reads FDC_API_KEY trimmed, or null when unset', () => {
    expect(readFdcApiKey(envOf({ FDC_API_KEY: ' abc123 ' }))).toBe('abc123')
    expect(readFdcApiKey(envOf({ FDC_API_KEY: '' }))).toBeNull()
    expect(readFdcApiKey(envOf({}))).toBeNull()
  })
})
