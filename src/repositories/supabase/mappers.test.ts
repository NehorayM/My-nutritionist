import { describe, expect, it } from 'vitest'
import {
  makeFavorite,
  makeFood,
  makeMeal,
  makeNutrients,
  makePortion,
  makeProfile,
  makeSavedMeal,
  makeScheduled,
  makeWeight,
  makeWorkout,
  TS,
  USER_A,
} from '@/schemas/__fixtures__/records'
import { NUTRIENT_KEYS, SYNC_ENTITIES } from '@/types'
import migration from '../../../supabase/migrations/001_initial_schema.sql?raw'
import { profileToRow, savedMealToRow, TABLE_MAPPERS } from './mappers'

/** Column names of one table in the migration, in declaration order. */
function columnsOf(table: string): string[] {
  const start = migration.indexOf(`create table public.${table} (`)
  const body = migration.slice(migration.indexOf('\n', start) + 1, migration.indexOf('\n);', start))
  return body
    .split('\n')
    .map((line) => /^ {2}([a-z_0-9]+) /.exec(line)?.[1])
    .filter((name): name is string => name !== undefined && name !== 'constraint')
}

const RECORDS = {
  profiles: makeProfile(),
  food_items: makeFood(),
  meal_logs: makeMeal(),
  weight_logs: makeWeight(),
  workout_logs: makeWorkout(),
  scheduled_workouts: makeScheduled(),
  favorites: makeFavorite(),
  saved_meals: makeSavedMeal(),
}

describe('TABLE_MAPPERS', () => {
  it.each(SYNC_ENTITIES)('%s: rows have exactly the table’s columns and round-trip', (entity) => {
    const mapper = TABLE_MAPPERS[entity]
    const record = RECORDS[entity]
    const row = (mapper.toRow as (value: typeof record) => object)(record)
    expect(Object.keys(row).sort()).toEqual(columnsOf(entity).sort())
    expect(mapper.fromRow(row)).toEqual(record)
    expect(mapper.table).toBe(entity)
    expect(columnsOf(entity)).toContain(mapper.ownerColumn)
    expect([...columnsOf(entity), null]).toContain(mapper.dateColumn)
  })

  it.each(SYNC_ENTITIES)('%s: rejects rows that are not valid records', (entity) => {
    const mapper = TABLE_MAPPERS[entity]
    expect(mapper.fromRow(null)).toBeNull()
    expect(mapper.fromRow([])).toBeNull()
    expect(mapper.fromRow({ id: 'x' })).toBeNull()
  })
})

