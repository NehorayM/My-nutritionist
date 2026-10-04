import { z } from 'zod'
import { NUTRIENT_KEYS, type NutrientKey } from '@/types'
import { LIMITS } from './limits'

/** One nutrient amount: a finite number ≥ 0, or `null` when UNKNOWN (never coerced to 0). */
export const nutrientValueSchema = z.number().min(LIMITS.nutrientValue.min).max(LIMITS.nutrientValue.max).nullable()

function shapeForEveryNutrient<S extends z.ZodType>(value: S): Record<NutrientKey, S> {
  return Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, value])) as Record<NutrientKey, S>
}

/**
 * A complete `NutrientProfile`. Every key is present in the output:
 * - a key missing from the input becomes `null` (unknown) — e.g. data written before a nutrient was added;
 * - keys that are not nutrients are stripped.
 */
export const nutrientProfileSchema = z.object(shapeForEveryNutrient(nutrientValueSchema.default(null)))

/** Nutrients per 100 g of food: additionally caps calories like the database (`is_valid_nutrient_map`). */
export const nutrientsPer100gSchema = nutrientProfileSchema.refine(
  (profile) => profile.calories === null || profile.calories <= LIMITS.caloriesPer100g.max,
  { message: `Calories per 100 g must be at most ${LIMITS.caloriesPer100g.max}`, path: ['calories'] },
)
