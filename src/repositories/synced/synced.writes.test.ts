import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { createLocalRepositories } from '@/repositories/local'
import { foodItemToRow } from '@/repositories/supabase/mappers'
import { RepositoryError } from '@/repositories/types'
import { makeFavorite, makeFood, makeMeal, makeWorkout, testId, USER_A, USER_B } from '@/schemas/__fixtures__/records'
import { createCloudHarness, type CloudHarness } from './__fixtures__/harness'

const meal = (n: number, overrides = {}) => makeMeal({ id: testId(n), ...overrides })

let h: CloudHarness

beforeEach(async () => {
  await deleteDatabase()
})

afterEach(async () => {
  h.engine.dispose()
  await deleteDatabase()
})

describe('synced writes', () => {
  it('saves offline to this device and syncs after reconnecting', async () => {
    h = createCloudHarness('offline')
    expect(await h.repos.meals.save(meal(1))).toEqual(meal(1))
    expect(await h.repos.meals.listByDate('2026-10-03')).toEqual([meal(1)])
    expect(h.server.calls).toEqual([])
    expect(await h.outbox.counts()).toEqual({ pending: 1, failed: 0 })

    h.connectivity.set('connected')
    h.timers.advance(0)
    await vi.waitFor(() => expect(h.engine.getStatus()).toMatchObject({ state: 'idle', pending: 0 }))
    expect(h.server.rows('meal_logs')).toEqual([expect.objectContaining({ id: testId(1), user_id: USER_A })])
    expect(await h.repos.meals.listByDate('2026-10-03')).toEqual([meal(1)])
  })

  it('requests a flush after each write without waiting for the network', async () => {
    h = createCloudHarness('connected')
    const food = makeFood({ id: testId(10) })
    await h.repos.foods.save(food)
    await h.repos.favorites.save(makeFavorite({ id: testId(11), foodId: food.id }))
    expect(h.server.calls).toEqual([])
    h.timers.advance(0)
    await vi.waitFor(() => expect(h.engine.getStatus().pending).toBe(0))
    expect(h.server.calls.map((call) => `${call.method}:${call.table}`)).toEqual(['upsert:food_items', 'upsert:favorites'])
  })

  it('removes locally at once and deletes on the server when synced', async () => {
    h = createCloudHarness('connected')
    h.server.seed('food_items', foodItemToRow(makeFood({ id: testId(10) })))
    await h.repos.foods.list()
    await h.repos.foods.remove(testId(10))
    expect(await createLocalRepositories(USER_A).foods.list()).toEqual([])
    await h.engine.flushNow()
    expect(h.server.rows('food_items')).toEqual([])
  })

  it('coalesces repeated edits of one record into a single server write', async () => {
    h = createCloudHarness('offline')
    await h.repos.workouts.save(makeWorkout({ durationMin: 20 }))
    await h.repos.workouts.save(makeWorkout({ durationMin: 30, updatedAt: '2026-10-03T09:00:00.000Z' }))
    await h.repos.workouts.save(makeWorkout({ durationMin: 45, updatedAt: '2026-10-03T10:00:00.000Z' }))
    h.connectivity.set('connected')
    await h.engine.flushNow()
    expect(h.server.calls.filter((call) => call.method === 'upsert')).toHaveLength(1)
    expect(h.server.rows('workout_logs')).toEqual([expect.objectContaining({ duration_min: 45 })])
  })

  it('rejects invalid and foreign records without touching the cache or the queue', async () => {
    h = createCloudHarness('connected')
    await expect(h.repos.meals.save(meal(1, { grams: -1 }))).rejects.toThrow(RepositoryError)
    await expect(h.repos.meals.save(meal(2, { userId: USER_B }))).rejects.toMatchObject({ retryable: false })
    await h.repos.meals.remove('not-a-uuid')
    expect(await h.outbox.counts()).toEqual({ pending: 0, failed: 0 })
    expect(await createLocalRepositories(USER_A).meals.listRecent(10)).toEqual([])
  })
})
