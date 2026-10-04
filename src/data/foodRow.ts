import type { NutrientProfile } from '../types/nutrition.ts'

/**
 * Structural, node-safe mirror of `FoodItem` (src/types/food.ts) with enumerations widened to `string`.
 *
 * Every `FoodItem` is assignable to it, so the SQL generator accepts app foods as well as raw catalog rows
 * produced under plain Node (where `src/types/food.ts` cannot be type-checked with tsconfig.node.json).
 */
export interface FoodRow {
  readonly id: string
  readonly source: string
  readonly externalId: string | null
  readonly name: string
  readonly brand: string | null
  readonly barcode: string | null
  readonly category: string | null
  readonly per100g: Readonly<NutrientProfile>
  readonly servings: readonly { readonly label: string; readonly grams: number }[]
  readonly allergens: readonly string[] | null
  readonly dietFlags: { readonly vegetarian: boolean | null; readonly vegan: boolean | null }
  readonly tags: readonly string[]
  readonly mealTypes: readonly string[]
  readonly prepMinutes: number | null
  readonly requiresCooking: boolean | null
  readonly costTier: number | null
  readonly attribution: string | null
  readonly createdBy: string | null
  readonly createdAt: string
  readonly updatedAt: string
}
