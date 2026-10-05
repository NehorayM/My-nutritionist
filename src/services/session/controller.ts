import { logger } from '@/lib/logger'
import type { AuthEvent, AuthResult, AuthSession } from '@/services/auth'
import { deferAuthWork } from '@/services/auth/defer'
import { setRepositories } from '@/services/runtime'
import { resetUserStores } from '@/stores/registry'
import { useSessionStore } from '@/stores/sessionStore'
import { useSyncStore } from '@/stores/syncStore'
import { createCloudSession } from './cloudSession'
import { loadSharedData } from './sharedData'
import type { ActionResult, SessionDeps } from './types'

const NOT_CONFIGURED_MESSAGE = 'Accounts are not available because Supabase is not configured.'
const NOT_CONFIGURED: ActionResult = { ok: false, message: NOT_CONFIGURED_MESSAGE }
const SIGNED_OUT_NOTICE =
  'You were signed out. Changes made on this device are kept and will sync when you sign in again.'

function asAction(result: AuthResult): ActionResult {
  return result.ok ? { ok: true } : { ok: false, message: result.error.message }
}

/** Decides guest vs account mode and performs every session transition, one at a time. */
export function createSessionController(deps: SessionDeps) {
  const cloud = createCloudSession(deps)
  let queue: Promise<void> = Promise.resolve()
  let started = false
  let signingOut = false

  /** Transitions never overlap (e.g. a SIGNED_IN event racing the startup session check). */
  function serial(task: () => Promise<void>): Promise<void> {
    queue = queue.then(task, task).catch((error: unknown) => logger.error('session', 'Session transition failed', error))
    return queue
  }

  async function enterGuest(): Promise<void> {
    cloud.stop()
    const guestId = await deps.guestIds.getOrCreate()
    resetUserStores()
    setRepositories(deps.createLocal(guestId))
    useSessionStore.setState({ phase: 'ready', mode: 'guest', userId: guestId, email: null })
    loadSharedData()
  }

  async function toWelcome(notice: string | null): Promise<void> {
    cloud.stop()
    resetUserStores()
    setRepositories(null)
    useSessionStore.setState({ phase: 'welcome', mode: null, userId: null, email: null, passwordRecovery: false })
    if (notice) useSyncStore.setState({ authNotice: notice })
  }

  function onAuthEvent(event: AuthEvent, session: AuthSession | null): void {
    if (event === 'PASSWORD_RECOVERY') useSessionStore.setState({ passwordRecovery: true })
    if (!started) return
    if (session && event !== 'SIGNED_OUT') {
      deferAuthWork(() => serial(() => cloud.enter(session)))
    } else if (event === 'SIGNED_OUT' && !signingOut && useSessionStore.getState().mode === 'cloud') {
      deferAuthWork(() => serial(() => toWelcome(SIGNED_OUT_NOTICE)))
    }
  }

  async function start(): Promise<void> {
    deps.connectivity.subscribe((connection) => useSyncStore.setState({ connection }))
    useSyncStore.setState({ connection: deps.connectivity.getState() })
    const { auth } = deps
    if (!auth) {
      started = true
      await serial(enterGuest)
      return
    }
    auth.onAuthStateChange(onAuthEvent)
    void deps.connectivity.verify()
    const redirect = await auth.completeRedirect(deps.currentUrl())
    if (!redirect.ok) useSyncStore.setState({ authNotice: redirect.error.message })
    const current = await auth.getSession()
    started = true
    const session = current.ok ? current.session : null
    if (session) await serial(() => cloud.enter(session))
    else if (deps.preferGuest.get()) await serial(enterGuest)
    else useSessionStore.setState({ phase: 'welcome' })
  }

  async function signIn(email: string, password: string): Promise<ActionResult> {
    if (!deps.auth) return NOT_CONFIGURED
    const result = await deps.auth.signIn(email, password)
    if (result.ok) await serial(() => cloud.enter(result.session))
    return asAction(result)
  }

  async function signUp(email: string, password: string): Promise<AuthResult<{ needsConfirmation: boolean }>> {
    if (!deps.auth) return { ok: false, error: { code: 'service_unavailable', message: NOT_CONFIGURED_MESSAGE } }
    const result = await deps.auth.signUp(email, password, deps.redirectUrl())
    if (result.ok && result.session) {
      const session = result.session
      await serial(() => cloud.enter(session))
    }
    return result.ok ? { ok: true, needsConfirmation: result.needsConfirmation } : result
  }

  /** Signs out on this device. Cached data is removed unless changes are still waiting to sync. */
  async function signOut(): Promise<ActionResult> {
    if (!deps.auth) return NOT_CONFIGURED
    const userId = useSessionStore.getState().userId
    const unsynced = await cloud.unsyncedCount()
    signingOut = true
    try {
      const result = await deps.auth.signOut()
      if (!result.ok) return asAction(result)
      await serial(async () => {
        await toWelcome(null)
        if (userId && unsynced === 0) await deps.clearUserData(userId)
      })
      return { ok: true }
    } finally {
      signingOut = false
    }
  }

  async function continueAsGuest(): Promise<void> {
    deps.preferGuest.set(true)
    useSyncStore.setState({ authNotice: null })
    await serial(enterGuest)
  }

  async function requestPasswordReset(email: string): Promise<ActionResult> {
    if (!deps.auth) return NOT_CONFIGURED
    return asAction(await deps.auth.requestPasswordReset(email, deps.redirectUrl()))
  }

  async function updatePassword(password: string): Promise<ActionResult> {
    if (!deps.auth) return NOT_CONFIGURED
    const result = await deps.auth.updatePassword(password)
    if (result.ok) useSessionStore.setState({ passwordRecovery: false })
    return asAction(result)
  }

  async function importGuestData(): Promise<ActionResult & { imported?: number }> {
    const offer = useSyncStore.getState().guestImport
    const { mode, userId } = useSessionStore.getState()
    const active = cloud.active()
    if (!offer || !active || mode !== 'cloud' || !userId) return { ok: false, message: 'Sign in to import guest data.' }
    useSyncStore.setState({ importing: true })
    try {
      const result = await deps.migrateGuestData({
        guestId: offer.guestId,
        userId,
        target: active.repositories,
        nowIso: deps.now().toISOString(),
        accountHasProfile: async () => (await active.remote.profile.get()) !== null,
      })
      if (!result.ok) return { ok: false, message: result.error.message }
      resetUserStores()
      loadSharedData()
      active.engine.requestFlush()
      return { ok: true, imported: Object.values(result.migrated).reduce((sum, n) => sum + n, 0) }
    } finally {
      await cloud.refreshGuestOffer()
      useSyncStore.setState({ importing: false })
    }
  }

  return {
    start,
    signIn,
    signUp,
    signOut,
    continueAsGuest,
    requestPasswordReset,
    updatePassword,
    importGuestData,
    retryFailedSync: async (): Promise<number> => (await cloud.active()?.engine.retryFailed()) ?? 0,
    discardFailedSync: async (): Promise<number> => (await cloud.active()?.engine.discardFailed()) ?? 0,
    verifyConnection: () => deps.connectivity.verify(),
    dismissAuthNotice: () => useSyncStore.setState({ authNotice: null }),
  }
}

export type SessionController = ReturnType<typeof createSessionController>