describe('column mapping', () => {
  it('profiles: id ↔ userId, numeric strings, Postgres timestamps', () => {
    const row = {
      ...profileToRow(makeProfile()),
      height_cm: '165.5',
      current_weight_kg: '62.40',
      target_weight_kg: null,
      max_prep_minutes: '30',
      week_starts_on: 0,
      updated_at: '2026-10-03T08:15:00.123456+00:00',
    }
    expect(row.id).toBe(USER_A)
    const profile = TABLE_MAPPERS.profiles.fromRow(row)
    expect(profile).toMatchObject({ userId: USER_A, heightCm: 165.5, currentWeightKg: 62.4, targetWeightKg: null, maxPrepMinutes: 30 })
    expect(profile?.updatedAt).toBe('2026-10-03T08:15:00.123Z')
  })

  it('food_items: per100g, diet flags, owner; null allergens stay null, [] stays []', () => {
    const food = makeFood({ allergens: null, dietFlags: { vegetarian: null, vegan: false } })
    const row = TABLE_MAPPERS.food_items.toRow(food)
    expect(row).toMatchObject({
      nutrients_per_100g: food.per100g,
      is_vegetarian: null,
      is_vegan: false,
      created_by: USER_A,
      allergens: null,
    })
    expect(TABLE_MAPPERS.food_items.fromRow(row)?.allergens).toBeNull()
    expect(TABLE_MAPPERS.food_items.fromRow({ ...row, allergens: [] })?.allergens).toEqual([])
    const fromStrings = TABLE_MAPPERS.food_items.fromRow({ ...row, cost_tier: '2', prep_minutes: '15', servings: [{ label: '1 slice', grams: '85.5' }] })
    expect(fromStrings).toMatchObject({ costTier: 2, prepMinutes: 15, servings: [{ label: '1 slice', grams: 85.5 }] })
  })

  it('food_items: unknown nutrients stay null and missing keys become null (never 0)', () => {
    const row = TABLE_MAPPERS.food_items.toRow(makeFood({ per100g: makeNutrients({ sodium: null, iron: null }) }))
    const partial = { calories: 120, protein: 3 }
    const food = TABLE_MAPPERS.food_items.fromRow({ ...row, nutrients_per_100g: partial })
    expect(food?.per100g.calories).toBe(120)
    for (const key of NUTRIENT_KEYS.filter((k) => k !== 'calories' && k !== 'protein')) expect(food?.per100g[key]).toBeNull()
    expect(TABLE_MAPPERS.food_items.fromRow(row)?.per100g.sodium).toBeNull()
  })

  it('meal_logs: log_date ↔ date, meal_type ↔ mealType, numeric strings for amounts', () => {
    const meal = makeMeal({ servingLabel: null, servingGrams: null, quantity: 150, grams: 150, foodId: null })
    const row = TABLE_MAPPERS.meal_logs.toRow(meal)
    expect(row).toMatchObject({ log_date: meal.date, meal_type: 'breakfast', nutrients_per_100g: meal.per100g, serving_grams: null })
    const parsed = TABLE_MAPPERS.meal_logs.fromRow({ ...row, quantity: '150.000', grams: '150.000', serving_grams: null })
    expect(parsed).toEqual(meal)
    expect(TABLE_MAPPERS.meal_logs.fromRow({ ...row, grams: 'NaN' })).toBeNull()
    expect(TABLE_MAPPERS.meal_logs.fromRow({ ...row, grams: '0' })).toBeNull()
  })

  it('weight_logs, workout_logs, scheduled_workouts: date columns and numerics', () => {
    const weightRow = TABLE_MAPPERS.weight_logs.toRow(makeWeight())
    expect(weightRow).toMatchObject({ measured_on: '2026-10-03', measured_at: '2026-10-03T05:30:00.000Z' })
    expect(TABLE_MAPPERS.weight_logs.fromRow({ ...weightRow, weight_kg: '72.35' })?.weightKg).toBe(72.35)

    const workoutRow = TABLE_MAPPERS.workout_logs.toRow(makeWorkout({ intensity: null, estimatedKcal: null, kcalSource: null }))
    expect(workoutRow).toMatchObject({ workout_date: '2026-10-03', intensity: null, estimated_kcal: null })
    expect(TABLE_MAPPERS.workout_logs.fromRow({ ...workoutRow, duration_min: '35' })?.durationMin).toBe(35)

    const scheduledRow = TABLE_MAPPERS.scheduled_workouts.toRow(makeScheduled())
    expect(scheduledRow).toMatchObject({ scheduled_date: '2026-10-05', completed_workout_id: null, source: 'catch_up' })
  })

  it('saved_meals: items are validated; null meal type preserved; numeric strings inside items', () => {
    const meal = makeSavedMeal({ mealType: null })
    const row = savedMealToRow(meal)
    expect(row.meal_type).toBeNull()
    const items = row.items.map((item) => ({ ...item, grams: String(item.grams), quantity: String(item.quantity) }))
    expect(TABLE_MAPPERS.saved_meals.fromRow({ ...row, items })).toEqual(meal)
    expect(TABLE_MAPPERS.saved_meals.fromRow({ ...row, items: [] })).toBeNull()
    expect(TABLE_MAPPERS.saved_meals.fromRow({ ...row, items: [{ ...makePortion(), foodName: '' }] })).toBeNull()
    expect(TABLE_MAPPERS.saved_meals.fromRow({ ...row, items: 'not a list' })).toBeNull()
  })

  it('favorites: food_id ↔ foodId', () => {
    expect(TABLE_MAPPERS.favorites.toRow(makeFavorite())).toEqual({
      id: makeFavorite().id,
      user_id: USER_A,
      food_id: makeFavorite().foodId,
      created_at: TS,
      updated_at: TS,
    })
  })
})
