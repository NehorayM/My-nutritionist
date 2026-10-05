import { AuthApiError, AuthImplicitGrantRedirectError, AuthRetryableFetchError, AuthWeakPasswordError } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/lib/logger'
import { createManualTimers } from '@/services/sync/__fixtures__/manualTimers'
import { authSession, createFakeAuth, EMAIL, PASSWORD } from './__fixtures__/fakeAuth'
import { createAuthService, deferAuthWork } from './authService'
import type { AuthEvent, AuthSession } from './authTypes'

const REDIRECT = 'http://localhost:5173/#/auth/callback'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sign up', () => {
  it('reports that confirmation is needed when no session is returned, passing the redirect URL', async () => {
    const fake = createFakeAuth()
    fake.auth.signUp.mockResolvedValue({ data: { user: authSession().user, session: null }, error: null })
    const result = await createAuthService(fake.client).signUp(EMAIL, PASSWORD, REDIRECT)
    expect(result).toEqual({ ok: true, needsConfirmation: true, session: null })
    expect(fake.auth.signUp).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD, options: { emailRedirectTo: REDIRECT } })
  })

  it('returns the session when the project confirms accounts automatically', async () => {
    const fake = createFakeAuth()
    const session = authSession('user-9')
    fake.auth.signUp.mockResolvedValue({ data: { user: session.user, session }, error: null })
    expect(await createAuthService(fake.client).signUp(EMAIL, PASSWORD, REDIRECT)).toEqual({
      ok: true,
      needsConfirmation: false,
      session: { userId: 'user-9', email: EMAIL },
    })
  })

  it('recognises an existing account behind the obfuscated sign-up response', async () => {
    const fake = createFakeAuth()
    fake.auth.signUp.mockResolvedValue({ data: { user: { id: 'fake', email: EMAIL, identities: [] }, session: null }, error: null })
    const result = await createAuthService(fake.client).signUp(EMAIL, PASSWORD, REDIRECT)
    expect(result).toMatchObject({ ok: false, error: { code: 'user_already_exists' } })
  })

  it('explains a weak password', async () => {
    const fake = createFakeAuth()
    fake.auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: new AuthWeakPasswordError('weak', 422, ['length']) })
    const result = await createAuthService(fake.client).signUp(EMAIL, 'abc', REDIRECT)
    expect(result).toEqual({ ok: false, error: { code: 'weak_password', message: expect.stringMatching(/too short/) } })
  })
})

describe('sign in, sign out and passwords', () => {
  it('maps the session to the app shape, and wrong credentials to one generic message', async () => {
    const fake = createFakeAuth()
    const service = createAuthService(fake.client)
    fake.auth.signInWithPassword.mockResolvedValueOnce({ data: { user: authSession().user, session: authSession('u-1', null) }, error: null })
    expect(await service.signIn(EMAIL, PASSWORD)).toEqual({ ok: true, session: { userId: 'u-1', email: null } })
    fake.auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null, session: null }, error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials') })
    expect(await service.signIn(EMAIL, 'wrong')).toMatchObject({ ok: false, error: { code: 'invalid_credentials' } })
  })

  it('never throws: a rejected request becomes a network failure', async () => {
    const fake = createFakeAuth()
    fake.auth.signInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await createAuthService(fake.client).signIn(EMAIL, PASSWORD)).toMatchObject({ ok: false, error: { code: 'network' } })
  })

  it('signs out on this device only, and succeeds when only the server revocation failed', async () => {
    const fake = createFakeAuth()
    const service = createAuthService(fake.client)
    expect(await service.signOut()).toEqual({ ok: true })
    expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })

    fake.auth.signOut.mockResolvedValue({ error: new AuthRetryableFetchError('Failed to fetch', 0) })
    expect(await service.signOut()).toEqual({ ok: true })
    fake.auth.getSession.mockResolvedValue({ data: { session: authSession() }, error: null })
    expect(await service.signOut()).toMatchObject({ ok: false, error: { code: 'network' } })
  })

  it('requests password reset emails and updates passwords with friendly errors', async () => {
    const fake = createFakeAuth()
    const service = createAuthService(fake.client)
    expect(await service.requestPasswordReset(EMAIL, REDIRECT)).toEqual({ ok: true })
    expect(fake.auth.resetPasswordForEmail).toHaveBeenCalledWith(EMAIL, { redirectTo: REDIRECT })
    fake.auth.resetPasswordForEmail.mockResolvedValue({ error: new AuthApiError('limit', 429, 'over_email_send_rate_limit') })
    expect(await service.requestPasswordReset(EMAIL, REDIRECT)).toMatchObject({ ok: false, error: { code: 'email_rate_limited' } })

    expect(await service.updatePassword('a new long password')).toEqual({ ok: true })
    expect(fake.auth.updateUser).toHaveBeenCalledWith({ password: 'a new long password' })
    fake.auth.updateUser.mockResolvedValue({ error: new AuthApiError('same', 422, 'same_password') })
    expect(await service.updatePassword(PASSWORD)).toMatchObject({ ok: false, error: { code: 'same_password' } })
  })

  it('never logs emails, passwords or server messages', async () => {
    const warn = vi.spyOn(logger, 'warn')
    const fake = createFakeAuth()
    fake.auth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: new AuthApiError(`bad login for ${EMAIL}`, 400, 'invalid_credentials') })
    await createAuthService(fake.client).signIn(EMAIL, PASSWORD)
    expect(warn).toHaveBeenCalledTimes(1)
    const logged = JSON.stringify(warn.mock.calls)
    expect(logged).not.toContain(EMAIL)
    expect(logged).not.toContain(PASSWORD)
    expect(logged).toContain('auth.signIn failed (invalid_credentials)')
  })
})

