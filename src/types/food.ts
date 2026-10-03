import type { NutrientProfile } from './nutrition'
import type { MealType } from './meal'

/**
 * Where a food definition comes from.
 * - system: bundled reference catalog (created_by = NULL in the database)
 * - usda:   USDA FoodData Central item (saved by a user)
 * - off:    Open Food Facts product (saved by a user)
 * - custom: food created by the user
 */
export const FOOD_SOURCES = ['system', 'usda', 'off', 'custom'] as const
export type FoodSource = (typeof FOOD_SOURCES)[number]

export const ALLERGENS = [
  'milk',
  'egg',
  'fish',
  'shellfish',
  'tree_nuts',
  'peanuts',
  'wheat',
  'gluten',
  'soy',
  'sesame',
] as const
export type Allergen = (typeof ALLERGENS)[number]

export const FOOD_CATEGORIES = [
  'protein',
  'dairy',
  'grain',
  'legume',
  'vegetable',
  'fruit',
  'fat',
  'nut_seed',
  'snack',
  'sweet',
  'fast_food',
  'israeli',
  'beverage',
  'prepared',
] as const
export type FoodCategory = (typeof FOOD_CATEGORIES)[number]

/** Well-known tags used by the recommendation engine. Foods may carry other free-form tags. */
export const FOOD_TAGS = [
  'mediterranean',
  'israeli',
  'no_cook',
  'quick',
  'budget',
  'high_protein',
  'high_fiber',
  'vegetarian',
  'vegan',
] as const
export type FoodTag = (typeof FOOD_TAGS)[number]

export interface ServingOption {
  /** Human label, e.g. "1 medium (118 g)" or "1 cup". */
  label: string
  /** Grams for ONE unit of this serving. */
  grams: number
}

/** Dietary compatibility; `null` = unknown (treated as incompatible for strict filters). */
export interface DietFlags {
  vegetarian: boolean | null
  vegan: boolean | null
}

export interface FoodItem {
  /** UUID. System foods use a deterministic UUID derived from their slug. */
  id: string
  source: FoodSource
  /** Provider identifier: system slug, USDA fdcId, or OFF barcode. */
  externalId: string | null
  name: string
  brand: string | null
  barcode: string | null
  category: FoodCategory | null
  /** Nutrients per 100 g of edible portion. Unknown values are null. */
  per100g: NutrientProfile
  /** Household servings; may be empty when only grams are known. */
  servings: ServingOption[]
  /** Known allergens. `null` = allergen information unavailable. */
  allergens: Allergen[] | null
  dietFlags: DietFlags
  tags: string[]
  /** Meals where this food is commonly eaten; empty = any. */
  mealTypes: MealType[]
  /** Typical preparation minutes as part of a meal; null = unknown. */
  prepMinutes: number | null
  requiresCooking: boolean | null
  /** Rough relative cost 1 (budget) – 3 (premium); null = unknown. */
  costTier: 1 | 2 | 3 | null
  /** Data provenance shown to the user, e.g. "USDA FoodData Central · SR Legacy 171477". */
  attribution: string | null
  /** Owner for user foods; null for system foods. */
  createdBy: string | null
  createdAt: string
  updatedAt: string
}
