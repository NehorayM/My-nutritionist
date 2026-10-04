import type { EntityRecordMap } from '@/schemas'
import type { SyncEntity } from '@/types'
import {
  scheduledWorkoutFromRow,
  scheduledWorkoutToRow,
  weightEntryFromRow,
  weightEntryToRow,
  workoutEntryFromRow,
  workoutEntryToRow,
} from './rows/activity'
import { foodItemFromRow, foodItemToRow } from './rows/food'
import { favoriteFromRow, favoriteToRow, mealEntryFromRow, mealEntryToRow, savedMealFromRow, savedMealToRow } from './rows/meal'
import { profileFromRow, profileToRow } from './rows/profile'

/**
 * Domain ↔ database row mapping for every synchronizable table (exactly per
 * `supabase/migrations/001_initial_schema.sql`).
 * - `toRow` writes every column, including `created_at`/`updated_at` (the stale-write trigger compares them).
 * - `fromRow` accepts numeric columns as numbers or numeric strings, validates the result with the
 *   entity schema and returns `null` for rows that do not describe a valid record.
 */
export interface TableMapper<T> {
  table: SyncEntity
  /** Column that holds the owning user id (every query filters on it). */
  ownerColumn: 'id' | 'user_id' | 'created_by'
  /** Local calendar date column used by date-range queries; null when the table has none. */
  dateColumn: string | null
  toRow(record: T): object
  fromRow(row: unknown): T | null
}

export type TableMappers = { [E in SyncEntity]: TableMapper<EntityRecordMap[E]> }

export const TABLE_MAPPERS: TableMappers = {
  profiles: { table: 'profiles', ownerColumn: 'id', dateColumn: null, toRow: profileToRow, fromRow: profileFromRow },
  food_items: {
    table: 'food_items',
    ownerColumn: 'created_by',
    dateColumn: null,
    toRow: foodItemToRow,
    fromRow: foodItemFromRow,
  },
  meal_logs: {
    table: 'meal_logs',
    ownerColumn: 'user_id',
    dateColumn: 'log_date',
    toRow: mealEntryToRow,
    fromRow: mealEntryFromRow,
  },
  weight_logs: {
    table: 'weight_logs',
    ownerColumn: 'user_id',
    dateColumn: 'measured_on',
    toRow: weightEntryToRow,
    fromRow: weightEntryFromRow,
  },
  workout_logs: {
    table: 'workout_logs',
    ownerColumn: 'user_id',
    dateColumn: 'workout_date',
    toRow: workoutEntryToRow,
    fromRow: workoutEntryFromRow,
  },
  scheduled_workouts: {
    table: 'scheduled_workouts',
    ownerColumn: 'user_id',
    dateColumn: 'scheduled_date',
    toRow: scheduledWorkoutToRow,
    fromRow: scheduledWorkoutFromRow,
  },
  favorites: { table: 'favorites', ownerColumn: 'user_id', dateColumn: null, toRow: favoriteToRow, fromRow: favoriteFromRow },
  saved_meals: {
    table: 'saved_meals',
    ownerColumn: 'user_id',
    dateColumn: null,
    toRow: savedMealToRow,
    fromRow: savedMealFromRow,
  },
}

export { asRow, numeric } from './rows/shared'
export * from './rows/activity'
export * from './rows/food'
export * from './rows/meal'
export * from './rows/profile'
