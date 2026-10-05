import { afterAll, describe, expect, inject, it } from 'vitest'
import './support/context.ts'
import { createAdminClient, createUserClient } from './support/clients.ts'
import { createCleanup } from './support/cleanup.ts'
import { customFoodRow, favoriteRow, mealLogRow, rowId, weightLogRow, type Row } from './support/rows.ts'

/** Table constraints protect data quality for every writer, independent of the client code. */
const { env, userA } = inject('dbTest')
const clientA = createUserClient(env, userA)
const admin = createAdminClient(env)
const cleanup = createCleanup(admin)
const CHECK_VIOLATION = '23514'
const UNIQUE_VIOLATION = '23505'

afterAll(() => cleanup.run())

describe('check constraints', () => {
  it.each([
    ['zero grams', { grams: 0 }],
    ['negative grams', { grams: -50 }],
    ['zero quantity', { quantity: 0 }],
    ['empty food name', { food_name: '' }],
    ['unknown food source', { food_source: 'restaurant' }],
  ])('meal_logs rejects %s', async (_label, overrides) => {
    const { error } = await clientA.from('meal_logs').insert(mealLogRow(userA.id, overrides))
    expect(error?.code).toBe(CHECK_VIOLATION)
  })

  it.each([
    ['below 20 kg', 19.99],
    ['above 400 kg', 400.01],
  ])('weight_logs rejects a weight %s', async (_label, weightKg) => {
    const { error } = await clientA.from('weight_logs').insert(weightLogRow(userA.id, { weight_kg: weightKg }))
    expect(error?.code).toBe(CHECK_VIOLATION)
  })

  it.each([
    ['profiles.sex', 'profiles', { id: userA.id, sex: 'other' }],
    ['profiles.diet_type', 'profiles', { id: userA.id, diet_type: 'carnivore' }],
    ['profiles.allergies', 'profiles', { id: userA.id, allergies: ['milk', 'chocolate'] }],
    ['weight_logs.input_unit', 'weight_logs', weightLogRow(userA.id, { input_unit: 'stone' })],
    [
      'workout_logs.type',
      'workout_logs',
      { id: crypto.randomUUID(), user_id: userA.id, workout_date: '2026-10-04', type: 'yoga', duration_min: 30 },
    ],
    [
      'scheduled_workouts.status',
      'scheduled_workouts',
      { id: crypto.randomUUID(), user_id: userA.id, scheduled_date: '2026-10-05', type: 'walk', duration_min: 20, status: 'skipped' },
    ],
  ] as const)('rejects an invalid enum value in %s', async (_label, table, row) => {
    const { error } = await clientA.from(table).insert(row)
    expect(error?.code).toBe(CHECK_VIOLATION)
  })

  it.each([
    ['a negative nutrient', { calories: 100, protein: -1 }],
    ['a text value', { calories: 100, protein: 'lots' }],
    ['more than 1000 kcal per 100 g', { calories: 1500 }],
    ['an array instead of an object', [100, 2, 3]],
  ])('rejects a nutrient map with %s', async (_label, nutrients) => {
    const food = await clientA.from('food_items').insert(customFoodRow(userA.id, { nutrients_per_100g: nutrients }))
    expect(food.error?.code).toBe(CHECK_VIOLATION)
    const meal = await clientA.from('meal_logs').insert(mealLogRow(userA.id, { nutrients_per_100g: nutrients }))
    expect(meal.error?.code).toBe(CHECK_VIOLATION)
  })

  it('accepts unknown nutrients stored as null', async () => {
    const meal = mealLogRow(userA.id, { nutrients_per_100g: { calories: 80, protein: null, vitaminD: null } })
    expect((await clientA.from('meal_logs').insert(meal)).error).toBeNull()
    cleanup.track('meal_logs', rowId(meal))
  })
})

describe('unique constraints', () => {
  it('rejects favoriting the same food twice (different ids)', async () => {
    const first = favoriteRow(userA.id)
    expect((await clientA.from('favorites').insert(first)).error).toBeNull()
    cleanup.track('favorites', rowId(first))
    const duplicate = favoriteRow(userA.id, { food_id: first.food_id })
    const { error } = await clientA.from('favorites').insert(duplicate)
    expect(error?.code).toBe(UNIQUE_VIOLATION)
  })

  it('rejects two weigh-ins at the same instant, allows two on the same day', async () => {
    const first = weightLogRow(userA.id)
    expect((await clientA.from('weight_logs').insert(first)).error).toBeNull()
    cleanup.track('weight_logs', rowId(first))
    const sameInstant = weightLogRow(userA.id, { measured_at: first.measured_at, measured_on: first.measured_on })
    expect((await clientA.from('weight_logs').insert(sameInstant)).error?.code).toBe(UNIQUE_VIOLATION)
    const laterThatDay = weightLogRow(userA.id, {
      measured_at: new Date(Date.parse(String(first.measured_at)) + 60_000).toISOString(),
      measured_on: first.measured_on,
    })
    expect((await clientA.from('weight_logs').insert(laterThatDay)).error).toBeNull()
    cleanup.track('weight_logs', rowId(laterThatDay))
  })
})

describe('stale-write guard (PostgREST upsert, as used by the sync outbox)', () => {
  const T1 = '2026-10-01T10:00:00.000Z'
  const T0 = '2026-09-30T10:00:00.000Z'
  const T2 = '2026-10-02T10:00:00.000Z'

  async function stored(id: string): Promise<Row | null> {
    const { data } = await clientA.from('meal_logs').select('grams, updated_at, created_at').eq('id', id).single()
    return data
  }

  it('ignores an older write and applies a newer one', async () => {
    const meal = mealLogRow(userA.id, { grams: 200, updated_at: T1, created_at: T1 })
    expect((await clientA.from('meal_logs').upsert(meal, { onConflict: 'id' })).error).toBeNull()
    cleanup.track('meal_logs', rowId(meal))

    const older = await clientA.from('meal_logs').upsert({ ...meal, grams: 999, updated_at: T0 }, { onConflict: 'id' })
    expect(older.error).toBeNull()
    expect(await stored(rowId(meal))).toMatchObject({ grams: 200, updated_at: '2026-10-01T10:00:00+00:00' })

    const newer = await clientA.from('meal_logs').upsert({ ...meal, grams: 250, updated_at: T2 }, { onConflict: 'id' })
    expect(newer.error).toBeNull()
    expect(await stored(rowId(meal))).toMatchObject({ grams: 250, updated_at: '2026-10-02T10:00:00+00:00' })
  })

  it('keeps created_at immutable and clamps a far-future updated_at to the server clock', async () => {
    const meal = mealLogRow(userA.id, { created_at: T1, updated_at: T1 })
    expect((await clientA.from('meal_logs').insert(meal)).error).toBeNull()
    cleanup.track('meal_logs', rowId(meal))
    const farFuture = '2100-01-01T00:00:00.000Z'
    const write = await clientA
      .from('meal_logs')
      .upsert({ ...meal, grams: 120, created_at: T2, updated_at: farFuture }, { onConflict: 'id' })
    expect(write.error).toBeNull()
    const row = await stored(rowId(meal))
    expect(row).toMatchObject({ grams: 120, created_at: '2026-10-01T10:00:00+00:00' })
    const updatedAt = Date.parse(String(row?.updated_at))
    expect(updatedAt).toBeLessThan(Date.parse(farFuture))
    expect(Math.abs(updatedAt - Date.now())).toBeLessThan(5 * 60_000)
  })
})
