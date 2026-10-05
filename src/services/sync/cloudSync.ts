import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseRepositories, createRemoteTables, toDataClient, type RemoteOptions, type SupabaseDataClient } from '@/repositories/supabase'
import { createSyncedRepositories } from '@/repositories/synced'
import type { Repositories } from '@/repositories/types'
import type { ConnectivityMonitor } from './connectivity'
import { createOutbox, type Outbox } from './outbox'
import { createSyncEngine } from './syncEngine'
import type { SyncEngine } from './syncTypes'
import type { Clock, Timers } from './timers'

export interface CloudSyncOptions {
  client: SupabaseClient | SupabaseDataClient
  /** The signed-in user (auth.users.id). */
  userId: string
  /** The app-wide monitor (one per app, shared across sign-ins). */
  connectivity: Pick<ConnectivityMonitor, 'getState' | 'verify' | 'subscribe'>
  clock?: Clock
  timers?: Timers
  remoteOptions?: RemoteOptions
}

/** Everything cloud mode needs for one signed-in user. */
export interface CloudSync {
  /** Synced repositories for `services/runtime.setRepositories` (cache + outbox + Supabase). */
  repositories: Repositories
  /**
   * Direct Supabase access without the cache: for checks that must reflect the server and fail when
   * it can't be reached (e.g. `accountHasProfile` for the guest import).
   */
  remote: Repositories
  outbox: Outbox
  engine: SyncEngine
  /** Stops the engine's timers and listeners (call on sign-out or user change). Queued changes stay stored. */
  dispose(): void
}

/** Wires the outbox, sync engine and synced repositories of one user around a shared client. */
export function createCloudSync(options: CloudSyncOptions): CloudSync {
  const { client, userId, connectivity, clock, timers, remoteOptions } = options
  const outbox = createOutbox(userId, { clock })
  const engine = createSyncEngine({
    outbox,
    remote: createRemoteTables(toDataClient(client), userId, remoteOptions),
    connectivity,
    userId,
    clock,
    timers,
  })
  return {
    repositories: createSyncedRepositories({ userId, client, outbox, engine, connectivity, remoteOptions }),
    remote: createSupabaseRepositories(client, userId, remoteOptions),
    outbox,
    engine,
    dispose: () => engine.dispose(),
  }
}
