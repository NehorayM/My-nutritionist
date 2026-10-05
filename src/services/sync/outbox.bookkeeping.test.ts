import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDatabase, openDatabase } from '@/lib/idb'
import { makeMeal, testId, USER_A, USER_B } from '@/schemas/__fixtures__/records'
import { createOutbox, type Outbox } from './outbox'

const T0 = Date.parse('2026-10-04T08:00:00.000Z')

function makeOutbox(userId = USER_A, startId = 900): Outbox {
  let next = startId
  return createOutbox(userId, { clock: () => new Date(T0), newId: () => testId((next += 1)) })
}

const upsertMeal = (n: number, overrides = {}) => {
  const meal = makeMeal({ id: testId(n), ...overrides })
  return { entity: 'meal_logs' as const, op: 'upsert' as const, recordId: meal.id, payload: meal }
}

beforeEach(async () => {
  await deleteDatabase()
})

afterEach(async () => {
  await deleteDatabase()
})

describe('get', () => {
  it('returns the current version of a queued mutation and null once it is replaced, acknowledged or foreign', async () => {
    const outbox = makeOutbox()
    const first = await outbox.enqueue(upsertMeal(1))
    expect(await outbox.get(first.id)).toEqual(first)
    const second = await outbox.enqueue(upsertMeal(1, { mealType: 'snack' }))
    expect(await outbox.get(first.id)).toBeNull()
    expect(await outbox.get(second.id)).toMatchObject({ payload: { mealType: 'snack' } })
    expect(await makeOutbox(USER_B, 950).get(second.id)).toBeNull()
    await outbox.ack(second)
    expect(await outbox.get(second.id)).toBeNull()
  })
})

describe('bookkeeping', () => {
  it('records retry attempts, failures, acknowledgements and counts', async () => {
    const outbox = makeOutbox()
    const a = await outbox.enqueue(upsertMeal(1))
    const b = await outbox.enqueue(upsertMeal(2))
    const retry = await outbox.scheduleRetry(a.id, { error: 'offline', nextAttemptAt: '2026-10-04T08:00:02.000Z' })
    expect(retry).toMatchObject({ attempts: 1, lastError: 'offline', nextAttemptAt: '2026-10-04T08:00:02.000Z' })
    expect(await outbox.markFailed(b.id, 'rejected (23514)')).toMatchObject({ status: 'failed', attempts: 1 })
    expect(await outbox.scheduleRetry(b.id, { error: 'x', nextAttemptAt: '2026-10-04T08:00:02.000Z' })).toBeNull()
    expect(await outbox.counts()).toEqual({ pending: 1, failed: 1 })

    expect(await outbox.ack(a)).toBe(true)
    expect(await outbox.ack(a)).toBe(false)
    expect(await outbox.counts()).toEqual({ pending: 0, failed: 1 })
    expect(await outbox.markFailed(a.id, 'gone')).toBeNull()
  })

  it('ignores an acknowledgement for a version that was replaced while it was being sent', async () => {
    const outbox = makeOutbox()
    const sent = await outbox.enqueue(upsertMeal(1))
    const mark = outbox.ackMark()
    await outbox.enqueue(upsertMeal(1, { mealType: 'snack' }))
    expect(await outbox.ack(sent)).toBe(false)
    expect(await outbox.list()).toEqual([expect.objectContaining({ recordId: testId(1), payload: expect.objectContaining({ mealType: 'snack' }) })])
    expect(outbox.ackedSince(mark)).toEqual(new Set([`meal_logs:${testId(1)}`]))
  })

  it('retries or discards failed mutations, all of them or selected ids', async () => {
    const outbox = makeOutbox()
    const ids = []
    for (const n of [1, 2, 3]) {
      const queued = await outbox.enqueue(upsertMeal(n))
      await outbox.markFailed(queued.id, 'rejected')
      ids.push(queued.id)
    }
    await outbox.enqueue(upsertMeal(4))
    expect(await outbox.retryFailed([ids[0] ?? ''])).toBe(1)
    expect((await outbox.list())[0]).toMatchObject({ status: 'pending', attempts: 0, lastError: null })
    expect(await outbox.discardFailed([ids[1] ?? ''])).toBe(1)
    expect(await outbox.counts()).toEqual({ pending: 2, failed: 1 })
    expect(await outbox.discardFailed()).toBe(1)
    expect(await outbox.retryFailed()).toBe(0)
    expect((await outbox.list()).map((m) => m.recordId)).toEqual([testId(1), testId(4)])
    expect(await outbox.remove(ids[0] ?? '')).toBe(true)
    expect(await outbox.counts()).toEqual({ pending: 1, failed: 0 })
  })

  it('notifies subscribers with fresh counts after each change', async () => {
    const outbox = makeOutbox()
    const listener = vi.fn<(counts: { pending: number; failed: number }) => void>()
    const unsubscribe = outbox.subscribe(listener)
    const queued = await outbox.enqueue(upsertMeal(1))
    await vi.waitFor(() => expect(listener).toHaveBeenLastCalledWith({ pending: 1, failed: 0 }))
    await outbox.markFailed(queued.id, 'rejected')
    await vi.waitFor(() => expect(listener).toHaveBeenLastCalledWith({ pending: 0, failed: 1 }))
    unsubscribe()
    await outbox.discardFailed()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('skips stored mutations that are invalid instead of failing the whole listing', async () => {
    const outbox = makeOutbox()
    await outbox.enqueue(upsertMeal(1))
    const db = await openDatabase()
    await db.put('outbox', { ...(await outbox.list())[0]!, id: testId(990), recordId: testId(2), attempts: -1 })
    expect((await outbox.list()).map((m) => m.recordId)).toEqual([testId(1)])
  })
})
