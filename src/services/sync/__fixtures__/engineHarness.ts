import { FakeSupabase } from '@/repositories/supabase/__fixtures__/fakeSupabase'
import { createRemoteTables } from '@/repositories/supabase'
import { makeMeal, testId, USER_A } from '@/schemas/__fixtures__/records'
import { SYNC_ENTITIES, type ConnectionState, type MealEntry, type SyncEntity } from '@/types'
import { createOutbox, type Outbox } from '../outbox'
import { createSyncEngine, type SyncEngine, type SyncEvent } from '../syncEngine'
import type { RemoteWriter, RemoteWriters } from '../syncSend'
import { createFakeConnectivity, createManualTimers, type ManualTimers } from './manualTimers'

export const NETWORK_DOWN = new TypeError('Failed to fetch')
export const CHECK_VIOLATION = { result: { error: { code: '23514', message: 'violates check constraint' }, status: 400 } }

export interface EngineHarness {
  db: FakeSupabase
  outbox: Outbox
  timers: ManualTimers
  connectivity: ReturnType<typeof createFakeConnectivity>
  /** `upsert:<id>` / `delete:<id>` for every send, in order. */
  sends: string[]
  events: SyncEvent[]
  engine: SyncEngine
  /** While `promise` is set, every send waits for it (holds a pass in flight). */
  hold: { promise: Promise<void> | null }
}

function recordIdOf(record: object): string {
  const id: unknown = 'id' in record ? record.id : 'userId' in record ? record.userId : ''
  return typeof id === 'string' ? id : ''
}

/** Wraps the real RemoteTables (over the in-memory PostgREST fake) to log sends and optionally hold them. */
function instrument(tables: RemoteWriters, sends: string[], hold: EngineHarness['hold']): RemoteWriters {
  const wrap = (entity: SyncEntity): RemoteWriter<object> => {
    // Each table validates the record itself, so the test wrapper can forward any record shape.
    const table = tables[entity] as RemoteWriter<object>
    return {
      upsert: async (record) => {
        sends.push(`upsert:${recordIdOf(record)}`)
        await hold.promise
        return table.upsert(record)
      },
      remove: async (id) => {
        sends.push(`delete:${id}`)
        await hold.promise
        return table.remove(id)
      },
    }
  }
  return Object.fromEntries(SYNC_ENTITIES.map((entity) => [entity, wrap(entity)])) as RemoteWriters
}

export interface EngineHarnessOptions {
  connection?: ConnectionState
  /** Replace parts of the real outbox (e.g. to simulate a storage failure). */
  wrapOutbox?: (outbox: Outbox) => Outbox
}

export function createEngineHarness({ connection = 'connected', wrapOutbox }: EngineHarnessOptions = {}): EngineHarness {
  const db = new FakeSupabase()
  const timers = createManualTimers()
  let mutationNo = 900
  const real = createOutbox(USER_A, { clock: timers.clock, newId: () => testId((mutationNo += 1)) })
  const outbox = wrapOutbox ? wrapOutbox(real) : real
  const connectivity = createFakeConnectivity(connection)
  const sends: string[] = []
  const hold: EngineHarness['hold'] = { promise: null }
  const remote = instrument(createRemoteTables(db, USER_A), sends, hold)
  const engine = createSyncEngine({ outbox, remote, connectivity, userId: USER_A, clock: timers.clock, timers })
  const events: SyncEvent[] = []
  engine.onEvent((event) => events.push(event))
  return { db, outbox: real, timers, connectivity, sends, events, engine, hold }
}

/** Holds every send until the returned function is called. */
export function holdSends(h: EngineHarness): () => void {
  let release = (): void => undefined
  h.hold.promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return () => {
    h.hold.promise = null
    release()
  }
}

export const meal = (n: number, overrides: Partial<MealEntry> = {}): MealEntry => makeMeal({ id: testId(n), ...overrides })

export const upsertMeal = (n: number, overrides: Partial<MealEntry> = {}) => ({
  entity: 'meal_logs' as const,
  op: 'upsert' as const,
  recordId: testId(n),
  payload: meal(n, overrides),
})
