import type { z } from 'zod'
import type {
  DietFlags,
  Favorite,
  FoodItem,
  FoodPortion,
  MealEntry,
  NutrientProfile,
  OutboxMutation,
  Profile,
  ReminderPreferences,
  SavedMeal,
  ScheduledWorkout,
  ServingOption,
  WeightEntry,
  WorkoutEntry,
} from '@/types'
import type { DateRange } from '@/repositories/types'
import type { scheduledWorkoutSchema, weightEntrySchema, workoutEntrySchema } from './activity'
import type { dietFlagsSchema, foodItemSchema, servingOptionSchema } from './food'
import type { favoriteSchema, foodPortionSchema, mealEntrySchema, savedMealSchema } from './meal'
import type { nutrientProfileSchema } from './nutrition'
import type { dateRangeSchema } from './primitives'
import type { profileSchema, reminderPreferencesSchema } from './profile'
import type { outboxMutationSchema } from './sync'

/**
 * Compile-time contract checks (no runtime code). For every schema:
 * - its parsed OUTPUT is assignable to the domain interface (validated data can be used as-is), and
 * - the domain interface is assignable to its INPUT (every valid domain value can be validated).
 * If a domain interface in `src/types` changes, `tsc` fails here until the schema is updated.
 */
type Assert<T extends true> = T
type Accepts<Schema extends z.ZodType, Domain> = [Domain] extends [z.input<Schema>]
  ? [z.output<Schema>] extends [Domain]
    ? true
    : false
  : false

export type SchemaContractChecks = [
  Assert<Accepts<typeof nutrientProfileSchema, NutrientProfile>>,
  Assert<Accepts<typeof servingOptionSchema, ServingOption>>,
  Assert<Accepts<typeof dietFlagsSchema, DietFlags>>,
  Assert<Accepts<typeof foodItemSchema, FoodItem>>,
  Assert<Accepts<typeof foodPortionSchema, FoodPortion>>,
  Assert<Accepts<typeof mealEntrySchema, MealEntry>>,
  Assert<Accepts<typeof savedMealSchema, SavedMeal>>,
  Assert<Accepts<typeof favoriteSchema, Favorite>>,
  Assert<Accepts<typeof reminderPreferencesSchema, ReminderPreferences>>,
  Assert<Accepts<typeof profileSchema, Profile>>,
  Assert<Accepts<typeof weightEntrySchema, WeightEntry>>,
  Assert<Accepts<typeof workoutEntrySchema, WorkoutEntry>>,
  Assert<Accepts<typeof scheduledWorkoutSchema, ScheduledWorkout>>,
  Assert<Accepts<typeof outboxMutationSchema, OutboxMutation>>,
  Assert<Accepts<typeof dateRangeSchema, DateRange>>,
]