describe('session and auth events', () => {
  it('reads the current session in the app shape', async () => {
    const fake = createFakeAuth()
    fake.auth.getSession.mockResolvedValue({ data: { session: authSession('u-2') }, error: null })
    expect(await createAuthService(fake.client).getSession()).toEqual({ ok: true, session: { userId: 'u-2', email: EMAIL } })
  })

  it('calls listeners synchronously with app sessions, skips unknown events and survives a failing listener', () => {
    const fake = createFakeAuth()
    const service = createAuthService(fake.client)
    const seen: [AuthEvent, AuthSession | null][] = []
    service.onAuthStateChange(() => {
      throw new Error('listener bug')
    })
    const stop = service.onAuthStateChange((event, session) => seen.push([event, session]))
    fake.emit('PASSWORD_RECOVERY', authSession('u-3'))
    fake.emit('MFA_CHALLENGE_VERIFIED', authSession('u-3'))
    fake.emit('SIGNED_OUT', null)
    expect(seen).toEqual([
      ['PASSWORD_RECOVERY', { userId: 'u-3', email: EMAIL }],
      ['SIGNED_OUT', null],
    ])
    stop()
    fake.emit('SIGNED_IN', authSession())
    expect(seen).toHaveLength(2)
    expect(fake.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('defers follow-up work until the auth callback has returned, and contains its failures', async () => {
    const timers = createManualTimers()
    const order: string[] = []
    const failure = vi.spyOn(logger, 'error')
    deferAuthWork(() => {
      order.push('deferred')
    }, timers)
    deferAuthWork(() => Promise.reject(new Error('load failed')), timers)
    order.push('callback returned')
    timers.advance(0)
    await vi.waitFor(() => expect(failure).toHaveBeenCalledTimes(1))
    expect(order).toEqual(['callback returned', 'deferred'])
  })
})

describe('completeRedirect', () => {
  it('returns the session created from a valid email link', async () => {
    const fake = createFakeAuth()
    fake.auth.getSession.mockResolvedValue({ data: { session: authSession('u-4') }, error: null })
    const result = await createAuthService(fake.client).completeRedirect('http://localhost:5173/#/progress')
    expect(result).toEqual({ ok: true, session: { userId: 'u-4', email: EMAIL } })
  })

  it('reports an expired or reused link from the redirect error', async () => {
    const fake = createFakeAuth()
    fake.auth.initialize.mockResolvedValue({ error: new AuthImplicitGrantRedirectError('expired', { error: 'access_denied', code: 'otp_expired' }) })
    const result = await createAuthService(fake.client).completeRedirect('http://localhost:5173/#error_code=otp_expired')
    expect(result).toMatchObject({ ok: false, error: { code: 'link_invalid', message: expect.stringMatching(/same device/) } })
  })

  it('reports a link opened in another browser (the code was left unexchanged)', async () => {
    const fake = createFakeAuth()
    fake.auth.getSession.mockResolvedValue({ data: { session: authSession() }, error: null })
    const result = await createAuthService(fake.client).completeRedirect('http://localhost:5173/?code=4f1c2d#/')
    expect(result).toMatchObject({ ok: false, error: { code: 'link_invalid' } })
    expect(await createAuthService(fake.client).completeRedirect('not a url')).toMatchObject({ ok: true })
  })
})
