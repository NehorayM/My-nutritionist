import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/lib/logger'
import { RepositoryError, type Repositories } from '@/repositories/types'
import {
  makeFood,
  makeMeal,
  makeProfile,
  makeScheduled,
  makeWeight,
  makeWorkout,
  testId,
  TS,
  USER_A,
  USER_B,
} from '@/schemas/__fixtures__/records'
import { FakeSupabase } from './__fixtures__/fakeSupabase'
import { createSupabaseRepositories } from './index'
import { foodItemToRow, mealEntryToRow, profileToRow, weightEntryToRow, workoutEntryToRow, scheduledWorkoutToRow } from './mappers'

let fake: FakeSupabase
let repos: Repositories

beforeEach(() => {
  fake = new FakeSupabase()
  repos = createSupabaseRepositories(fake, USER_A)
})

const LATER = '2026-10-04T09:00:00.000Z'

describe('owner scoping', () => {
  it('binds the user id and filters every read by the owner column', async () => {
    expect(repos.userId).toBe(USER_A)
    fake.seed('weight_logs', weightEntryToRow(makeWeight()), weightEntryToRow(makeWeight({ id: testId(2), userId: USER_B })))
    expect((await repos.weights.list()).map((w) => w.id)).toEqual([makeWeight().id])
    expect(fake.calls[0]).toMatchObject({
      table: 'weight_logs',
      method: 'select',
      columns: '*',
      filters: [{ op: 'eq', column: 'user_id', value: USER_A }],
    })
    expect(fake.calls[0]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('drops rows of other users even if the server returned them', async () => {
    fake.ignoreFilters = true
    fake.seed('meal_logs', mealEntryToRow(makeMeal()), mealEntryToRow(makeMeal({ id: testId(9), userId: USER_B })))
    expect((await repos.meals.listByDate('2026-10-03')).map((m) => m.userId)).toEqual([USER_A])
  })

  it('foods.list returns only the user’s own foods (never system foods)', async () => {
    fake.seed(
      'food_items',
      foodItemToRow(makeFood()),
      foodItemToRow(makeFood({ id: testId(101), source: 'system', createdBy: null })),
      foodItemToRow(makeFood({ id: testId(102), createdBy: USER_B })),
    )
    expect((await repos.foods.list()).map((f) => f.id)).toEqual([makeFood().id])
    expect(fake.calls[0]?.filters).toEqual([{ op: 'eq', column: 'created_by', value: USER_A }])
  })

  it('getById filters by id and owner; non-UUID ids return null without a request', async () => {
    fake.seed('food_items', foodItemToRow(makeFood()))
    expect(await repos.foods.getById(makeFood().id)).toEqual(makeFood())
    expect(fake.calls[0]?.filters).toEqual([
      { op: 'eq', column: 'id', value: makeFood().id },
      { op: 'eq', column: 'created_by', value: USER_A },
    ])
    expect(await repos.foods.getById('apple')).toBeNull()
    expect(fake.calls).toHaveLength(1)
  })

  it('profile.get reads the row whose id is the user id', async () => {
    expect(await repos.profile.get()).toBeNull()
    fake.seed('profiles', profileToRow(makeProfile()), profileToRow(makeProfile({ userId: USER_B })))
    expect(await repos.profile.get()).toEqual(makeProfile())
    expect(fake.calls[1]?.filters).toEqual([{ op: 'eq', column: 'id', value: USER_A }])
  })

  it('remove deletes by id AND owner; other ids are a no-op without a request', async () => {
    fake.seed('workout_logs', workoutEntryToRow(makeWorkout()))
    await repos.workouts.remove(makeWorkout().id)
    expect(fake.calls[0]).toMatchObject({
      method: 'delete',
      filters: [
        { op: 'eq', column: 'id', value: makeWorkout().id },
        { op: 'eq', column: 'user_id', value: USER_A },
      ],
    })
    expect(fake.rows('workout_logs')).toEqual([])
    await repos.workouts.remove('not-a-uuid')
    expect(fake.calls).toHaveLength(1)
  })
})

describe('save', () => {
  it('upserts the mapped row on conflict id and returns the server row', async () => {
    const saved = await repos.meals.save(makeMeal())
    expect(saved).toEqual(makeMeal())
    expect(fake.calls[0]).toMatchObject({
      table: 'meal_logs',
      method: 'upsert',
      onConflict: 'id',
      columns: '*',
      values: mealEntryToRow(makeMeal()),
    })
  })

  it('returns server-owned values (created_at is immutable on the server)', async () => {
    fake.seed('weight_logs', weightEntryToRow(makeWeight()))
    const saved = await repos.weights.save(makeWeight({ weightKg: 70.1, createdAt: LATER, updatedAt: LATER }))
    expect(saved).toMatchObject({ weightKg: 70.1, createdAt: TS, updatedAt: LATER })
  })

  it('returns the CURRENT server record when the stale-write guard skipped an older update', async () => {
    const newer = makeWorkout({ durationMin: 50, updatedAt: LATER })
    fake.seed('workout_logs', workoutEntryToRow(newer))
    const result = await repos.workouts.save(makeWorkout({ durationMin: 20 }))
    expect(result).toEqual(newer)
    expect(fake.calls.map((c) => c.method)).toEqual(['upsert', 'select'])
    expect(fake.calls[1]?.filters).toEqual([
      { op: 'eq', column: 'id', value: newer.id },
      { op: 'eq', column: 'user_id', value: USER_A },
    ])
  })

  it('fails as a non-retryable conflict when the skipped record cannot be read back', async () => {
    fake.seed('scheduled_workouts', scheduledWorkoutToRow(makeScheduled({ userId: USER_B, updatedAt: LATER })))
    const failure = repos.scheduledWorkouts.save(makeScheduled())
    await expect(failure).rejects.toMatchObject({ name: 'SupabaseRepositoryError', kind: 'conflict', retryable: false })
  })

  it('rejects invalid and foreign records before any request', async () => {
    await expect(repos.weights.save(makeWeight({ weightKg: 500 }))).rejects.toMatchObject({ retryable: false })
    await expect(repos.weights.save(makeWeight({ userId: USER_B }))).rejects.toBeInstanceOf(RepositoryError)
    await expect(repos.foods.save(makeFood({ source: 'system', createdBy: null }))).rejects.toThrow(/different user/)
    await expect(repos.profile.save(makeProfile({ userId: USER_B }))).rejects.toThrow(/different user/)
    expect(fake.calls).toEqual([])
  })

  it('falls back to the validated input when the echoed row is unreadable', async () => {
    const warn = vi.spyOn(logger, 'warn')
    vi.spyOn(fake, 'execute').mockReturnValueOnce({ data: [{ id: makeWeight().id, weight_kg: 'garbage' }], error: null, status: 201 })
    expect(await repos.weights.save(makeWeight())).toEqual(makeWeight())
    expect(warn).toHaveBeenCalledWith('supabase-db', 'Skipped 1 invalid weigh-in row(s) from weight_logs')
  })
})
