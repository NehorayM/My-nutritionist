/**
 * Cloud-mode sync: an IndexedDB outbox per user, the sync engine that flushes it to Supabase, and the
 * connectivity monitor. Bootstrap creates ONE `createConnectivityMonitor({ config: supabaseConfig })`
 * and, per signed-in user, `createCloudSync({ client, userId, connectivity })`.
 */
export { createCloudSync, type CloudSync, type CloudSyncOptions } from './cloudSync'
export {
  createConnectivityMonitor,
  DEFAULT_VERIFY_TIMEOUT_MS,
  HEALTH_PATH,
  type ConnectivityMonitor,
  type ConnectivityOptions,
  type ConnectivityTarget,
  type NetworkEvents,
} from './connectivity'
export { createOutbox, type EnqueueOptions, type Outbox, type OutboxOptions, type RetrySchedule } from './outbox'
export type { OutboxCounts } from './outboxIndex'
export type { EnqueueInput } from './coalesce'
export { createSyncEngine } from './syncEngine'
export type { FlushOptions, SyncEngine, SyncEngineOptions, SyncEvent, SyncState, SyncStatus } from './syncTypes'
export type { RemoteWriter, RemoteWriters } from './syncSend'
export { backoffDelayMs, DEFAULT_BACKOFF, type BackoffPolicy } from './backoff'
export { browserTimers, systemClock, type Clock, type Timers } from './timers'
