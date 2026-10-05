import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { setRepositories } from '@/services/runtime'
import { useSessionStore } from '@/stores/sessionStore'
import { useSyncStore } from '@/stores/syncStore'
import { fakeAuth, fakeConnectivity, fakeDeps } from './__fixtures__/sessionFakes'
import { createSessionController } from './controller'
import { initSession, session } from './index'
import { startSession } from './startSession'

const account = { userId: newId(), email: 'noa@example.com' }

beforeEach(async () => {
  await deleteDatabase()
  setRepositories(null)
  useSessionStore.setState({ phase: 'booting', mode: null, userId: null, email: null, passwordRecovery: false })
  useSyncStore.setState({ connection: 'checking', sync: null, guestImport: null, importing: false, authNotice: null })
})

afterEach(() => setRepositories(null))

describe('session controller actions', () => {
  it('signs up: confirmation pending keeps the welcome screen, an immediate session enters cloud mode', async () => {
    const auth = fakeAuth()
    const controller = createSessionController(fakeDeps({ auth: auth.service, connectivity: fakeConnectivity() }).deps)
    await controller.start()
    expect(await controller.signUp('noa@example.com', 'long-enough-pass')).toEqual({ ok: true, needsConfirmation: true })
    expect(useSessionStore.getState().phase).toBe('welcome')

    auth.service.signUp = async () => ({ ok: true, needsConfirmation: false, session: account })
    expect(await controller.signUp('noa@example.com', 'long-enough-pass')).toEqual({ ok: true, needsConfirmation: false })
    expect(useSessionStore.getState()).toMatchObject({ mode: 'cloud', userId: account.userId })
  })

  it('reports sign-up failures and requests password resets with the app redirect URL', async () => {
    const auth = fakeAuth()
    const controller = createSessionController(fakeDeps({ auth: auth.service, connectivity: fakeConnectivity() }).deps)
    auth.service.signUp = async () => ({ ok: false, error: { code: 'user_already_exists', message: 'An account already uses this email.' } })
    expect(await controller.signUp('noa@example.com', 'long-enough-pass')).toMatchObject({ ok: false, error: { code: 'user_already_exists' } })
    expect(await controller.requestPasswordReset('noa@example.com')).toEqual({ ok: true })
    expect(auth.service.requestPasswordReset).toHaveBeenCalledWith('noa@example.com', 'http://localhost:5173/')
  })

  it('retries and discards failed sync changes, verifies connectivity, and dismisses notices', async () => {
    const connectivity = fakeConnectivity()
    const { deps, clouds } = fakeDeps({ auth: fakeAuth(account).service, connectivity })
    const controller = createSessionController(deps)
    await controller.start()
    expect(await controller.retryFailedSync()).toBe(2)
    expect(await controller.discardFailedSync()).toBe(1)
    expect(clouds[0]!.engine.retryFailed).toHaveBeenCalled()
    expect(await controller.verifyConnection()).toBe('connected')
    useSyncStore.setState({ authNotice: 'Something to read' })
    controller.dismissAuthNotice()
    expect(useSyncStore.getState().authNotice).toBeNull()
  })

  it('does nothing sync-related in guest mode and refuses imports without an account', async () => {
    const controller = createSessionController(fakeDeps().deps)
    await controller.start()
    expect(await controller.retryFailedSync()).toBe(0)
    expect(await controller.discardFailedSync()).toBe(0)
    expect(await controller.importGuestData()).toEqual({ ok: false, message: 'Sign in to import guest data.' })
    expect(await controller.signOut()).toMatchObject({ ok: false })
    expect(await controller.updatePassword('another-long-pass')).toMatchObject({ ok: false })
    expect(await controller.requestPasswordReset('a@b.co')).toMatchObject({ ok: false })
    expect(await controller.signUp('a@b.co', 'another-long-pass')).toMatchObject({ ok: false, error: { code: 'service_unavailable' } })
  })

  it('keeps the session when sign-out fails', async () => {
    const auth = fakeAuth(account)
    const controller = createSessionController(fakeDeps({ auth: auth.service, connectivity: fakeConnectivity() }).deps)
    await controller.start()
    auth.service.signOut = async () => ({ ok: false, error: { code: 'network', message: 'No connection.' } })
    expect(await controller.signOut()).toEqual({ ok: false, message: 'No connection.' })
    expect(useSessionStore.getState().mode).toBe('cloud')
  })
})

describe('default session wiring (no Supabase configured)', () => {
  it('starts in guest mode and remembers nothing about accounts', async () => {
    await startSession()
    expect(useSessionStore.getState()).toMatchObject({ phase: 'ready', mode: 'guest' })
    expect(useSyncStore.getState().connection).toBe('unconfigured')
    expect(await initSession()).toBe(session())
  })

  it('remembers the guest choice in localStorage', async () => {
    await session().continueAsGuest()
    expect(localStorage.getItem('mn.preferGuest')).toBe('1')
  })
})
