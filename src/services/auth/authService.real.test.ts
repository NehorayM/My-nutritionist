import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuthService } from './authService'
import type { AuthClientLike } from './authTypes'

/**
 * The service against the REAL supabase-js client (PKCE, like `lib/supabase.ts`) with a stubbed
 * fetch: verifies that real error objects and the real URL handling map as expected, and that a
 * `SupabaseClient` satisfies the service's client contract.
 */
const URL_BASE = 'https://abc.supabase.co'
let clientNo = 0

function realClient(fetchImpl: typeof fetch, detectSessionInUrl = false): SupabaseClient {
  clientNo += 1
  return createClient(URL_BASE, 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl, flowType: 'pkce', storageKey: `test-auth-${clientNo}` },
    global: { fetch: fetchImpl },
  })
}

const json = (status: number, body: object) =>
  vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })))

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('auth service with the real supabase-js client', () => {
  it('accepts a SupabaseClient as its client', () => {
    const client: AuthClientLike = realClient(json(200, {}))
    expect(createAuthService(client)).toHaveProperty('signIn')
  })

  it('maps a real invalid-credentials response', async () => {
    const fetchImpl = json(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
    const result = await createAuthService(realClient(fetchImpl)).signIn('noa@mail.test', 'wrong password')
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid_credentials' } })
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(`${URL_BASE}/auth/v1/token?grant_type=password`)
  })

  it('maps a real weak-password response', async () => {
    const fetchImpl = json(422, { error_code: 'weak_password', msg: 'Password is too weak', weak_password: { reasons: ['length'] } })
    const result = await createAuthService(realClient(fetchImpl)).signUp('noa@mail.test', 'abc', 'http://localhost:5173/')
    expect(result).toMatchObject({ ok: false, error: { code: 'weak_password', message: expect.stringMatching(/too short/) } })
  })

  it('maps a real network failure', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await createAuthService(realClient(fetchImpl)).requestPasswordReset('noa@mail.test', 'http://localhost:5173/')
    expect(result).toMatchObject({ ok: false, error: { code: 'network' } })
  })

  it('reports a PKCE link opened in a browser that did not request it', async () => {
    window.history.replaceState(null, '', '/?code=0b6f6c1e-8d3a-4f2b-9c1d-2e3f4a5b6c7d')
    const fetchImpl = json(200, {})
    const result = await createAuthService(realClient(fetchImpl, true)).completeRedirect(window.location.href)
    expect(result).toMatchObject({ ok: false, error: { code: 'link_invalid' } })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports an expired email link carried in the URL', async () => {
    window.history.replaceState(null, '', '/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
    const result = await createAuthService(realClient(json(200, {}), true)).completeRedirect(window.location.href)
    expect(result).toMatchObject({ ok: false, error: { code: 'link_invalid' } })
  })
})
