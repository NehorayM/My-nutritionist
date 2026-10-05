import { randomInt, randomUUID } from 'node:crypto'
import { nextSystemFoodId } from './systemFoods.ts'

/** Valid rows for every user-owned table, plus a harmless update for the CRUD/ownership tests. */
export type Row = Record<string, unknown>

export const USER_TABLES = [
  'profiles',
  'food_items',
  'meal_logs',
  'weight_logs',
  'workout_logs',
  'scheduled_workouts',
  'favorites',
  'saved_meals',
] as const
export type UserTable = (typeof USER_TABLES)[number]

export interface TableSpec {
  table: UserTable
  /** Column that holds the owner's auth.uid(). */
  ownerColumn: 'id' | 'user_id' | 'created_by'
  build: (ownerId: string) => Row
  patch: () => Row
}

export const NUTRIENTS = { calories: 120, protein: 7, carbs: 18, fat: 2, fiber: null, sodium: 310 }

/** A distinct weigh-in instant in 2026 (weight_logs is unique per user + instant). */
export function uniqueInstant(): string {
  return new Date(Date.UTC(2026, 0, 1) + randomInt(0, 280 * 24 * 3600) * 1000).toISOString()
}

export function customFoodRow(ownerId: string, overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    source: 'custom',
    name: 'Test lentil soup',
    nutrients_per_100g: NUTRIENTS,
    servings: [{ label: '1 bowl (300 g)', grams: 300 }],
    created_by: ownerId,
    ...overrides,
  }
}

export function mealLogRow(ownerId: string, overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    user_id: ownerId,
    log_date: '2026-10-04',
    meal_type: 'lunch',
    food_id: null,
    food_source: 'custom',
    food_name: 'Test lentil soup',
    quantity: 1,
    serving_label: '1 bowl',
    serving_grams: 300,
    grams: 300,
    nutrients_per_100g: NUTRIENTS,
    logged_at: '2026-10-04T12:30:00Z',
    ...overrides,
  }
}

export function weightLogRow(ownerId: string, overrides: Row = {}): Row {
  const measuredAt = uniqueInstant()
  return {
    id: randomUUID(),
    user_id: ownerId,
    measured_on: measuredAt.slice(0, 10),
    measured_at: measuredAt,
    weight_kg: 72.5,
    input_unit: 'kg',
    ...overrides,
  }
}

export function favoriteRow(ownerId: string, overrides: Row = {}): Row {
  return { id: randomUUID(), user_id: ownerId, food_id: nextSystemFoodId(), ...overrides }
}

export const TABLE_SPECS: readonly TableSpec[] = [
  {
    table: 'profiles',
    ownerColumn: 'id',
    build: (ownerId) => ({ id: ownerId, display_name: 'Test person', goal: 'maintain' }),
    patch: () => ({ display_name: 'Renamed person' }),
  },
  { table: 'food_items', ownerColumn: 'created_by', build: customFoodRow, patch: () => ({ name: 'Renamed soup' }) },
  { table: 'meal_logs', ownerColumn: 'user_id', build: mealLogRow, patch: () => ({ grams: 350 }) },
  { table: 'weight_logs', ownerColumn: 'user_id', build: weightLogRow, patch: () => ({ weight_kg: 71.8 }) },
  {
    table: 'workout_logs',
    ownerColumn: 'user_id',
    build: (ownerId) => ({
      id: randomUUID(),
      user_id: ownerId,
      workout_date: '2026-10-04',
      type: 'walk',
      duration_min: 30,
      intensity: 'moderate',
      estimated_kcal: 120,
      kcal_source: 'estimate',
    }),
    patch: () => ({ duration_min: 45 }),
  },
  {
    table: 'scheduled_workouts',
    ownerColumn: 'user_id',
    build: (ownerId) => ({
      id: randomUUID(),
      user_id: ownerId,
      scheduled_date: '2026-10-06',
      type: 'strength',
      duration_min: 40,
      status: 'planned',
      source: 'catch_up',
    }),
    patch: () => ({ status: 'completed' }),
  },
  { table: 'favorites', ownerColumn: 'user_id', build: favoriteRow, patch: () => ({ food_id: nextSystemFoodId() }) },
  {
    table: 'saved_meals',
    ownerColumn: 'user_id',
    build: (ownerId) => ({
      id: randomUUID(),
      user_id: ownerId,
      name: 'Test breakfast',
      meal_type: 'breakfast',
      items: [{ foodName: 'Oats', grams: 40 }],
    }),
    patch: () => ({ name: 'Renamed breakfast' }),
  },
]

export function rowId(row: Row): string {
  const id = row.id
  if (typeof id !== 'string') throw new Error('Row has no id')
  return id
}
