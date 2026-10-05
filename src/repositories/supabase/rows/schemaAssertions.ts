import type { Database } from '@/lib/database.types'
import type { FoodItemRow } from './food'
import type { FavoriteRow, MealLogRow, SavedMealRow } from './meal'
import type { ProfileRow } from './profile'
import type { ScheduledWorkoutRow, WeightLogRow, WorkoutLogRow } from './activity'

/**
 * Compile-time guard (checked by `tsc`, no runtime code): every hand-written row type has exactly the columns of
 * its table in `src/lib/database.types.ts`, which `npm run db:types` generates from the migrations. A column added,
 * removed or renamed in a migration fails the typecheck until the mappers follow.
 */
type Tables = Database['public']['Tables']
type Columns<T extends keyof Tables> = keyof Tables[T]['Row']
type SameKeys<A, B> = [Exclude<A, B>, Exclude<B, A>] extends [never, never] ? true : { missingOrExtra: Exclude<A, B> | Exclude<B, A> }
type Assert<T extends true> = T

export type RowColumnsMatchSchema = [
  Assert<SameKeys<keyof ProfileRow, Columns<'profiles'>>>,
  Assert<SameKeys<keyof FoodItemRow, Columns<'food_items'>>>,
  Assert<SameKeys<keyof MealLogRow, Columns<'meal_logs'>>>,
  Assert<SameKeys<keyof SavedMealRow, Columns<'saved_meals'>>>,
  Assert<SameKeys<keyof FavoriteRow, Columns<'favorites'>>>,
  Assert<SameKeys<keyof WeightLogRow, Columns<'weight_logs'>>>,
  Assert<SameKeys<keyof WorkoutLogRow, Columns<'workout_logs'>>>,
  Assert<SameKeys<keyof ScheduledWorkoutRow, Columns<'scheduled_workouts'>>>,
]
