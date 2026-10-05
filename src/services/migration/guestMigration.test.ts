import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDatabase, openDatabase } from '@/lib/idb'
import { favoriteId, userFoodId } from '@/lib/id'
import { createLocalRepositories } from '@/repositories/local'
import { createCloudHarness } from '@/repositories/synced/__fixtures__/harness'
import { RepositoryError, type Repositories } from '@/repositories/types'
import {
  makeFavorite,
  makeFood,
  makeMeal,
  makePortion,
  makeProfile,
  makeSavedMeal,
  makeScheduled,
  makeWeight,
  makeWorkout,
  testId,
  USER_A,
} from '@/schemas/__fixtures__/records'
import { countGuestData, migrateGuestData } from './guestMigration'

const GUEST = '3e9f0a1b-2c3d-4e5f-8a6b-7c8d9e0f1a2b'
const NOW = '2026-10-04T10:00:00.000Z'
const SYSTEM_FOOD = testId(77)
const CUSTOM = testId(1)
const USDA = testId(2)
const REMOVED = testId(3)
const isSystemFood = (id: string) => id === SYSTEM_FOOD

/** A guest who logged with a custom food, a saved USDA food, a system food and a since-removed food. */
async function seedGuest(): Promise<void> {
  const guest = createLocalRepositories(GUEST)
  await guest.profile.save(makeProfile({ userId: GUEST, displayName: 'Guest' }))
  await guest.foods.save(makeFood({ id: CUSTOM, createdBy: GUEST }))
  await guest.foods.save(makeFood({ id: USDA, createdBy: GUEST, source: 'usda', externalId: '171477', name: 'Banana, raw' }))
  const portionOf = (foodId: string, source: 'custom' | 'usda' | 'system') => makePortion({ foodId, foodSource: source })
  await guest.meals.save(makeMeal({ id: testId(10), userId: GUEST, ...portionOf(CUSTOM, 'custom') }))
  await guest.meals.save(makeMeal({ id: testId(11), userId: GUEST, ...portionOf(USDA, 'usda') }))
  await guest.meals.save(makeMeal({ id: testId(12), userId: GUEST, ...portionOf(SYSTEM_FOOD, 'system') }))
  await guest.meals.save(makeMeal({ id: testId(13), userId: GUEST, ...portionOf(REMOVED, 'custom') }))
  await guest.favorites.save(makeFavorite({ id: testId(20), userId: GUEST, foodId: USDA }))
  await guest.favorites.save(makeFavorite({ id: testId(21), userId: GUEST, foodId: REMOVED }))
  await guest.savedMeals.save(makeSavedMeal({ id: testId(30), userId: GUEST, items: [portionOf(USDA, 'usda')] }))
  await guest.weights.save(makeWeight({ id: testId(40), userId: GUEST }))
  await guest.workouts.save(makeWorkout({ id: testId(50), userId: GUEST, scheduledWorkoutId: testId(60) }))
  await guest.scheduledWorkouts.save(makeScheduled({ id: testId(60), userId: GUEST, completedWorkoutId: testId(50) }))
}

beforeEach(async () => {
  await deleteDatabase()
})

afterEach(async () => {
  await deleteDatabase()
})

describe('countGuestData', () => {
  it('counts each kind of guest record and the total', async () => {
    expect(await countGuestData(GUEST)).toMatchObject({ total: 0 })
    await seedGuest()
    expect(await countGuestData(GUEST)).toEqual({
      counts: { profile: 1, foods: 2, meals: 4, favorites: 2, savedMeals: 1, weights: 1, workouts: 1, scheduledWorkouts: 1 },
      total: 13,
    })
  })
})

