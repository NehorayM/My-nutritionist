/**
 * Validation limits shared by the Zod schemas and the UI forms.
 *
 * Every value mirrors a CHECK constraint in `supabase/migrations/001_initial_schema.sql`
 * (verified by `limits.test.ts`, which parses the migration). The only intentional difference:
 * `entryGrams.max` is the friendlier UI limit for one logged portion (5 kg); the stored-record
 * schemas accept up to `entryGrams.storageMax` (the DB check) so entries created elsewhere still load.
 * Ranges are inclusive unless a field says `exclusiveMin`.
 */
export const LIMITS = {
  /** profiles.current/target_weight_kg and weight_logs.weight_kg (kg). */
  weightKg: { min: 20, max: 400 },
  /** profiles.height_cm (cm). */
  heightCm: { min: 50, max: 272 },
  /** profiles.birth_date (YYYY-MM-DD, inclusive). */
  birthDate: { min: '1900-01-01', max: '2100-01-01' },
  /** profiles.max_prep_minutes. */
  maxPrepMinutes: { min: 5, max: 240 },
  /** profiles.strength/cardio_sessions_per_week. */
  sessionsPerWeek: { min: 0, max: 14 },
  /** profiles.preferred_workout_minutes. */
  preferredWorkoutMinutes: { min: 10, max: 180 },
  /** workout_logs/scheduled_workouts.duration_min. */
  workoutDurationMin: { min: 1, max: 600 },
  /** workout_logs.estimated_kcal (informational only). */
  workoutKcal: { min: 0, max: 5000 },
  /** food_items.prep_minutes. */
  foodPrepMinutes: { min: 0, max: 600 },
  /** food_items.cost_tier. */
  costTier: { min: 1, max: 3 },
  /** Grams in one logged portion: must be > 0. `max` = UI limit, `storageMax` = meal_logs.grams check. */
  entryGrams: { exclusiveMin: 0, max: 5000, storageMax: 10000 },
  /** meal_logs.quantity: number of serving units, > 0. */
  entryQuantity: { exclusiveMin: 0, max: 10000 },
  /** meal_logs.serving_grams and household serving sizes: grams per serving unit, > 0. */
  servingGrams: { exclusiveMin: 0, max: 5000 },
  /** Any single nutrient amount (is_valid_nutrient_map). */
  nutrientValue: { min: 0, max: 100000 },
  /** Calories per 100 g (is_valid_nutrient_map; pure fat is ~900 kcal). */
  caloriesPer100g: { min: 0, max: 1000 },
} as const

/**
 * Maximum text lengths in characters (Unicode code points, matching Postgres `char_length`).
 * Required texts must also be non-empty where noted in the schemas.
 */
export const TEXT_LIMITS = {
  displayName: 80,
  foodName: 200,
  brand: 120,
  externalId: 64,
  servingLabel: 80,
  attribution: 300,
  weightNote: 280,
  workoutNotes: 500,
  scheduledRationale: 300,
  savedMealName: 80,
  /** App-level limit (no DB check): one dislike keyword. */
  dislike: 80,
  /** App-level limit (no DB check): one food tag. */
  foodTag: 64,
} as const

/** Maximum list sizes (Postgres `cardinality` / `jsonb_array_length` checks). */
export const COUNT_LIMITS = {
  servings: 20,
  foodTags: 30,
  foodMealTypes: 10,
  dislikes: 50,
  savedMealItems: { min: 1, max: 20 },
} as const

/** food_items.barcode: 6–14 digits (UPC/EAN/GTIN). */
export const BARCODE_PATTERN = /^[0-9]{6,14}$/
