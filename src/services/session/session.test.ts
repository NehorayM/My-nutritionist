import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { isUuid, newId } from '@/lib/id'
import { getRepositories, hasRepositories, setRepositories } from '@/services/runtime'
import { useProfileStore } from '@/stores/profileStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useSyncStore } from '@/stores/syncStore'
import { fakeAuth, fakeConnectivity, fakeDeps } from './__fixtures__/sessionFakes'
import { createSessionController } from './controller'
import { getOrCreateGuestId, peekGuestId } from './guestId'

const account = { userId: newId(), email: 'noa@example.com' }

beforeEach(async () => {
  await deleteDatabase()
  setRepositories(null)
  useSessionStore.setState({ phase: 'booting', mode: null, userId: null, email: null, passwordRecovery: false })
  useSyncStore.setState({ connection: 'checking', sync: null, guestImport: null, importing: false, authNotice: null })
})

afterEach(() => setRepositories(null))

const flushDeferred = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('guest identity', () => {
  it('creates one stable guest id per device and survives a cleared localStorage', async () => {
    expect(await peekGuestId()).toBeNull()
    const id = await getOrCreateGuestId()
    expect(isUuid(id)).toBe(true)
    expect(await getOrCreateGuestId()).toBe(id)
    localStorage.clear()
    expect(await peekGuestId()).toBe(id)
  })
})

describe('session controller without Supabase', () => {
  it('starts directly in Offline/Local guest mode', async () => {
    const { deps, guestId } = fakeDeps()
    await createSessionController(deps).start()
    expect(useSessionStore.getState()).toMatchObject({ phase: 'ready', mode: 'guest', userId: guestId })
    expect(useSyncStore.getState().connection).toBe('unconfigured')
    expect(getRepositories().userId).toBe(guestId)
    await expect.poll(() => useProfileStore.getState().status).toBe('ready')
  })

  it('rejects account actions with a clear message', async () => {
    const controller = createSessionController(fakeDeps().deps)
    expect(await controller.signIn('a@b.co', 'secret-pass')).toEqual({ ok: false, message: expect.stringMatching(/not configured/) })
  })
})

