import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { createRemoteTables } from '@/repositories/supabase'
import { testId, USER_A, USER_B } from '@/schemas/__fixtures__/records'
import { createEngineHarness, holdSends, meal, NETWORK_DOWN, upsertMeal, type EngineHarness } from './__fixtures__/engineHarness'
import { createOutbox } from './outbox'
import { createSyncEngine } from './syncEngine'

let harness: EngineHarness | null = null
const setup = (connection: 'connected' | 'offline' | 'unconfigured' = 'connected'): EngineHarness =>
  (harness = createEngineHarness({ connection }))

const upsertsOf = (h: EngineHarness, id: string) => h.db.calls.filter((call) => call.method === 'upsert' && call.values?.id === id)

beforeEach(async () => {
  await deleteDatabase()
})

afterEach(async () => {
  harness?.engine.dispose()
  harness = null
  await deleteDatabase()
})

describe('sync engine: concurrency and triggers', () => {
  it('never sends a mutation twice when flushes are requested concurrently', async () => {
    const h = setup()
    for (const n of [1, 2, 3]) await h.outbox.enqueue(upsertMeal(n))
    const release = holdSends(h)
    const first = h.engine.flushNow()
    const second = h.engine.flushNow()
    h.engine.requestFlush()
    h.timers.advance(0)
    await vi.waitFor(() => expect(h.sends).toHaveLength(1))
    expect(h.engine.getStatus().state).toBe('syncing')
    release()
    await Promise.all([first, second, h.engine.flushNow()])
    expect(h.sends).toEqual([1, 2, 3].map((n) => `upsert:${testId(n)}`))
    expect(h.db.rows('meal_logs')).toHaveLength(3)
  })

  it('sends the newest version when a record changes while its older version is in flight', async () => {
    const h = setup()
    await h.outbox.enqueue(upsertMeal(1, { mealType: 'breakfast' }))
    const release = holdSends(h)
    const pass = h.engine.flushNow()
    await vi.waitFor(() => expect(h.sends).toHaveLength(1))
    await h.outbox.enqueue(upsertMeal(1, { mealType: 'lunch', updatedAt: '2026-10-03T09:00:00.000Z' }))
    h.engine.requestFlush()
    h.timers.advance(0)
    release()
    await pass
    await vi.waitFor(() => expect(h.sends).toHaveLength(2))
    await vi.waitFor(async () => expect(await h.outbox.list()).toEqual([]))
    expect(h.db.rows('meal_logs')).toEqual([expect.objectContaining({ id: testId(1), meal_type: 'lunch' })])
  })

  it('skips a queued version that was replaced after the pass listed it, sending only the newest one', async () => {
    const h = setup()
    await h.outbox.enqueue(upsertMeal(1))
    await h.outbox.enqueue(upsertMeal(2, { mealType: 'breakfast' }))
    const release = holdSends(h)
    const pass = h.engine.flushNow()
    await vi.waitFor(() => expect(h.sends).toEqual([`upsert:${testId(1)}`]))
    await h.outbox.enqueue(upsertMeal(2, { mealType: 'dinner', updatedAt: '2026-10-03T09:00:00.000Z' }))
    release()
    await pass
    await h.engine.flushNow()
    expect(upsertsOf(h, testId(2))).toHaveLength(1)
    expect(h.db.rows('meal_logs')).toEqual([
      expect.objectContaining({ id: testId(1) }),
      expect.objectContaining({ id: testId(2), meal_type: 'dinner' }),
    ])
  })

  it('flushes on its own when a change is queued directly in the outbox', async () => {
    const h = setup()
    h.timers.advance(0)
    await vi.waitFor(() => expect(h.engine.getStatus().lastSyncedAt).not.toBeNull())
    await h.outbox.enqueue(upsertMeal(1))
    await vi.waitFor(() => expect(h.timers.scheduled()).toEqual([0]))
    h.timers.advance(0)
    await vi.waitFor(() => expect(h.engine.getStatus()).toMatchObject({ state: 'idle', pending: 0 }))
    expect(h.sends).toEqual([`upsert:${testId(1)}`])
  })

  it('waits while offline and flushes on reconnect, ignoring the remaining backoff', async () => {
    const h = setup()
    await h.outbox.enqueue(upsertMeal(1))
    h.db.failNext({ throws: NETWORK_DOWN })
    await h.engine.flushNow()
    h.connectivity.set('offline')
    expect(h.engine.getStatus()).toMatchObject({ state: 'offline', pending: 1 })
    await h.outbox.enqueue(upsertMeal(2))
    await h.engine.flushNow()
    expect(h.sends).toHaveLength(1)

    h.connectivity.set('connected')
    h.timers.advance(0)
    await vi.waitFor(() => expect(h.engine.getStatus()).toMatchObject({ state: 'idle', pending: 0 }))
    expect(h.db.rows('meal_logs')).toHaveLength(2)
  })

  it('verifies a connection that is still being checked before deciding to send', async () => {
    const h = setup()
    h.connectivity.set('checking')
    h.connectivity.verify = () => {
      h.connectivity.set('connected')
      return Promise.resolve('connected')
    }
    await h.outbox.enqueue(upsertMeal(1))
    await h.engine.flushNow()
    expect(h.sends).toEqual([`upsert:${testId(1)}`])
  })

  it('stays offline and sends nothing in Offline/Local mode', async () => {
    const h = setup('unconfigured')
    await h.outbox.enqueue(upsertMeal(1))
    expect(await h.engine.flushNow()).toMatchObject({ state: 'offline', pending: 1 })
    expect(h.db.calls).toEqual([])
  })

  it('never duplicates a record when a write that reached the server is retried', async () => {
    const h = setup()
    await h.outbox.enqueue(upsertMeal(1))
    // The first attempt reaches the server but the response is lost (timeout).
    await createRemoteTables(h.db, USER_A).meal_logs.upsert(meal(1))
    h.db.failNext({ throws: new DOMException('signal timed out', 'TimeoutError') })
    await h.engine.flushNow()
    expect(h.engine.getStatus().pending).toBe(1)
    await h.engine.flushNow({ force: true })
    expect(h.db.rows('meal_logs')).toHaveLength(1)
    expect(h.engine.getStatus()).toMatchObject({ state: 'idle', pending: 0 })
  })

  it('publishes status changes and stops all timers when disposed', async () => {
    const h = setup()
    const seen: string[] = []
    h.engine.subscribe((status) => seen.push(`${status.state}:${status.pending}`))
    await h.outbox.enqueue(upsertMeal(1))
    await vi.waitFor(() => expect(seen).toEqual(['idle:1']))
    h.db.failNext({ throws: NETWORK_DOWN })
    await h.engine.flushNow()
    expect(seen).toEqual(['idle:1', 'syncing:1', 'error:1'])
    expect(h.timers.scheduled().length).toBeGreaterThan(0)
    h.engine.dispose()
    expect(h.timers.scheduled()).toEqual([])
    h.engine.requestFlush()
    expect(h.timers.scheduled()).toEqual([])
    expect(await h.engine.flushNow()).toMatchObject({ pending: 1 })
    expect(h.sends).toHaveLength(1)
  })

  it('refuses an outbox that belongs to another user', () => {
    const h = setup()
    const create = () =>
      createSyncEngine({ outbox: createOutbox(USER_B), remote: createRemoteTables(h.db, USER_A), connectivity: h.connectivity, userId: USER_A })
    expect(create).toThrow(/different user/)
  })
})
