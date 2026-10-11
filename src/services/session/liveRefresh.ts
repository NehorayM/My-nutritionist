import { logger } from '@/lib/logger'
import type { DataEvents } from '@/services/dataEvents'
import { browserTimers, type Timers } from '@/services/sync/timers'
import { SYNC_ENTITIES, type SyncEntity } from '@/types'

/** Page visibility (document in the app, a fake in tests). */
export interface VisibilitySource {
  isHidden(): boolean
  subscribe(listener: () => void): () => void
}

export interface LiveRefreshOptions {
  events: Pick<DataEvents, 'subscribe'>
  /** The signed-in user or guest whose data is on screen (null on the welcome screen). */
  currentUserId: () => string | null
  /** Reloads the stores that show these tables. */
  refresh: (entities: SyncEntity[]) => Promise<void>
  /** Changes arriving within this window are reloaded together. Default 250 ms. */
  debounceMs?: number
  /** A tab that was hidden at least this long reloads everything when shown again. Default 30 s. */
  staleAfterMs?: number
  timers?: Timers
  now?: () => number
  visibility?: VisibilitySource | null
}

function documentVisibility(): VisibilitySource | null {
  if (typeof document === 'undefined') return null
  return {
    isHidden: () => document.visibilityState === 'hidden',
    subscribe: (listener) => {
      document.addEventListener('visibilitychange', listener)
      return () => document.removeEventListener('visibilitychange', listener)
    },
  }
}

/**
 * Keeps screens current when data changes outside this tab's own actions: another tab, another device
 * (Realtime), a conflict the server resolved, or time spent in the background. Bursts of changes are
 * coalesced into one reload per store.
 */
export function startLiveRefresh(options: LiveRefreshOptions): () => void {
  const timers = options.timers ?? browserTimers
  const now = options.now ?? Date.now
  const debounceMs = options.debounceMs ?? 250
  const staleAfterMs = options.staleAfterMs ?? 30_000
  const visibility = options.visibility === undefined ? documentVisibility() : options.visibility
  const pending = new Set<SyncEntity>()
  let timer: number | null = null
  let hiddenSince: number | null = visibility?.isHidden() ? now() : null

  const flush = (): void => {
    timer = null
    const entities = [...pending]
    pending.clear()
    if (entities.length === 0 || options.currentUserId() === null) return
    options.refresh(entities).catch((error: unknown) => logger.warn('live-refresh', 'Reloading changed data failed', error))
  }

  const schedule = (entities: readonly SyncEntity[]): void => {
    for (const entity of entities) pending.add(entity)
    if (timer === null) timer = timers.setTimeout(flush, debounceMs)
  }

  const unsubscribeEvents = options.events.subscribe((change) => {
    if (change.userId === options.currentUserId()) schedule(change.entities)
  })
  const unsubscribeVisibility = visibility?.subscribe(() => {
    if (visibility.isHidden()) {
      hiddenSince = now()
      return
    }
    const away = hiddenSince === null ? 0 : now() - hiddenSince
    hiddenSince = null
    if (away >= staleAfterMs) schedule(SYNC_ENTITIES)
  })

  return () => {
    unsubscribeEvents()
    unsubscribeVisibility?.()
    if (timer !== null) timers.clearTimeout(timer)
    timer = null
    pending.clear()
  }
}
