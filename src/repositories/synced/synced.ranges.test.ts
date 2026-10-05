import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { createLocalRepositories } from '@/repositories/local'
import { favoriteToRow, mealEntryToRow, savedMealToRow } from '@/repositories/supabase/rows/meal'
import { scheduledWorkoutToRow, workoutEntryToRow } from '@/repositories/supabase/rows/activity'
import { RepositoryError } from '@/repositories/types'
import { makeFavorite, makeMeal, makeSavedMeal, makeScheduled, makeWorkout, testId, USER_A } from '@/schemas/__fixtures__/records'
import { createCloudHarness, type CloudHarness } from './__fixtures__/harness'

const WEEK = { from: '2026-10-01', to: '2026-10-07' }
const ids = (records: readonly { id: string }[]) => records.map((record) => record.id)

let h: CloudHarness

beforeEach(async () => {
  await deleteDatabase()
  h = createCloudHarness()
})

afterEach(async () => {
  h.engine.dispose()
  await deleteDatabase()
})

describe('synced range reads', () => {
  it('refresh only the requested window: records deleted elsewhere go, records outside the window stay', async () => {
    const cache = createLocalRepositories(USER_A)
    const workout = (n: number, date: string) => makeWorkout({ id: testId(n), date })
    await cache.workouts.save(workout(2, '2026-10-02'))
    await cache.workouts.save(workout(10, '2026-10-10'))
    h.server.seed('workout_logs', ...[workout(1, '2026-10-01'), workout(3, '2026-10-03'), workout(9, '2026-10-09')].map(workoutEntryToRow))

    expect(ids(await h.repos.workouts.listRange(WEEK))).toEqual([testId(1), testId(3)])
    expect(ids(await cache.workouts.listRange({ from: '2026-09-01', to: '2026-10-31' }))).toEqual([testId(1), testId(3), testId(10)])
  })

  it('reads meals and scheduled sessions of a range through the cache', async () => {
    h.server.seed('meal_logs', mealEntryToRow(makeMeal({ id: testId(1), date: '2026-10-02' })), mealEntryToRow(makeMeal({ id: testId(2), date: '2026-10-08' })))
    h.server.seed('scheduled_workouts', scheduledWorkoutToRow(makeScheduled({ id: testId(3), date: '2026-10-05' })))
    expect(ids(await h.repos.meals.listRange(WEEK))).toEqual([testId(1)])
    expect(ids(await h.repos.scheduledWorkouts.listRange(WEEK))).toEqual([testId(3)])

    h.connectivity.set('offline')
    expect(ids(await h.repos.meals.listRange({ from: '2026-10-01', to: '2026-10-31' }))).toEqual([testId(1)])
    expect(ids(await h.repos.scheduledWorkouts.listRange(WEEK))).toEqual([testId(3)])
  })

  it('answers an empty range without a request and rejects malformed dates', async () => {
    expect(await h.repos.workouts.listRange({ from: '2026-10-07', to: '2026-10-01' })).toEqual([])
    expect(h.reads()).toBe(0)
    const malformed = h.repos.meals.listRange({ from: '2026-10-01', to: '2026-13-01' })
    await expect(malformed).rejects.toBeInstanceOf(RepositoryError)
    await expect(malformed).rejects.toMatchObject({ retryable: false })
    h.connectivity.set('offline')
    await expect(h.repos.scheduledWorkouts.listRange({ from: 'yesterday', to: '2026-10-01' })).rejects.toBeInstanceOf(RepositoryError)
  })

  it('refreshes favorites and saved meals lists from the server', async () => {
    await createLocalRepositories(USER_A).favorites.save(makeFavorite({ id: testId(40) }))
    h.server.seed('favorites', favoriteToRow(makeFavorite({ id: testId(41), foodId: testId(100) })))
    h.server.seed('saved_meals', savedMealToRow(makeSavedMeal({ id: testId(50) })))
    expect(ids(await h.repos.favorites.list())).toEqual([testId(41)])
    expect(ids(await h.repos.savedMeals.list())).toEqual([testId(50)])
  })
})
