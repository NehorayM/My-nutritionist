import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase, openDatabase, USER_STORES, userMetaKey } from '@/lib/idb'
import {
  makeFavorite,
  makeFood,
  makeMeal,
  makeOutbox,
  makeProfile,
  makeSavedMeal,
  makeScheduled,
  makeWeight,
  makeWorkout,
  testId,
  USER_A,
  USER_B,
} from '@/schemas/__fixtures__/records'
import { clearUserData, countUserRecords, createLocalRepositories, deleteMeta, listAllForUser, readMeta, writeMeta } from './index'

/** Stores one record of every kind for `userId` (ids offset per user so users never collide). */
async function seedUser(userId: string, offset: number): Promise<void> {
  const repos = createLocalRepositories(userId)
  const id = (n: number) => testId(offset + n)
  await repos.profile.save(makeProfile({ userId }))
  await repos.foods.save(makeFood({ id: id(1), createdBy: userId }))
  await repos.meals.save(makeMeal({ id: id(2), userId }))
  await repos.meals.save(makeMeal({ id: id(3), userId, date: '2026-10-04' }))
  await repos.weights.save(makeWeight({ id: id(4), userId }))
  await repos.workouts.save(makeWorkout({ id: id(5), userId }))
  await repos.scheduledWorkouts.save(makeScheduled({ id: id(6), userId }))
  await repos.favorites.save(makeFavorite({ id: id(7), userId, foodId: id(1) }))
  await repos.savedMeals.save(makeSavedMeal({ id: id(8), userId }))
  const db = await openDatabase()
  await db.put('outbox', makeOutbox({ id: id(9), userId, createdAt: '2026-10-03T09:00:00.000Z' }))
  await db.put('outbox', makeOutbox({ id: id(10), userId, createdAt: '2026-10-03T08:00:00.000Z' }))
  await writeMeta(userMetaKey(userId, 'lastPulledAt'), '2026-10-03T08:00:00.000Z')
}

const ONE_OF_EACH = {
  profiles: 1,
  foods: 1,
  meals: 2,
  weights: 1,
  workouts: 1,
  scheduledWorkouts: 1,
  favorites: 1,
  savedMeals: 1,
  outbox: 2,
}

beforeEach(async () => {
  await deleteDatabase()
})

afterEach(async () => {
  await deleteDatabase()
})

describe('countUserRecords', () => {
  it('counts every store per user, zero for an unknown user', async () => {
    await seedUser(USER_A, 0)
    await seedUser(USER_B, 100)
    expect(await countUserRecords(USER_A)).toEqual(ONE_OF_EACH)
    const none = await countUserRecords(testId(4242))
    expect(Object.keys(none).sort()).toEqual([...USER_STORES].sort())
    expect(Object.values(none).every((count) => count === 0)).toBe(true)
  })
})

describe('listAllForUser', () => {
  it('returns only that user’s valid records; the outbox in FIFO order', async () => {
    await seedUser(USER_A, 0)
    await seedUser(USER_B, 100)
    expect((await listAllForUser('meals', USER_A)).map((m) => m.id)).toEqual([testId(2), testId(3)])
    expect((await listAllForUser('profiles', USER_B)).map((p) => p.userId)).toEqual([USER_B])
    expect((await listAllForUser('foods', USER_B)).map((f) => f.id)).toEqual([testId(101)])
    expect((await listAllForUser('workouts', USER_A)).map((w) => w.id)).toEqual([testId(5)])
    expect((await listAllForUser('outbox', USER_A)).map((m) => m.id)).toEqual([testId(10), testId(9)])
    expect(await listAllForUser('profiles', testId(4242))).toEqual([])
  })

  it('skips invalid records', async () => {
    await seedUser(USER_A, 0)
    const db = await openDatabase()
    await db.put('outbox', makeOutbox({ id: testId(50), op: 'delete' }))
    expect(await listAllForUser('outbox', USER_A)).toHaveLength(2)
    expect((await countUserRecords(USER_A)).outbox).toBe(3)
  })
})

describe('clearUserData', () => {
  it('removes every record, outbox entry and user meta key of one user only', async () => {
    await seedUser(USER_A, 0)
    await seedUser(USER_B, 100)
    await writeMeta('deviceSetting', true)

    await clearUserData(USER_A)

    expect(Object.values(await countUserRecords(USER_A)).every((count) => count === 0)).toBe(true)
    expect(await readMeta(userMetaKey(USER_A, 'lastPulledAt'))).toBeUndefined()
    expect(await countUserRecords(USER_B)).toEqual(ONE_OF_EACH)
    expect(await readMeta(userMetaKey(USER_B, 'lastPulledAt'))).toBe('2026-10-03T08:00:00.000Z')
    expect(await readMeta('deviceSetting')).toBe(true)
    expect(await createLocalRepositories(USER_B).profile.get()).not.toBeNull()
  })

  it('is a no-op for a user without data', async () => {
    await seedUser(USER_B, 100)
    await clearUserData(USER_A)
    expect(await countUserRecords(USER_B)).toEqual(ONE_OF_EACH)
  })
})

describe('meta', () => {
  it('reads, overwrites and deletes values', async () => {
    expect(await readMeta('k')).toBeUndefined()
    await writeMeta('k', { cursor: 1 })
    await writeMeta('k', { cursor: 2 })
    expect(await readMeta('k')).toEqual({ cursor: 2 })
    await deleteMeta('k')
    expect(await readMeta('k')).toBeUndefined()
  })
})
