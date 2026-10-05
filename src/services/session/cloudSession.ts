import { notify } from '@/lib/notify'
import type { AuthSession } from '@/services/auth'
import { setRepositories } from '@/services/runtime'
import type { CloudSync, SyncEvent, SyncStatus } from '@/services/sync'
import { resetUserStores } from '@/stores/registry'
import { useSessionStore } from '@/stores/sessionStore'
import { useSyncStore } from '@/stores/syncStore'
import { loadSharedData } from './sharedData'
import type { SessionDeps } from './types'

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** Owns the active signed-in user's sync stack and mirrors its status into the sync store. */
export function createCloudSession(deps: SessionDeps) {
  let cloud: CloudSync | null = null
  let cleanups: Array<() => void> = []
  // Only announce successful syncs after a period offline/with errors — not after every edit.
  let recovering = false

  function onStatus(status: SyncStatus): void {
    if (status.state === 'offline' || status.state === 'error') recovering = true
    useSyncStore.setState({ sync: status })
  }

  function onEvent(event: SyncEvent): void {
    if (event.type === 'failed' && event.count > 0) {
      notify.error(`${plural(event.count, 'change')} couldn't sync`, { description: 'Review them in Profile → Sync.' })
    } else if (event.type === 'synced' && event.count > 0 && recovering) {
      recovering = false
      notify.success(`Back online — ${plural(event.count, 'change')} synced`)
    }
  }

  async function refreshGuestOffer(): Promise<void> {
    const guestId = await deps.guestIds.peek()
    if (!guestId) {
      useSyncStore.setState({ guestImport: null })
      return
    }
    const summary = await deps.countGuestData(guestId).catch(() => null)
    useSyncStore.setState({ guestImport: summary && summary.total > 0 ? { guestId, ...summary } : null })
  }

  function stop(): void {
    for (const cleanup of cleanups) cleanup()
    cleanups = []
    cloud?.dispose()
    cloud = null
    useSyncStore.setState({ sync: null, guestImport: null })
  }

  async function enter(session: AuthSession): Promise<void> {
    const current = useSessionStore.getState()
    if (current.mode === 'cloud' && current.userId === session.userId && cloud) {
      useSessionStore.setState({ email: session.email })
      return
    }
    stop()
    deps.preferGuest.set(false)
    const next = deps.createCloud(session.userId)
    cloud = next
    recovering = false
    resetUserStores()
    setRepositories(next.repositories)
    cleanups = [next.engine.subscribe(onStatus), next.engine.onEvent(onEvent)]
    useSyncStore.setState({ sync: next.engine.getStatus(), authNotice: null })
    useSessionStore.setState({ phase: 'ready', mode: 'cloud', userId: session.userId, email: session.email })
    loadSharedData()
    next.engine.requestFlush()
    await refreshGuestOffer()
    const offer = useSyncStore.getState().guestImport
    if (offer) {
      notify.info(`${plural(offer.total, 'item')} from guest mode are on this device`, {
        description: 'You can import them into your account in Profile.',
      })
    }
  }

  /** Pending + failed changes not yet confirmed by the server (0 outside cloud mode). */
  async function unsyncedCount(): Promise<number> {
    if (!cloud) return 0
    const counts = await cloud.outbox.counts()
    return counts.pending + counts.failed
  }

  return {
    enter,
    stop,
    refreshGuestOffer,
    unsyncedCount,
    active: (): CloudSync | null => cloud,
  }
}

export type CloudSession = ReturnType<typeof createCloudSession>
