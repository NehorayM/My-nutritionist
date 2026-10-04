import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/lib/logger'
import type { Repositories } from '@/repositories/types'
import { makeMeal, makeScheduled, makeWeight, makeWorkout, testId, TS, USER_A } from '@/schemas/__fixtures__/records'
import { FakeSupabase } from './__fixtures__/fakeSupabase'
import { createSupabaseRepositories } from './index'
import { mealEntryToRow, scheduledWorkoutToRow, weightEntryToRow, workoutEntryToRow } from './mappers'

/** Supabase repository reads (filters, ordering, paging, row validation) and error mapping, against the fake builder. */
let fake: FakeSupabase
let repos: Repositories

beforeEach(() => {
  fake = new FakeSupabase()
  repos = createSupabaseRepositories(fake, USER_A)
})

const LATER = '2026-10-04T09:00:00.000Z'

describe('reads', () => {
  const dates = ['2026-09-30', '2026-10-01', '2026-10-03', '2026-10-07', '2026-10-08']

  it('meals.listRange: inclusive date filters and chronological order', async () => {
    for (const [i, date] of dates.entries()) {
      fake.seed('meal_logs', mealEntryToRow(makeMeal({ id: testId(i + 1), date, loggedAt: `${date}T0${9 - i}:00:00.000Z` })))
    }
    fake.seed('meal_logs', mealEntryToRow(makeMeal({ id: testId(50), date: '2026-10-03', loggedAt: '2026-10-03T01:00:00.000Z' })))
    const week = await repos.meals.listRange({ from: '2026-10-01', to: '2026-10-07' })
    expect(week.map((m) => m.id)).toEqual([testId(2), testId(50), testId(3), testId(4)])
    expect(fake.calls[0]).toMatchObject({
      filters: [
        { op: 'eq', column: 'user_id', value: USER_A },
        { op: 'gte', column: 'log_date', value: '2026-10-01' },
        { op: 'lte', column: 'log_date', value: '2026-10-07' },
      ],
      order: [
        { column: 'log_date', ascending: true },
        { column: 'logged_at', ascending: true },
        { column: 'id', ascending: true },
      ],
      range: [0, 999],
    })
    expect((await repos.meals.listByDate('2026-10-03')).map((m) => m.id)).toEqual([testId(50), testId(3)])
  })

  it('empty ranges cost no request; unreal dates are rejected', async () => {
    expect(await repos.workouts.listRange({ from: '2026-10-08', to: '2026-10-01' })).toEqual([])
    await expect(repos.scheduledWorkouts.listRange({ from: '2026-02-30', to: '2026-03-02' })).rejects.toMatchObject({
      retryable: false,
    })
    expect(fake.calls).toEqual([])
  })

  it('workouts and scheduled workouts filter on their own date columns', async () => {
    for (const [i, date] of dates.entries()) {
      fake.seed('workout_logs', workoutEntryToRow(makeWorkout({ id: testId(i + 1), date })))
      fake.seed('scheduled_workouts', scheduledWorkoutToRow(makeScheduled({ id: testId(i + 1), date })))
    }
    const range = { from: '2026-10-01', to: '2026-10-07' }
    expect((await repos.workouts.listRange(range)).map((w) => w.date)).toEqual(dates.slice(1, 4))
    expect((await repos.scheduledWorkouts.listRange(range)).map((w) => w.date)).toEqual(dates.slice(1, 4))
    expect(fake.calls.map((c) => c.filters[1]?.column)).toEqual(['workout_date', 'scheduled_date'])
  })

  it('listRecent: newest logged_at first, ties by higher id, limited', async () => {
    fake.seed(
      'meal_logs',
      mealEntryToRow(makeMeal({ id: testId(1), loggedAt: '2026-10-01T07:00:00.000Z' })),
      mealEntryToRow(makeMeal({ id: testId(3), loggedAt: '2026-10-03T10:00:00.000Z' })),
      mealEntryToRow(makeMeal({ id: testId(4), loggedAt: '2026-10-03T10:00:00.000Z' })),
      mealEntryToRow(makeMeal({ id: testId(2), loggedAt: '2026-10-02T09:00:00.000Z' })),
    )
    expect((await repos.meals.listRecent(3)).map((m) => m.id)).toEqual([testId(4), testId(3), testId(2)])
    expect(fake.calls[0]).toMatchObject({
      order: [
        { column: 'logged_at', ascending: false },
        { column: 'id', ascending: false },
      ],
      range: [0, 2],
    })
    expect(await repos.meals.listRecent(0)).toEqual([])
    expect(await repos.meals.listRecent(Number.NaN)).toEqual([])
    expect(fake.calls).toHaveLength(1)
  })

  it('reads every page and fills limits past invalid rows', async () => {
    const paged = createSupabaseRepositories(fake, USER_A, { pageSize: 2 })
    for (let i = 1; i <= 5; i += 1) fake.seed('weight_logs', weightEntryToRow(makeWeight({ id: testId(i) })))
    expect((await paged.weights.list()).map((w) => w.id)).toEqual([1, 2, 3, 4, 5].map(testId))
    expect(fake.calls.map((c) => c.range)).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ])

    fake.calls.length = 0
    fake.seed('meal_logs', { ...mealEntryToRow(makeMeal({ id: testId(9), loggedAt: LATER })), grams: -1 })
    for (let i = 1; i <= 3; i += 1) {
      fake.seed('meal_logs', mealEntryToRow(makeMeal({ id: testId(i), loggedAt: `2026-10-0${i}T08:00:00.000Z` })))
    }
    vi.spyOn(logger, 'warn')
    expect((await paged.meals.listRecent(2)).map((m) => m.id)).toEqual([testId(3), testId(2)])
    expect(fake.calls.map((c) => c.range)).toEqual([
      [0, 1],
      [2, 2],
    ])
  })

  it('converts numeric strings and skips invalid rows with a warning that has no contents', async () => {
    const warn = vi.spyOn(logger, 'warn')
    fake.seed(
      'weight_logs',
      { ...weightEntryToRow(makeWeight()), weight_kg: '72.35' },
      { ...weightEntryToRow(makeWeight({ id: testId(2) })), weight_kg: '7.5', note: 'private note' },
    )
    expect(await repos.weights.list()).toEqual([makeWeight()])
    expect(warn).toHaveBeenCalledWith('supabase-db', 'Skipped 1 invalid weigh-in row(s) from weight_logs')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private')
  })
})

