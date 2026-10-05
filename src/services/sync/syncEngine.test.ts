import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDatabase, openDatabase } from '@/lib/idb'
import { makeFood, makeWeight, testId } from '@/schemas/__fixtures__/records'
import {
  CHECK_VIOLATION,
  createEngineHarness,
  NETWORK_DOWN,
  upsertMeal,
  type EngineHarness,
  type EngineHarnessOptions,
} from './__fixtures__/engineHarness'
import type { Outbox } from './outbox'
import { WAITING_MESSAGE } from './syncSend'

let harness: EngineHarness | null = null
const setup = (options?: EngineHarnessOptions): EngineHarness => (harness = createEngineHarness(options))

beforeEach(async () => {
  await deleteDatabase()
})

afterEach(async () => {
  harness?.engine.dispose()
  harness = null
  await deleteDatabase()
})

describe('sync engine: sending', () => {
  it('sends queued changes in FIFO order, empties the queue and reports them', async () => {
    const h = setup()
    const food = makeFood({ id: testId(1) })
    await h.outbox.enqueue({ entity: 'food_items', op: 'upsert', recordId: food.id, payload: food })
    await h.outbox.enqueue(upsertMeal(2, { foodId: food.id }))
    await h.outbox.enqueue({ entity: 'weight_logs', op: 'upsert', recordId: testId(3), payload: makeWeight({ id: testId(3) }) })
    await h.outbox.enqueue({ entity: 'meal_logs', op: 'delete', recordId: testId(4), payload: null })

    const status = await h.engine.flushNow()
    expect(h.sends).toEqual([`upsert:${testId(1)}`, `upsert:${testId(2)}`, `upsert:${testId(3)}`, `delete:${testId(4)}`])
    expect(h.db.rows('meal_logs').map((row) => row.id)).toEqual([testId(2)])
    expect(await h.outbox.list()).toEqual([])
    expect(status).toEqual({ state: 'idle', pending: 0, failed: 0, lastSyncedAt: '2026-10-04T08:00:00.000Z', lastError: null })
    expect(h.events).toEqual([{ type: 'synced', count: 4 }])
  })

  it('backs off on network failures (2 s, then 4 s), stops the pass, then retries successfully', async () => {
    const h = setup()
    await h.outbox.enqueue(upsertMeal(1))
    await h.outbox.enqueue(upsertMeal(2))
    h.db.failNext({ throws: NETWORK_DOWN })
    let status = await h.engine.flushNow()
    expect(h.sends).toEqual([`upsert:${testId(1)}`])
    expect(status).toMatchObject({ state: 'error', pending: 2, failed: 0, lastSyncedAt: null })
    expect(status.lastError).toMatch(/saved on this device/)
    expect((await h.outbox.list())[0]).toMatchObject({ attempts: 1, nextAttemptAt: '2026-10-04T08:00:02.000Z' })
    expect(h.connectivity.verifications()).toBe(1)

    // A write during the backoff does not overtake the waiting head.
    status = await h.engine.flushNow()
    expect(h.sends).toHaveLength(1)
    h.db.failNext({ throws: NETWORK_DOWN })
    h.timers.advance(2_000)
    await vi.waitFor(() => expect(h.sends).toHaveLength(2))
    await vi.waitFor(async () => expect((await h.outbox.list())[0]?.attempts).toBe(2))
    expect(h.timers.scheduled()).toContain(4_000)

    h.timers.advance(4_000)
    await vi.waitFor(() => expect(h.engine.getStatus()).toMatchObject({ state: 'idle', pending: 0, lastError: null }))
    expect(h.db.rows('meal_logs').map((row) => row.id)).toEqual([testId(1), testId(2)])
    expect(h.events).toEqual([{ type: 'synced', count: 2 }])
  })

  it('marks rejected changes as failed, keeps processing later ones, and retries them on request', async () => {
    const h = setup()
    await h.outbox.enqueue(upsertMeal(1))
    await h.outbox.enqueue(upsertMeal(2))
    h.db.failNext({ table: 'meal_logs', method: 'upsert', ...CHECK_VIOLATION })
    const status = await h.engine.flushNow()
    expect(h.db.rows('meal_logs').map((row) => row.id)).toEqual([testId(2)])
    expect(status).toMatchObject({ state: 'error', pending: 0, failed: 1 })
    expect(status.lastError).toMatch(/1 change couldn’t be saved/)
    const [failed] = await h.outbox.list()
    expect(failed).toMatchObject({ recordId: testId(1), status: 'failed', lastError: expect.stringContaining('23514') })
    expect(h.events).toEqual([{ type: 'synced', count: 1 }, { type: 'failed', count: 1 }])

    expect(await h.engine.retryFailed()).toBe(1)
    await h.engine.flushNow()
    expect(h.db.rows('meal_logs')).toHaveLength(2)
    expect(h.engine.getStatus()).toMatchObject({ state: 'idle', failed: 0 })
  })

  it('discards failed changes without sending them', async () => {
    const h = setup()
    await h.outbox.enqueue(upsertMeal(1))
    h.db.failNext({ table: 'meal_logs', method: 'upsert', ...CHECK_VIOLATION })
    await h.engine.flushNow()
    expect(await h.engine.discardFailed()).toBe(1)
    await vi.waitFor(() => expect(h.engine.getStatus()).toMatchObject({ state: 'idle', failed: 0, lastError: null }))
    expect(h.sends).toHaveLength(1)
  })

  it('keeps changes queued (not failed) when the session is rejected', async () => {
    const h = setup()
    await h.outbox.enqueue(upsertMeal(1))
    h.db.failNext({ result: { error: { code: 'PGRST301', message: 'JWT expired' }, status: 401 } })
    const status = await h.engine.flushNow()
    expect(status).toMatchObject({ state: 'error', pending: 1, failed: 0 })
    expect(status.lastError).toMatch(/sign in again/)
  })

  it('rejects an invalid queued payload without sending it', async () => {
    const h = setup()
    const queued = await h.outbox.enqueue(upsertMeal(1))
    const db = await openDatabase()
    await db.put('outbox', { ...queued, payload: { ...upsertMeal(1).payload, grams: 0 } })
    await h.engine.flushNow()
    expect(h.sends).toEqual([])
    expect(await h.outbox.list()).toEqual([expect.objectContaining({ status: 'failed', lastError: expect.stringMatching(/grams/) })])
  })

  it('reports a neutral waiting message for a head that is still backing off after a restart', async () => {
    const h = setup()
    const queued = await h.outbox.enqueue(upsertMeal(1))
    await h.outbox.scheduleRetry(queued.id, { error: 'Supabase meal_logs.save failed', nextAttemptAt: '2026-10-04T08:01:00.000Z' })
    h.timers.advance(0)
    await vi.waitFor(() => expect(h.engine.getStatus()).toMatchObject({ state: 'error', pending: 1, lastError: WAITING_MESSAGE }))
    expect(h.sends).toEqual([])
    expect(h.timers.scheduled()).toEqual([60_000])
  })

  it('retries with backoff when the queue cannot be read from this device', async () => {
    const h = setup({
      wrapOutbox: (outbox) => ({ ...outbox, list: vi.fn<Outbox['list']>(outbox.list).mockRejectedValueOnce(new Error('storage busy')) }),
    })
    await h.outbox.enqueue(upsertMeal(1))
    const status = await h.engine.flushNow()
    expect(status).toMatchObject({ state: 'error', pending: 1 })
    expect(status.lastError).toMatch(/Couldn’t read the changes saved on this device/)
    h.timers.advance(2_000)
    await vi.waitFor(() => expect(h.engine.getStatus()).toMatchObject({ state: 'idle', pending: 0 }))
    expect(h.sends).toEqual([`upsert:${testId(1)}`])
  })
})
