import type { z } from 'zod'
import type {
  Favorite,
  FoodItem,
  MealEntry,
  Profile,
  SavedMeal,
  ScheduledWorkout,
  SyncEntity,
  WeightEntry,
  WorkoutEntry,
} from '@/types'
import { scheduledWorkoutSchema, weightEntrySchema, workoutEntrySchema } from './activity'
import { foodItemSchema } from './food'
import { favoriteSchema, mealEntrySchema, savedMealSchema } from './meal'
import { profileSchema } from './profile'

/** Domain record type stored for each synchronizable entity (table name → record). */
export interface EntityRecordMap {
  profiles: Profile
  food_items: FoodItem
  meal_logs: MealEntry
  weight_logs: WeightEntry
  workout_logs: WorkoutEntry
  scheduled_workouts: ScheduledWorkout
  favorites: Favorite
  saved_meals: SavedMeal
}

export type EntityRecord<E extends SyncEntity> = EntityRecordMap[E]

/**
 * Validation schema per entity. Used to validate records read from storage and outbox payloads
 * before they are flushed (`ENTITY_SCHEMAS[mutation.entity].safeParse(mutation.payload)`).
 * Parsing canonicalizes timestamps to UTC (`toISOString`) and fills unknown nutrients with `null`.
 */
export const ENTITY_SCHEMAS: { [E in SyncEntity]: z.ZodType<EntityRecordMap[E], unknown> } = {
  profiles: profileSchema,
  food_items: foodItemSchema,
  meal_logs: mealEntrySchema,
  weight_logs: weightEntrySchema,
  workout_logs: workoutEntrySchema,
  scheduled_workouts: scheduledWorkoutSchema,
  favorites: favoriteSchema,
  saved_meals: savedMealSchema,
}

/** Primary key of a record: profiles are keyed by their owner, everything else by `id`. */
export function recordIdOf<E extends SyncEntity>(entity: E, record: EntityRecordMap[E]): string {
  if ('id' in record) return record.id
  if (entity === 'profiles' && 'userId' in record) return record.userId
  throw new TypeError(`Record of ${entity} has no id`)
}

/** Owning user of a record; `null` only for system foods. */
export function ownerOf<E extends SyncEntity>(entity: E, record: EntityRecordMap[E]): string | null {
  if (entity === 'food_items' && 'createdBy' in record) return record.createdBy
  if ('userId' in record) return record.userId
  throw new TypeError(`Record of ${entity} has no owner field`)
}