describe('session controller with Supabase', () => {
  it('asks the user to choose when nobody is signed in, then remembers guest mode', async () => {
    const { deps, isPreferGuest } = fakeDeps({ auth: fakeAuth().service, connectivity: fakeConnectivity() })
    const controller = createSessionController(deps)
    await controller.start()
    expect(useSessionStore.getState().phase).toBe('welcome')
    expect(hasRepositories()).toBe(false)
    await controller.continueAsGuest()
    expect(useSessionStore.getState()).toMatchObject({ phase: 'ready', mode: 'guest' })
    expect(isPreferGuest()).toBe(true)
  })

  it('restores an existing session into cloud mode exactly once despite a racing auth event', async () => {
    const auth = fakeAuth(account)
    const { deps, clouds } = fakeDeps({ auth: auth.service, connectivity: fakeConnectivity() })
    await createSessionController(deps).start()
    auth.emit('SIGNED_IN', account)
    await flushDeferred()
    expect(useSessionStore.getState()).toMatchObject({ phase: 'ready', mode: 'cloud', userId: account.userId, email: account.email })
    expect(clouds).toHaveLength(1)
    expect(getRepositories().userId).toBe(account.userId)
    expect(useSyncStore.getState().sync?.state).toBe('idle')
  })

  it('signs in from the welcome screen and reports failures without changing mode', async () => {
    const auth = fakeAuth()
    const { deps } = fakeDeps({ auth: auth.service, connectivity: fakeConnectivity() })
    const controller = createSessionController(deps)
    await controller.start()
    auth.service.signIn = async () => ({ ok: false, error: { code: 'invalid_credentials', message: 'Email or password is incorrect.' } })
    expect(await controller.signIn('noa@example.com', 'wrong')).toEqual({ ok: false, message: 'Email or password is incorrect.' })
    expect(useSessionStore.getState().phase).toBe('welcome')
  })

  it('returns to the welcome screen with a notice when the session ends unexpectedly', async () => {
    const auth = fakeAuth(account)
    const { deps } = fakeDeps({ auth: auth.service, connectivity: fakeConnectivity() })
    await createSessionController(deps).start()
    auth.emit('SIGNED_OUT', null)
    await flushDeferred()
    expect(useSessionStore.getState()).toMatchObject({ phase: 'welcome', mode: null, userId: null })
    expect(useSyncStore.getState().authNotice).toMatch(/kept and will sync/)
    expect(hasRepositories()).toBe(false)
  })

  it('removes cached data on sign-out only when nothing is waiting to sync', async () => {
    const first = fakeDeps({ auth: fakeAuth(account).service, connectivity: fakeConnectivity() })
    const controller = createSessionController(first.deps)
    await controller.start()
    expect(await controller.signOut()).toEqual({ ok: true })
    expect(first.deps.clearUserData).toHaveBeenCalledWith(account.userId)

    const second = fakeDeps({ auth: fakeAuth(account).service, connectivity: fakeConnectivity() })
    const other = createSessionController(second.deps)
    await other.start()
    second.clouds[0]!.setUnsynced(3)
    await other.signOut()
    expect(second.deps.clearUserData).not.toHaveBeenCalled()
    expect(useSessionStore.getState().phase).toBe('welcome')
  })

  it('tracks password recovery until a new password is saved', async () => {
    const auth = fakeAuth()
    const controller = createSessionController(fakeDeps({ auth: auth.service, connectivity: fakeConnectivity() }).deps)
    await controller.start()
    auth.emit('PASSWORD_RECOVERY', account)
    expect(useSessionStore.getState().passwordRecovery).toBe(true)
    expect(await controller.updatePassword('a-new-strong-password')).toEqual({ ok: true })
    expect(useSessionStore.getState().passwordRecovery).toBe(false)
  })

  it('shows a notice when an email link cannot be used on this device', async () => {
    const auth = fakeAuth()
    auth.service.completeRedirect = async () => ({ ok: false, error: { code: 'link_invalid', message: 'Open the link on the same device.' } })
    await createSessionController(fakeDeps({ auth: auth.service, connectivity: fakeConnectivity() }).deps).start()
    expect(useSyncStore.getState().authNotice).toBe('Open the link on the same device.')
  })

  it('offers guest data after sign-in and imports it into the account', async () => {
    const { deps, guestSummary, clouds, guestId } = fakeDeps({ auth: fakeAuth(account).service, connectivity: fakeConnectivity() })
    guestSummary.total = 4
    guestSummary.counts.meals = 4
    const controller = createSessionController(deps)
    await controller.start()
    expect(useSyncStore.getState().guestImport).toMatchObject({ guestId, total: 4 })

    guestSummary.total = 0
    const result = await controller.importGuestData()
    expect(result.ok).toBe(true)
    const call = (deps.migrateGuestData as unknown as { mock: { calls: [{ guestId: string; userId: string; accountHasProfile: () => Promise<boolean> }][] } }).mock.calls[0]![0]
    expect(call).toMatchObject({ guestId, userId: account.userId })
    await expect(call.accountHasProfile()).resolves.toBe(false)
    expect(clouds[0]!.engine.requestFlush).toHaveBeenCalled()
    expect(useSyncStore.getState()).toMatchObject({ guestImport: null, importing: false })
  })

  it('keeps the offer and reports the message when the import fails', async () => {
    const { deps, guestSummary } = fakeDeps({ auth: fakeAuth(account).service, connectivity: fakeConnectivity() })
    guestSummary.total = 2
    deps.migrateGuestData = async () => ({
      ok: false,
      migrated: guestSummary.counts,
      skipped: guestSummary.counts,
      error: { message: 'The server is busy. Try again.', retryable: true },
    })
    const controller = createSessionController(deps)
    await controller.start()
    expect(await controller.importGuestData()).toEqual({ ok: false, message: 'The server is busy. Try again.' })
    expect(useSyncStore.getState().guestImport?.total).toBe(2)
  })
})
