import { FakeSupabase } from '@/repositories/supabase/__fixtures__/fakeSupabase'
import { createRemoteTables } from '@/repositories/supabase'
import { USER_A } from '@/schemas/__fixtures__/records'
import { createFakeConnectivity, createManualTimers } from '@/services/sync/__fixtures__/manualTimers'
import { createOutbox } from '@/services/sync/outbox'
import { createSyncEngine } from '@/services/sync/syncEngine'
import { createSyncedRepositories } from '../index'

/**
 * Cloud-mode stack for tests: synced repositories over an in-memory PostgREST fake, the real outbox
 * (fake-indexeddb) and the real sync engine driven by manual timers. Nothing is sent until the test
 * advances the timers or flushes the engine.
 */
export function createCloudHarness(initial: 'connected' | 'offline' = 'connected', userId = USER_A) {
  const server = new FakeSupabase()
  const timers = createManualTimers()
  const outbox = createOutbox(userId, { clock: timers.clock })
  const connectivity = createFakeConnectivity(initial)
  const engine = createSyncEngine({
    outbox,
    remote: createRemoteTables(server, userId),
    connectivity,
    userId,
    clock: timers.clock,
    timers,
  })
  const repos = createSyncedRepositories({ userId, client: server, outbox, engine, connectivity })
  /** Number of read requests the fake server has answered. */
  const reads = () => server.calls.filter((call) => call.method === 'select').length
  return { server, timers, outbox, connectivity, engine, repos, reads }
}

export type CloudHarness = ReturnType<typeof createCloudHarness>
