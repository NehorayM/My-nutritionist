import { beforeEach, describe, expect, it } from 'vitest'
import type { Repositories } from '@/repositories/types'
import {
  makeFavorite,
  makeFood,
  makeMeal,
  makeProfile,
  makeSavedMeal,
  makeScheduled,
  makeWeight,
  makeWorkout,
  USER_A,
} from '@/schemas/__fixtures__/records'
import { FakeSupabase } from './__fixtures__/fakeSupabase'
import { createSupabaseRepositories } from './index'

/** Save → read → update → remove through every Supabase repository (fake query builder). */
let fake: FakeSupabase
let repos: Repositories

beforeEach(() => {
  fake = new FakeSupabase()
  repos = createSupabaseRepositories(fake, USER_A)
})

const UPDATED = '2026-10-05T07:00:00.000Z'
const OCTOBER = { from: '2026-10-01', to: '2026-10-31' }

/** One repository under test: how to read everything back, save and remove. */
interface Case<T extends { id: string; updatedAt: string }> {
  table: string
  record: T
  change: Partial<T>
  read: () => Promise<T[]>
  save: (record: T) => Promise<T>
  remove: (id: string) => Promise<void>
}

/** Save → read → update (newer updatedAt) → remove → idempotent remove; resolves to the request methods sent. */
function crud<T extends { id: string; updatedAt: string }>(c: Case<T>): readonly [string, () => Promise<string[]>] {
  return [
    c.table,
    async () => {
      expect(await c.save(c.record)).toEqual(c.record)
      expect(await c.read()).toEqual([c.record])

      const updated: T = { ...c.record, ...c.change, updatedAt: UPDATED }
      expect(await c.save(updated)).toEqual(updated)
      expect(await c.read()).toEqual([updated])
      expect(fake.rows(c.table)).toHaveLength(1)

      await c.remove(c.record.id)
      expect(await c.read()).toEqual([])
      await c.remove(c.record.id)
      expect(fake.calls.filter((call) => call.method === 'upsert').map((call) => call.onConflict)).toEqual(['id', 'id'])
      return fake.calls.map((call) => call.method)
    },
  ]
}

const cases = [
  crud({
    table: 'food_items',
    record: makeFood(),
    change: { name: 'Apple cake' },
    read: () => repos.foods.list(),
    save: (r) => repos.foods.save(r),
    remove: (id) => repos.foods.remove(id),
  }),
  crud({
    table: 'meal_logs',
    record: makeMeal(),
    change: { grams: 300, quantity: 300, servingLabel: null, servingGrams: null },
    read: () => repos.meals.listRange(OCTOBER),
    save: (r) => repos.meals.save(r),
    remove: (id) => repos.meals.remove(id),
  }),
  crud({
    table: 'weight_logs',
    record: makeWeight(),
    change: { weightKg: 71.2, inputUnit: 'lb' },
    read: () => repos.weights.list(),
    save: (r) => repos.weights.save(r),
    remove: (id) => repos.weights.remove(id),
  }),
  crud({
    table: 'workout_logs',
    record: makeWorkout(),
    change: { durationMin: 50, notes: 'Hills' },
    read: () => repos.workouts.listRange(OCTOBER),
    save: (r) => repos.workouts.save(r),
    remove: (id) => repos.workouts.remove(id),
  }),
  crud({
    table: 'scheduled_workouts',
    record: makeScheduled(),
    change: { status: 'completed' },
    read: () => repos.scheduledWorkouts.listRange(OCTOBER),
    save: (r) => repos.scheduledWorkouts.save(r),
    remove: (id) => repos.scheduledWorkouts.remove(id),
  }),
  crud({
    table: 'favorites',
    record: makeFavorite(),
    change: {},
    read: () => repos.favorites.list(),
    save: (r) => repos.favorites.save(r),
    remove: (id) => repos.favorites.remove(id),
  }),
  crud({
    table: 'saved_meals',
    record: makeSavedMeal(),
    change: { name: 'Weekend plate', mealType: null },
    read: () => repos.savedMeals.list(),
    save: (r) => repos.savedMeals.save(r),
    remove: (id) => repos.savedMeals.remove(id),
  }),
]

describe('CRUD through every repository', () => {
  it.each(cases)('%s', async (_table, run) => {
    expect(await run()).toEqual(['upsert', 'select', 'upsert', 'select', 'delete', 'select', 'delete'])
  })

  it('profile: save, read back, update', async () => {
    expect(await repos.profile.save(makeProfile())).toEqual(makeProfile())
    const updated = makeProfile({ displayName: 'Dana', heightCm: null, updatedAt: UPDATED })
    expect(await repos.profile.save(updated)).toEqual(updated)
    expect(await repos.profile.get()).toEqual(updated)
    expect(fake.rows('profiles')).toHaveLength(1)
  })

  it('foods.getById reads a saved food', async () => {
    await repos.foods.save(makeFood())
    expect(await repos.foods.getById(makeFood().id)).toEqual(makeFood())
  })
})