describe('migrateGuestData', () => {
  it('re-keys every record to the account, remaps provider food ids and clears the guest data', async () => {
    await seedGuest()
    const account = createLocalRepositories(USER_A)
    const result = await migrateGuestData({ guestId: GUEST, userId: USER_A, target: account, nowIso: NOW, isSystemFood })
    expect(result).toEqual({
      ok: true,
      migrated: { profile: 1, foods: 2, meals: 4, favorites: 1, savedMeals: 1, weights: 1, workouts: 1, scheduledWorkouts: 1 },
      skipped: { profile: 0, foods: 0, meals: 0, favorites: 1, savedMeals: 0, weights: 0, workouts: 0, scheduledWorkouts: 0 },
    })

    const usdaId = await userFoodId(USER_A, 'usda', '171477')
    const foods = await account.foods.list()
    expect(foods.map((food) => [food.id, food.createdBy, food.updatedAt]).sort()).toEqual(
      [[CUSTOM, USER_A, NOW], [usdaId, USER_A, NOW]].sort(),
    )
    const meals = await account.meals.listByDate('2026-10-03')
    expect(meals.map((meal) => [meal.id, meal.userId, meal.foodId])).toEqual([
      [testId(10), USER_A, CUSTOM],
      [testId(11), USER_A, usdaId],
      [testId(12), USER_A, SYSTEM_FOOD],
      [testId(13), USER_A, null],
    ])
    expect(meals.every((meal) => meal.updatedAt === NOW && meal.createdAt === makeMeal().createdAt)).toBe(true)
    expect(await account.favorites.list()).toEqual([
      expect.objectContaining({ id: await favoriteId(USER_A, usdaId), userId: USER_A, foodId: usdaId }),
    ])
    expect((await account.savedMeals.list())[0]?.items.map((item) => item.foodId)).toEqual([usdaId])
    const [workout] = await account.workouts.listRange({ from: '2026-10-01', to: '2026-10-07' })
    expect(workout).toMatchObject({ userId: USER_A, scheduledWorkoutId: testId(60) })
    expect(await account.profile.get()).toMatchObject({ userId: USER_A, displayName: 'Guest', updatedAt: NOW })
    expect(await countGuestData(GUEST)).toMatchObject({ total: 0 })
  })

  it('keeps the account profile and reports the guest profile as skipped', async () => {
    await seedGuest()
    const account = createLocalRepositories(USER_A)
    await account.profile.save(makeProfile({ displayName: 'Account' }))
    const result = await migrateGuestData({ guestId: GUEST, userId: USER_A, target: account, nowIso: NOW, isSystemFood })
    expect(result).toMatchObject({ ok: true, migrated: { profile: 0 }, skipped: { profile: 1 } })
    expect(await account.profile.get()).toMatchObject({ displayName: 'Account' })
  })

  it('deletes nothing when a save fails part-way, and a retry completes with every reference intact', async () => {
    await seedGuest()
    const account = createLocalRepositories(USER_A)
    const failing: Repositories = {
      ...account,
      meals: {
        ...account.meals,
        save: vi.fn<Repositories['meals']['save']>().mockRejectedValue(new RepositoryError('busy', { retryable: true })),
      },
    }
    const result = await migrateGuestData({ guestId: GUEST, userId: USER_A, target: failing, nowIso: NOW, isSystemFood })
    expect(result).toMatchObject({ ok: false, migrated: { profile: 1, foods: 2, meals: 0 }, error: { retryable: true } })
    expect(result.ok ? '' : result.error.message).toMatch(/Nothing was deleted/)
    // The custom food keeps its id, so it moved to the account; every other guest record is untouched.
    expect((await countGuestData(GUEST)).counts).toEqual({
      profile: 1, foods: 1, meals: 4, favorites: 2, savedMeals: 1, weights: 1, workouts: 1, scheduledWorkouts: 1,
    })
    expect((await account.foods.list()).map((food) => food.id)).toContain(CUSTOM)

    const retried = await migrateGuestData({ guestId: GUEST, userId: USER_A, target: account, nowIso: NOW, isSystemFood })
    expect(retried).toMatchObject({ ok: true, migrated: { foods: 1, meals: 4 }, skipped: { profile: 1 } })
    expect(await account.foods.list()).toHaveLength(2)
    const meals = await account.meals.listByDate('2026-10-03')
    expect(meals.find((meal) => meal.id === testId(10))?.foodId).toBe(CUSTOM)
    expect(await countGuestData(GUEST)).toMatchObject({ total: 0 })
  })

  it('keeps every guest record when the account profile cannot be checked', async () => {
    await seedGuest()
    const account = createLocalRepositories(USER_A)
    const unreachable = () => Promise.reject(new RepositoryError('server unreachable', { retryable: true }))
    const result = await migrateGuestData({
      guestId: GUEST, userId: USER_A, target: account, nowIso: NOW, isSystemFood, accountHasProfile: unreachable,
    })
    expect(result).toMatchObject({ ok: false, error: { retryable: true }, migrated: { profile: 0, foods: 0 } })
    expect(await countGuestData(GUEST)).toMatchObject({ total: 13 })
    expect(await account.foods.list()).toEqual([])
  })

  it('reports unreadable guest records as skipped and clears them with the rest', async () => {
    await seedGuest()
    const db = await openDatabase()
    await db.put('weights', { ...makeWeight({ id: testId(41), userId: GUEST }), weightKg: -1 })
    const result = await migrateGuestData({ guestId: GUEST, userId: USER_A, target: createLocalRepositories(USER_A), nowIso: NOW, isSystemFood })
    expect(result).toMatchObject({ ok: true, migrated: { weights: 1 }, skipped: { weights: 1 } })
    expect(await countGuestData(GUEST)).toMatchObject({ total: 0 })
  })

  it('refuses to import into repositories of another user', async () => {
    await seedGuest()
    const result = await migrateGuestData({ guestId: GUEST, userId: USER_A, target: createLocalRepositories(GUEST), nowIso: NOW })
    expect(result).toMatchObject({ ok: false, error: { retryable: false } })
    expect(await countGuestData(GUEST)).toMatchObject({ total: 13 })
  })

  it('queues the import for sync with foods ahead of the records that reference them', async () => {
    await seedGuest()
    const cloud = createCloudHarness('offline')
    const result = await migrateGuestData({ guestId: GUEST, userId: USER_A, target: cloud.repos, nowIso: NOW, isSystemFood })
    expect(result.ok).toBe(true)
    const queue = await cloud.outbox.list()
    expect(queue.map((mutation) => mutation.entity)).toEqual([
      'profiles',
      'food_items',
      'food_items',
      'meal_logs',
      'meal_logs',
      'meal_logs',
      'meal_logs',
      'favorites',
      'saved_meals',
      'weight_logs',
      'workout_logs',
      'scheduled_workouts',
    ])
    cloud.connectivity.set('connected')
    await cloud.engine.flushNow()
    expect(cloud.server.rows('food_items')).toHaveLength(2)
    expect(await cloud.outbox.counts()).toEqual({ pending: 0, failed: 0 })
    cloud.engine.dispose()
  })
})