describe('error mapping', () => {
  it.each([
    ['RLS denial (42501)', { result: { error: { code: '42501', message: 'new row violates row-level security policy' }, status: 403 } }, 'permission', false],
    ['check violation', { result: { error: { code: '23514', message: 'violates check constraint' }, status: 400 } }, 'invalid', false],
    ['server error', { result: { error: { code: 'XX000', message: 'internal' }, status: 500 } }, 'server', true],
    ['rate limit', { result: { error: { message: 'Too Many Requests' }, status: 429 } }, 'rate_limited', true],
    ['network failure', { result: { error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 } }, 'network', true],
    ['timeout', { result: { error: { message: 'TimeoutError: signal timed out', code: '' }, status: 0 } }, 'timeout', true],
    ['thrown fetch error', { throws: new TypeError('Failed to fetch') }, 'network', true],
  ] as const)('%s on save → %s (retryable: %s)', async (_name, failure, kind, retryable) => {
    fake.failNext({ ...failure, method: 'upsert' })
    const save = repos.favorites.save({ id: testId(1), userId: USER_A, foodId: testId(2), createdAt: TS, updatedAt: TS })
    await expect(save).rejects.toMatchObject({ name: 'SupabaseRepositoryError', kind, retryable })
  })

  it('maps read and delete failures with the operation in the message', async () => {
    fake.failNext({ method: 'select', result: { error: { message: 'Bad Gateway' }, status: 502 } })
    await expect(repos.savedMeals.list()).rejects.toThrow('Supabase saved_meals.list failed: the server had a temporary problem (HTTP 502)')
    fake.failNext({ method: 'delete', result: { error: { code: '42501', message: 'permission denied for table favorites' }, status: 401 } })
    await expect(repos.favorites.remove(testId(1))).rejects.toThrow('Supabase favorites.remove failed: permission denied (42501)')
  })
})
