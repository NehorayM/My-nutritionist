import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { createLocalRepositories } from '@/repositories/local'
import { RepositoryError } from '@/repositories/types'
import { makeFood, makeMeal, makeWeight, testId, USER_A, USER_B } from '@/schemas/__fixtures__/records'
import { createOutbox, type Outbox } from './outbox'

const T0 = Date.parse('2026-10-04T08:00:00.000Z')

/** Outbox with a frozen clock (FIFO must not depend on the clock moving) and readable mutation ids. */
function makeOutbox(userId = USER_A, startId = 900): Outbox {
  let next = startId
  return createOutbox(userId, { clock: () => new Date(T0), newId: () => testId((next += 1)) })
}

const upsertMeal = (n: number, overrides = {}) => {
  const meal = makeMeal({ id: testId(n), ...overrides })
  return { entity: 'meal_logs' as const, op: 'upsert' as const, recordId: meal.id, payload: meal }
}
const deleteMeal = (n: number) => ({ entity: 'meal_logs' as const, op: 'delete' as const, recordId: testId(n), payload: null })

beforeEach(async () => {
  await deleteDatabase()
})

afterEach(async () => {
  await deleteDatabase()
})

describe('enqueue and FIFO listing', () => {
  it('lists mutations oldest first even when they are queued within the same millisecond', async () => {
    const outbox = makeOutbox()
    for (const n of [5, 3, 9, 1]) await outbox.enqueue(upsertMeal(n))
    const queue = await outbox.list()
    expect(queue.map((m) => m.recordId)).toEqual([5, 3, 9, 1].map(testId))
    expect(queue.map((m) => m.createdAt)).toEqual([
      '2026-10-04T08:00:00.000Z',
      '2026-10-04T08:00:00.001Z',
      '2026-10-04T08:00:00.002Z',
      '2026-10-04T08:00:00.003Z',
    ])
    expect(queue.every((m) => m.status === 'pending' && m.attempts === 0 && m.nextAttemptAt === null)).toBe(true)
  })

  it('keeps queues of different users apart', async () => {
    await makeOutbox(USER_A).enqueue(upsertMeal(1))
    const other = makeOutbox(USER_B, 950)
    await other.enqueue(upsertMeal(2, { userId: USER_B }))
    expect((await other.list()).map((m) => m.recordId)).toEqual([testId(2)])
    expect(await other.counts()).toEqual({ pending: 1, failed: 0 })
  })

  it('rejects invalid records, foreign records and mismatched ids without queueing anything', async () => {
    const outbox = makeOutbox()
    const invalid = outbox.enqueue({ ...upsertMeal(1), payload: { ...makeMeal({ id: testId(1) }), grams: -5 } })
    await expect(invalid).rejects.toThrow(/Invalid meal entry: check grams/)
    await expect(outbox.enqueue(upsertMeal(1, { userId: USER_B }))).rejects.toThrow(/different user/)
    const mismatch = outbox.enqueue({ ...upsertMeal(1), recordId: testId(2) })
    await expect(mismatch).rejects.toBeInstanceOf(RepositoryError)
    await expect(outbox.enqueue({ ...deleteMeal(1), recordId: 'not-a-uuid' })).rejects.toThrow(/recordId/)
    expect(await outbox.list()).toEqual([])
  })
})

describe('coalescing', () => {
  it('replaces a pending upsert in place with the newer payload and a new mutation id', async () => {
    const outbox = makeOutbox()
    const first = await outbox.enqueue(upsertMeal(1, { grams: 100, quantity: 100, servingGrams: null, servingLabel: null }))
    await outbox.enqueue(upsertMeal(2))
    const replaced = await outbox.enqueue(upsertMeal(1, { grams: 150, quantity: 150, servingGrams: null, servingLabel: null }))
    const queue = await outbox.list()
    expect(queue.map((m) => m.recordId)).toEqual([testId(1), testId(2)])
    expect(queue[0]).toMatchObject({ id: replaced.id, createdAt: first.createdAt, op: 'upsert', payload: { grams: 150 } })
    expect(replaced.id).not.toBe(first.id)
  })

  it('turns a pending upsert into a delete in place, and a pending delete back into an upsert', async () => {
    const outbox = makeOutbox()
    await outbox.enqueue(upsertMeal(1))
    await outbox.enqueue(upsertMeal(2))
    await outbox.enqueue(deleteMeal(1))
    expect((await outbox.list()).map((m) => [m.recordId, m.op, m.payload])).toEqual([
      [testId(1), 'delete', null],
      [testId(2), 'upsert', makeMeal({ id: testId(2) })],
    ])
    await outbox.enqueue(upsertMeal(1, { mealType: 'lunch' }))
    const [first] = await outbox.list()
    expect(first).toMatchObject({ recordId: testId(1), op: 'upsert', payload: { mealType: 'lunch' } })
    expect(await outbox.counts()).toEqual({ pending: 2, failed: 0 })
  })

  it('reopens a failed mutation as pending with fresh bookkeeping when the record changes again', async () => {
    const outbox = makeOutbox()
    const queued = await outbox.enqueue(upsertMeal(1))
    await outbox.markFailed(queued.id, 'rejected')
    const changed = await outbox.enqueue(upsertMeal(1, { mealType: 'dinner' }))
    expect(changed).toMatchObject({ status: 'pending', attempts: 0, lastError: null, nextAttemptAt: null })
    expect(await outbox.counts()).toEqual({ pending: 1, failed: 0 })
  })

  it('coalesces with mutations queued by an earlier session (index rebuilt from IndexedDB)', async () => {
    await makeOutbox(USER_A, 900).enqueue(upsertMeal(1))
    const later = makeOutbox(USER_A, 950)
    await later.enqueue(deleteMeal(1))
    expect((await later.list()).map((m) => [m.recordId, m.op])).toEqual([[testId(1), 'delete']])
  })
})

describe('local cache mirroring', () => {
  it('writes upserts to the cache and removes only the owner’s cached record on delete', async () => {
    const outbox = makeOutbox()
    const cache = createLocalRepositories(USER_A)
    await outbox.enqueue(upsertMeal(1), { mirrorToCache: true })
    expect(await cache.meals.listByDate('2026-10-03')).toEqual([makeMeal({ id: testId(1) })])
    await outbox.enqueue(deleteMeal(1), { mirrorToCache: true })
    expect(await cache.meals.listByDate('2026-10-03')).toEqual([])

    await createLocalRepositories(USER_B).weights.save(makeWeight({ id: testId(7), userId: USER_B }))
    await outbox.enqueue({ entity: 'weight_logs', op: 'delete', recordId: testId(7), payload: null }, { mirrorToCache: true })
    expect(await createLocalRepositories(USER_B).weights.list()).toHaveLength(1)
  })

  it('leaves both the cache and the queue untouched when the change is rejected', async () => {
    const outbox = makeOutbox()
    const food = makeFood({ id: testId(3), name: '' })
    const save = outbox.enqueue({ entity: 'food_items', op: 'upsert', recordId: food.id, payload: food }, { mirrorToCache: true })
    await expect(save).rejects.toThrow(/Invalid food/)
    expect(await createLocalRepositories(USER_A).foods.list()).toEqual([])
    expect(await outbox.list()).toEqual([])
  })
})
