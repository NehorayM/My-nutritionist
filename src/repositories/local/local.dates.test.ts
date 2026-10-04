import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase, openDatabase } from '@/lib/idb'
import type { Repositories } from '@/repositories/types'
import { makeMeal, makeScheduled, makeWorkout, testId, USER_A, USER_B } from '@/schemas/__fixtures__/records'
import { createLocalRepositories } from './index'

/** Date-keyed queries of the IndexedDB repositories (fresh database per test). */
let repos: Repositories
let other: Repositories

beforeEach(async () => {
  await deleteDatabase()
  repos = createLocalRepositories(USER_A)
  other = createLocalRepositories(USER_B)
})

afterEach(async () => {
  await deleteDatabase()
})

describe('date ranges', () => {
  const dates = ['2026-09-30', '2026-10-01', '2026-10-03', '2026-10-07', '2026-10-08']

  it('meals: inclusive boundaries, ordered by date then loggedAt', async () => {
    for (const [i, date] of dates.entries()) {
      await repos.meals.save(makeMeal({ id: testId(i + 1), date, loggedAt: `${date}T0${9 - i}:00:00.000Z` }))
    }
    await repos.meals.save(makeMeal({ id: testId(50), date: '2026-10-03', loggedAt: '2026-10-03T01:00:00.000Z' }))
    await other.meals.save(makeMeal({ id: testId(60), userId: USER_B, date: '2026-10-03' }))

    const week = await repos.meals.listRange({ from: '2026-10-01', to: '2026-10-07' })
    expect(week.map((m) => [m.date, m.id])).toEqual([
      ['2026-10-01', testId(2)],
      ['2026-10-03', testId(50)],
      ['2026-10-03', testId(3)],
      ['2026-10-07', testId(4)],
    ])
    expect((await repos.meals.listByDate('2026-10-03')).map((m) => m.id)).toEqual([testId(50), testId(3)])
    expect(await repos.meals.listByDate('2026-10-02')).toEqual([])
    expect(await repos.meals.listRange({ from: '2026-10-07', to: '2026-10-01' })).toEqual([])
    await expect(repos.meals.listRange({ from: '2026-10-01', to: '2026-10-32' })).rejects.toMatchObject({ retryable: false })
  })

  it('workouts and scheduled workouts: inclusive boundaries and user isolation', async () => {
    for (const [i, date] of dates.entries()) {
      await repos.workouts.save(makeWorkout({ id: testId(i + 1), date }))
      await repos.scheduledWorkouts.save(makeScheduled({ id: testId(i + 1), date }))
    }
    await other.workouts.save(makeWorkout({ id: testId(70), userId: USER_B, date: '2026-10-03' }))
    const range = { from: '2026-10-01', to: '2026-10-07' }
    expect((await repos.workouts.listRange(range)).map((w) => w.date)).toEqual(dates.slice(1, 4))
    expect((await repos.scheduledWorkouts.listRange(range)).map((w) => w.date)).toEqual(dates.slice(1, 4))
    expect((await other.workouts.listRange(range)).map((w) => w.id)).toEqual([testId(70)])
    expect(await repos.workouts.listRange({ from: '2026-10-09', to: '2026-10-08' })).toEqual([])
  })
})

describe('remove for dated records', () => {
  it('meals, workouts and scheduled workouts are removed only for their owner', async () => {
    await repos.meals.save(makeMeal())
    await repos.workouts.save(makeWorkout())
    await repos.scheduledWorkouts.save(makeScheduled())
    const range = { from: '2026-10-01', to: '2026-10-31' }
    await other.meals.remove(makeMeal().id)
    await other.workouts.remove(makeWorkout().id)
    await other.scheduledWorkouts.remove(makeScheduled().id)
    expect(await repos.meals.listRange(range)).toHaveLength(1)
    expect(await repos.workouts.listRange(range)).toHaveLength(1)
    expect(await repos.scheduledWorkouts.listRange(range)).toHaveLength(1)

    await repos.meals.remove(makeMeal().id)
    await repos.workouts.remove(makeWorkout().id)
    await repos.scheduledWorkouts.remove(makeScheduled().id)
    expect(await repos.meals.listRange(range)).toEqual([])
    expect(await repos.workouts.listRange(range)).toEqual([])
    expect(await repos.scheduledWorkouts.listRange(range)).toEqual([])
  })

  it('orders meals logged at the same instant by id', async () => {
    await repos.meals.save(makeMeal({ id: testId(9) }))
    await repos.meals.save(makeMeal({ id: testId(3) }))
    await repos.meals.save(makeMeal({ id: testId(5) }))
    expect((await repos.meals.listByDate('2026-10-03')).map((m) => m.id)).toEqual([testId(3), testId(5), testId(9)])
  })
})

describe('meals.listRecent', () => {
  it('returns newest loggedAt first across dates, limited, ties by id', async () => {
    await repos.meals.save(makeMeal({ id: testId(1), date: '2026-10-01', loggedAt: '2026-10-01T07:00:00.000Z' }))
    await repos.meals.save(makeMeal({ id: testId(2), date: '2026-10-02', loggedAt: '2026-10-03T12:00:00+03:00' }))
    await repos.meals.save(makeMeal({ id: testId(3), date: '2026-10-03', loggedAt: '2026-10-03T10:00:00.000Z' }))
    await repos.meals.save(makeMeal({ id: testId(4), date: '2026-10-03', loggedAt: '2026-10-03T10:00:00.000Z' }))
    await other.meals.save(makeMeal({ id: testId(5), userId: USER_B, loggedAt: '2026-12-01T00:00:00.000Z' }))

    expect((await repos.meals.listRecent(10)).map((m) => m.id)).toEqual([testId(4), testId(3), testId(2), testId(1)])
    expect((await repos.meals.listRecent(2)).map((m) => m.id)).toEqual([testId(4), testId(3)])
    expect((await repos.meals.listRecent(2.9)).map((m) => m.id)).toEqual([testId(4), testId(3)])
    expect(await repos.meals.listRecent(0)).toEqual([])
    expect(await repos.meals.listRecent(-3)).toEqual([])
    expect(await repos.meals.listRecent(Number.NaN)).toEqual([])
  })

  it('skips invalid records but still fills the limit', async () => {
    await repos.meals.save(makeMeal({ id: testId(1), loggedAt: '2026-10-03T07:00:00.000Z' }))
    await repos.meals.save(makeMeal({ id: testId(2), loggedAt: '2026-10-03T08:00:00.000Z' }))
    const db = await openDatabase()
    await db.put('meals', { ...makeMeal({ id: testId(3), loggedAt: '2026-10-03T09:00:00.000Z' }), grams: -1 })
    expect((await repos.meals.listRecent(2)).map((m) => m.id)).toEqual([testId(2), testId(1)])
  })
})
