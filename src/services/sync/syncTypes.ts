import type { BackoffPolicy } from './backoff'
import type { ConnectivityMonitor } from './connectivity'
import type { Outbox } from './outbox'
import type { RemoteWriters } from './syncSend'
import type { Clock, Timers } from './timers'

/** Public types of the sync engine (status for the UI, events for toasts, options). */
export type SyncState = 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncStatus {
  state: SyncState
  pending: number
  failed: number
  /** When every due change was last confirmed by the server (ISO), or null. */
  lastSyncedAt: string | null
  /** Neutral, user-facing description of the current problem, or null. */
  lastError: string | null
}

/** One-off notifications for toasts: `count` mutations were synced / newly marked failed in one pass. */
export type SyncEvent = { type: 'synced'; count: number } | { type: 'failed'; count: number }

export interface SyncEngineOptions {
  outbox: Outbox
  remote: RemoteWriters
  connectivity: Pick<ConnectivityMonitor, 'getState' | 'verify' | 'subscribe'>
  userId: string
  clock?: Clock
  timers?: Timers
  backoff?: BackoffPolicy
}

export interface FlushOptions {
  /** Ignore retry backoff (used on reconnect). */
  force?: boolean
}

export interface SyncEngine {
  /** Schedules a flush on the next tick; many requests in one tick become one pass. */
  requestFlush(options?: FlushOptions): void
  /** Runs a pass now (or joins the running one and runs again after it); resolves with the status. */
  flushNow(options?: FlushOptions): Promise<SyncStatus>
  getStatus(): SyncStatus
  subscribe(listener: (status: SyncStatus) => void): () => void
  onEvent(listener: (event: SyncEvent) => void): () => void
  /** Moves failed changes back to the queue (all, or `ids`) and flushes. */
  retryFailed(ids?: readonly string[]): Promise<number>
  discardFailed(ids?: readonly string[]): Promise<number>
  dispose(): void
}
