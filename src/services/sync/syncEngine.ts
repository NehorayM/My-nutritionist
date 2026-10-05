import { logger } from '@/lib/logger'
import { backoffDelayMs, DEFAULT_BACKOFF } from './backoff'
import { createListenerSet } from './listeners'
import type { OutboxCounts } from './outboxIndex'
import { runSendPass } from './syncPass'
import { rejectedMessage, RETRY_MESSAGES, WAITING_MESSAGE } from './syncSend'
import type { FlushOptions, SyncEngine, SyncEngineOptions, SyncEvent, SyncState, SyncStatus } from './syncTypes'
import { browserTimers, systemClock } from './timers'

export type { FlushOptions, SyncEngine, SyncEngineOptions, SyncEvent, SyncState, SyncStatus } from './syncTypes'

const STORAGE_PROBLEM = 'Couldn’t read the changes saved on this device. Sync will try again shortly.'

/**
 * Sends one user's outbox to Supabase. FIFO and single-flight (a pass never overlaps another, so
 * each queued mutation is sent once per pass; upserts/deletes by id make any retry idempotent).
 * Retryable errors back off exponentially (2 s → 5 min) and stop the pass so later changes never
 * overtake earlier ones; rejected changes are marked failed and the pass continues.
 * Triggers: a growing queue (and explicit `requestFlush`), connectivity → 'connected', the retry timer.
 */
export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  const { outbox, remote, connectivity } = options
  if (outbox.userId !== options.userId) throw new Error('The outbox belongs to a different user')
  const clock = options.clock ?? systemClock
  const timers = options.timers ?? browserTimers
  const policy = options.backoff ?? DEFAULT_BACKOFF
  const statusListeners = createListenerSet<SyncStatus>('sync')
  const eventListeners = createListenerSet<SyncEvent>('sync')

  let counts: OutboxCounts = { pending: 0, failed: 0 }
  let lastSyncedAt: string | null = null
  /** True while the queue head waits for its retry time; `retryProblem` says why (when known). */
  let waiting = false
  let retryProblem: string | null = null
  let running = false
  let status = computeStatus()
  let inFlight: Promise<void> | null = null
  let rerun = false
  let forceNext = false
  let kick: number | null = null
  let retryTimer: number | null = null
  let storageErrors = 0
  let disposed = false

  function computeStatus(): SyncStatus {
    const connection = connectivity.getState()
    const offline = connection === 'offline' || connection === 'unconfigured'
    const state: SyncState = running ? 'syncing' : offline ? 'offline' : waiting || counts.failed > 0 ? 'error' : 'idle'
    const lastError = waiting ? (retryProblem ?? WAITING_MESSAGE) : counts.failed > 0 ? rejectedMessage(counts.failed) : null
    return { state, ...counts, lastSyncedAt, lastError }
  }

  const publish = (): void => {
    const next = computeStatus()
    const changed = (Object.keys(next) as (keyof SyncStatus)[]).some((key) => next[key] !== status[key])
    status = next
    if (changed && !disposed) statusListeners.emit(next)
  }

  const clearRetryTimer = (): void => {
    if (retryTimer !== null) timers.clearTimeout(retryTimer)
    retryTimer = null
  }

  const scheduleRetry = (delayMs: number): void => {
    clearRetryTimer()
    if (disposed) return
    retryTimer = timers.setTimeout(() => {
      retryTimer = null
      requestFlush()
    }, Math.max(0, delayMs))
  }

  const refreshCounts = async (): Promise<void> => {
    counts = await outbox.counts()
    publish()
  }

  const runPass = async (force: boolean): Promise<void> => {
    let connection = connectivity.getState()
    if (connection === 'checking') connection = await connectivity.verify()
    if (connection !== 'connected' || disposed) {
      await refreshCounts()
      return
    }
    running = true
    publish()
    try {
      const result = await runSendPass({ outbox, remote, clock, policy, force, isCancelled: () => disposed })
      storageErrors = 0
      waiting = result.retryAt !== null
      if (result.retryKind !== null) retryProblem = RETRY_MESSAGES[result.retryKind]
      if (result.retryKind === 'unreachable') void connectivity.verify()
      if (result.retryAt !== null) scheduleRetry(result.retryAt - clock().getTime())
      else {
        retryProblem = null
        lastSyncedAt = clock().toISOString()
      }
      if (result.sent > 0) eventListeners.emit({ type: 'synced', count: result.sent })
      if (result.rejected > 0) eventListeners.emit({ type: 'failed', count: result.rejected })
    } catch (error) {
      // Local storage failed (the queue could not be read or updated): try again later.
      logger.warn('sync', 'A sync pass could not complete', error)
      storageErrors += 1
      waiting = true
      retryProblem = STORAGE_PROBLEM
      scheduleRetry(backoffDelayMs(storageErrors, policy))
    } finally {
      running = false
    }
    await refreshCounts().catch(publish)
  }

  const flushNow = (opts: FlushOptions = {}): Promise<SyncStatus> => {
    if (opts.force) forceNext = true
    if (disposed) return Promise.resolve(status)
    if (inFlight) {
      rerun = true
      return inFlight.then(() => status)
    }
    clearRetryTimer()
    const pass = (async () => {
      let again = true
      while (again) {
        rerun = false
        const force = forceNext
        forceNext = false
        await runPass(force)
        again = rerun && !disposed
      }
    })().finally(() => {
      inFlight = null
    })
    inFlight = pass
    return pass.then(() => status)
  }

  function requestFlush(opts: FlushOptions = {}): void {
    if (opts.force) forceNext = true
    if (disposed || kick !== null) return
    kick = timers.setTimeout(() => {
      kick = null
      flushNow().catch((error: unknown) => logger.warn('sync', 'Flush failed', error))
    }, 0)
  }

  // A change queued by anyone (repositories, guest import, Retry) triggers a flush.
  const unsubscribeOutbox = outbox.subscribe((next) => {
    const queued = next.pending > counts.pending
    counts = next
    publish()
    if (queued) requestFlush()
  })
  const unsubscribeConnectivity = connectivity.subscribe((state) => {
    publish()
    if (state === 'connected') requestFlush({ force: true })
  })
  refreshCounts().catch((error: unknown) => logger.warn('sync', 'Could not count queued changes', error))
  requestFlush()

  return {
    requestFlush,
    flushNow,
    getStatus: () => status,
    subscribe: (listener) => statusListeners.add(listener),
    onEvent: (listener) => eventListeners.add(listener),
    async retryFailed(ids) {
      const count = await outbox.retryFailed(ids)
      if (count > 0) requestFlush()
      return count
    },
    discardFailed: (ids) => outbox.discardFailed(ids),
    dispose() {
      disposed = true
      if (kick !== null) timers.clearTimeout(kick)
      kick = null
      clearRetryTimer()
      unsubscribeOutbox()
      unsubscribeConnectivity()
      statusListeners.clear()
      eventListeners.clear()
    },
  }
}
