import { describe, expect, it } from 'vitest'
import { isForbiddenBrowserKey, readSupabaseConfig } from './env'

function jwtWithRole(role: string): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: 'supabase', role })}.signature`
}

describe('readSupabaseConfig', () => {
  it('reports missing configuration without throwing', () => {
    expect(readSupabaseConfig({})).toEqual({ configured: false, reason: 'missing' })
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toEqual({ configured: false, reason: 'missing' })
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })).toEqual({
      configured: false,
      reason: 'missing',
    })
  })

  it('treats unedited .env.example placeholders as not configured', () => {
    expect(
      readSupabaseConfig({ VITE_SUPABASE_URL: 'https://your-project-ref.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_replace_me' }),
    ).toEqual({ configured: false, reason: 'missing' })
  })

  it('accepts a publishable key and normalizes the URL to its origin', () => {
    expect(
      readSupabaseConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co/', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_123' }),
    ).toEqual({ configured: true, url: 'https://abc.supabase.co', key: 'sb_publishable_123' })
  })

  it('falls back to the legacy anon key', () => {
    const anon = jwtWithRole('anon')
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: anon })).toEqual({
      configured: true,
      url: 'http://127.0.0.1:54321',
      key: anon,
    })
  })

  it('rejects invalid URLs', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })).toEqual({
      configured: false,
      reason: 'invalid_url',
    })
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'ftp://x.io', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })).toEqual({
      configured: false,
      reason: 'invalid_url',
    })
  })

  it('refuses secret and service-role keys in the browser', () => {
    expect(isForbiddenBrowserKey('sb_secret_abc')).toBe(true)
    expect(isForbiddenBrowserKey(jwtWithRole('service_role'))).toBe(true)
    expect(isForbiddenBrowserKey(jwtWithRole('anon'))).toBe(false)
    expect(isForbiddenBrowserKey('sb_publishable_abc')).toBe(false)
    expect(isForbiddenBrowserKey('a.!!!.c')).toBe(false)
    expect(
      readSupabaseConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x' }),
    ).toEqual({ configured: false, reason: 'forbidden_key' })
  })
})
