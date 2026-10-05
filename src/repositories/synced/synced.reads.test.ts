import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { createLocalRepositories } from '@/repositories/local'
import { foodItemToRow, mealEntryToRow, profileToRow, weightEntryToRow } from '@/repositories/supabase/mappers'
import { RepositoryError } from '@/repositories/types'
import { makeFood, makeMeal, makeProfile, makeWeight, testId, USER_A, USER_B } from '@/schemas/__fixtures__/records'
import { createCloudHarness, type CloudHarness } from './__fixtures__/harness'
import { readThrough } from './access'
import { userScope } from './cache'

const DAY = '2026-10-03'
const meal = (n: number, overrides = {}) => makeMeal({ id: testId(n), ...overrides })
const NETWORK_DOWN = new TypeError('Failed to fetch')

let h: CloudHarness

beforeEach(async () => {
  await deleteDatabase()
  h = createCloudHarness()
})

afterEach(async () => {
  h.engine.dispose()
  await deleteDatabase()
})

describe('synced reads', () => {
  it('returns server records and keeps a copy that is served while offline', async () => {
    h.server.seed('meal_logs', mealEntryToRow(meal(1)), mealEntryToRow(meal(2, { date: '2026-10-04' })))
    expect(await h.repos.meals.listByDate(DAY)).toEqual([meal(1)])
    h.connectivity.set('offline')
    h.server.seed('meal_logs', mealEntryToRow(meal(3)))
    const readsBefore = h.reads()
    expect(await h.repos.meals.listByDate(DAY)).toEqual([meal(1)])
    expect(h.reads()).toBe(readsBefore)
  })

  it('replaces cached records with the server version and drops records deleted elsewhere', async () => {
    h.server.seed('meal_logs', mealEntryToRow(meal(1)), mealEntryToRow(meal(2)))
    await h.repos.meals.listByDate(DAY)
    h.server.tables.set('meal_logs', [])
    h.server.seed('meal_logs', mealEntryToRow(meal(1, { mealType: 'dinner', updatedAt: '2026-10-03T20:00:00.000Z' })))
    expect(await h.repos.meals.listByDate(DAY)).toEqual([meal(1, { mealType: 'dinner', updatedAt: '2026-10-03T20:00:00.000Z' })])
    expect(await createLocalRepositories(USER_A).meals.listByDate(DAY)).toHaveLength(1)
  })

  it('keeps a queued local edit instead of the stale server copy', async () => {
    h.server.seed('meal_logs', mealEntryToRow(meal(1)))
    await h.repos.meals.save(meal(1, { mealType: 'lunch', updatedAt: '2026-10-03T12:00:00.000Z' }))
    expect(await h.repos.meals.listByDate(DAY)).toEqual([meal(1, { mealType: 'lunch', updatedAt: '2026-10-03T12:00:00.000Z' })])
    expect(h.server.rows('meal_logs')[0]).toMatchObject({ meal_type: 'breakfast' })
  })

  it('keeps a record hidden while its delete is queued', async () => {
    h.server.seed('meal_logs', mealEntryToRow(meal(1)), mealEntryToRow(meal(2)))
    await h.repos.meals.listByDate(DAY)
    await h.repos.meals.remove(testId(1))
    expect(await h.repos.meals.listByDate(DAY)).toEqual([meal(2)])
    expect(h.server.rows('meal_logs')).toHaveLength(2)
  })

  it('keeps a record acknowledged while the read was in flight (the read saw the old server state)', async () => {
    const outbox = h.outbox
    const queued = await outbox.enqueue({ entity: 'weight_logs', op: 'upsert', recordId: testId(5), payload: makeWeight({ id: testId(5) }) }, { mirrorToCache: true })
    const cache = createLocalRepositories(USER_A)
    const result = await readThrough(
      { userId: USER_A, outbox, engine: h.engine, connectivity: h.connectivity },
      {
        operation: 'weight_logs.list',
        entity: 'weight_logs',
        fetch: async () => {
          await outbox.ack(queued)
          return []
        },
        scope: userScope('weights', USER_A),
        local: () => cache.weights.list(),
      },
    )
    expect(result).toEqual([makeWeight({ id: testId(5) })])
  })

  it('serves the cache when the server is unreachable and re-checks the connection', async () => {
    h.server.seed('weight_logs', weightEntryToRow(makeWeight()))
    await h.repos.weights.list()
    h.server.failNext({ throws: NETWORK_DOWN })
    expect(await h.repos.weights.list()).toEqual([makeWeight()])
    expect(h.connectivity.verifications()).toBe(1)
  })

  it('serves the cache when the session needs renewal', async () => {
    h.server.failNext({ result: { error: { code: 'PGRST301', message: 'JWT expired' }, status: 401 } })
    expect(await h.repos.weights.list()).toEqual([])
  })

  it('throws non-retryable server errors', async () => {
    h.server.failNext({ result: { error: { code: '42501', message: 'permission denied' }, status: 403 } })
    const read = h.repos.favorites.list()
    await expect(read).rejects.toBeInstanceOf(RepositoryError)
    await expect(read).rejects.toMatchObject({ retryable: false })
  })

  it('waits for the first connection check before choosing server or cache', async () => {
    h.connectivity.set('checking')
    expect(await h.repos.savedMeals.list()).toEqual([])
    expect(h.connectivity.verifications()).toBe(1)
    expect(h.reads()).toBe(0)

    h.connectivity.verify = () => {
      h.connectivity.set('connected')
      return Promise.resolve('connected')
    }
    h.connectivity.set('checking')
    await h.repos.savedMeals.list()
    expect(h.reads()).toBe(1)
  })

  it('refreshes a single food and never touches another user’s cached food', async () => {
    const mine = makeFood({ id: testId(1) })
    h.server.seed('food_items', foodItemToRow(mine))
    expect(await h.repos.foods.getById(mine.id)).toEqual(mine)
    h.server.tables.set('food_items', [])
    expect(await h.repos.foods.getById(mine.id)).toBeNull()
    expect(await createLocalRepositories(USER_A).foods.list()).toEqual([])

    const theirs = makeFood({ id: testId(2), createdBy: USER_B })
    await createLocalRepositories(USER_B).foods.save(theirs)
    expect(await h.repos.foods.getById(theirs.id)).toBeNull()
    expect(await createLocalRepositories(USER_B).foods.getById(theirs.id)).toEqual(theirs)
  })

  it('removes a cached profile the account no longer has, unless it is queued', async () => {
    await createLocalRepositories(USER_A).profile.save(makeProfile())
    expect(await h.repos.profile.get()).toBeNull()
    await h.repos.profile.save(makeProfile({ displayName: 'Dana' }))
    expect(await h.repos.profile.get()).toMatchObject({ displayName: 'Dana' })
    h.server.seed('profiles', profileToRow(makeProfile({ displayName: 'Server' })))
    expect(await h.repos.profile.get()).toMatchObject({ displayName: 'Dana' })
  })

  it('refreshes only the window of recent meals the server returned', async () => {
    const at = (hour: number) => `2026-10-03T${String(hour).padStart(2, '0')}:00:00.000Z`
    const cache = createLocalRepositories(USER_A)
    await cache.meals.save(meal(1, { loggedAt: at(6) }))
    await cache.meals.save(meal(9, { loggedAt: at(11) }))
    h.server.seed('meal_logs', ...[2, 3].map((n) => mealEntryToRow(meal(n, { loggedAt: at(8 + n) }))), mealEntryToRow(meal(1, { loggedAt: at(6) })))
    const recent = await h.repos.meals.listRecent(2)
    expect(recent.map((entry) => entry.id)).toEqual([testId(3), testId(2)])
    expect((await cache.meals.listRange({ from: DAY, to: DAY })).map((entry) => entry.id)).toEqual([testId(1), testId(2), testId(3)])
  })
})
