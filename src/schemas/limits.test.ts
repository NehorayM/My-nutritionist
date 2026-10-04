import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/001_initial_schema.sql?raw'
import { BARCODE_PATTERN, COUNT_LIMITS, LIMITS, TEXT_LIMITS } from './limits'

/** Body of one `create table` statement, so same-named columns in other tables never match. */
function tableSql(table: string): string {
  const start = migration.indexOf(`create table public.${table} (`)
  expect(start, `table ${table} exists`).toBeGreaterThanOrEqual(0)
  return migration.slice(start, migration.indexOf('\n);', start))
}

function match(sql: string, pattern: RegExp): RegExpExecArray {
  const found = pattern.exec(sql)
  if (!found) throw new Error(`Constraint not found: ${pattern.source}`)
  return found
}

function rangeCheck(table: string, column: string): { min: number; max: number } {
  const found = match(tableSql(table), new RegExp(`check \\(${column} between ([\\d.]+) and ([\\d.]+)\\)`))
  return { min: Number(found[1]), max: Number(found[2]) }
}

function exclusiveRangeCheck(table: string, column: string): { exclusiveMin: number; max: number } {
  const found = match(tableSql(table), new RegExp(`check \\(${column} > ([\\d.]+) and ${column} <= ([\\d.]+)\\)`))
  return { exclusiveMin: Number(found[1]), max: Number(found[2]) }
}

function maxLength(table: string, column: string): number {
  const sql = tableSql(table)
  const upTo = new RegExp(`check \\(char_length\\(${column}\\) <= (\\d+)\\)`).exec(sql)
  if (upTo) return Number(upTo[1])
  return Number(match(sql, new RegExp(`check \\(char_length\\(${column}\\) between 1 and (\\d+)\\)`))[1])
}

function maxCardinality(table: string, column: string): number {
  return Number(match(tableSql(table), new RegExp(`cardinality\\(${column}\\) <= (\\d+)`))[1])
}

describe('LIMITS mirror the database CHECK constraints', () => {
  it.each([
    ['profiles', 'current_weight_kg', LIMITS.weightKg],
    ['profiles', 'target_weight_kg', LIMITS.weightKg],
    ['weight_logs', 'weight_kg', LIMITS.weightKg],
    ['profiles', 'height_cm', LIMITS.heightCm],
    ['profiles', 'max_prep_minutes', LIMITS.maxPrepMinutes],
    ['profiles', 'strength_sessions_per_week', LIMITS.sessionsPerWeek],
    ['profiles', 'cardio_sessions_per_week', LIMITS.sessionsPerWeek],
    ['profiles', 'preferred_workout_minutes', LIMITS.preferredWorkoutMinutes],
    ['workout_logs', 'duration_min', LIMITS.workoutDurationMin],
    ['scheduled_workouts', 'duration_min', LIMITS.workoutDurationMin],
    ['workout_logs', 'estimated_kcal', LIMITS.workoutKcal],
    ['food_items', 'prep_minutes', LIMITS.foodPrepMinutes],
    ['food_items', 'cost_tier', LIMITS.costTier],
  ] as const)('%s.%s', (table, column, limit) => {
    expect(rangeCheck(table, column)).toEqual({ min: limit.min, max: limit.max })
  })

  it('birth date range', () => {
    expect(tableSql('profiles')).toContain(
      `birth_date between date '${LIMITS.birthDate.min}' and date '${LIMITS.birthDate.max}'`,
    )
  })

  it('portion amounts: storage limits match the DB; the UI grams limit is stricter', () => {
    expect(exclusiveRangeCheck('meal_logs', 'grams')).toEqual({ exclusiveMin: 0, max: LIMITS.entryGrams.storageMax })
    expect(exclusiveRangeCheck('meal_logs', 'quantity')).toEqual(LIMITS.entryQuantity)
    expect(exclusiveRangeCheck('meal_logs', 'serving_grams')).toEqual(LIMITS.servingGrams)
    expect(LIMITS.entryGrams.max).toBe(5000)
    expect(LIMITS.entryGrams.max).toBeLessThan(LIMITS.entryGrams.storageMax)
  })

  it('nutrient map value and calorie caps', () => {
    expect(migration).toContain(`(entry.val)::numeric <= ${LIMITS.nutrientValue.max}`)
    expect(migration).toContain(`(entry.val)::numeric >= ${LIMITS.nutrientValue.min}`)
    expect(migration).toContain(`coalesce((value ->> 'calories')::numeric, 0) <= ${LIMITS.caloriesPer100g.max}`)
  })

  it.each([
    ['profiles', 'display_name', TEXT_LIMITS.displayName],
    ['food_items', 'name', TEXT_LIMITS.foodName],
    ['food_items', 'brand', TEXT_LIMITS.brand],
    ['meal_logs', 'brand', TEXT_LIMITS.brand],
    ['food_items', 'external_id', TEXT_LIMITS.externalId],
    ['meal_logs', 'food_external_id', TEXT_LIMITS.externalId],
    ['meal_logs', 'food_name', TEXT_LIMITS.foodName],
    ['meal_logs', 'serving_label', TEXT_LIMITS.servingLabel],
    ['food_items', 'attribution', TEXT_LIMITS.attribution],
    ['weight_logs', 'note', TEXT_LIMITS.weightNote],
    ['workout_logs', 'notes', TEXT_LIMITS.workoutNotes],
    ['scheduled_workouts', 'rationale', TEXT_LIMITS.scheduledRationale],
    ['saved_meals', 'name', TEXT_LIMITS.savedMealName],
  ] as const)('text length %s.%s', (table, column, limit) => {
    expect(maxLength(table, column)).toBe(limit)
  })

  it('list sizes', () => {
    expect(maxCardinality('profiles', 'dislikes')).toBe(COUNT_LIMITS.dislikes)
    expect(maxCardinality('food_items', 'tags')).toBe(COUNT_LIMITS.foodTags)
    expect(maxCardinality('food_items', 'meal_types')).toBe(COUNT_LIMITS.foodMealTypes)
    expect(tableSql('food_items')).toContain(`jsonb_array_length(servings) <= ${COUNT_LIMITS.servings}`)
    expect(tableSql('saved_meals')).toContain(
      `jsonb_array_length(items) between ${COUNT_LIMITS.savedMealItems.min} and ${COUNT_LIMITS.savedMealItems.max}`,
    )
  })

  it('barcode pattern', () => {
    expect(tableSql('food_items')).toContain(`barcode ~ '${BARCODE_PATTERN.source}'`)
  })
})
