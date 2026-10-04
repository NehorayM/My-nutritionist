import type { Allergen, FoodCategory, FoodItem, FoodSource, NutrientProfile, ServingOption } from '@/types'
import { foodItemSchema } from '@/schemas'
import { asRow, numeric, numericItemFields, parseMapped } from './shared'

/** `public.food_items` row. `created_by` is the owner (null = system food). */
export interface FoodItemRow {
  id: string
  source: FoodSource
  external_id: string | null
  name: string
  brand: string | null
  barcode: string | null
  category: FoodCategory | null
  nutrients_per_100g: NutrientProfile
  servings: ServingOption[]
  /** null = allergen information unknown (kept distinct from an empty list). */
  allergens: Allergen[] | null
  is_vegetarian: boolean | null
  is_vegan: boolean | null
  tags: string[]
  meal_types: string[]
  prep_minutes: number | null
  requires_cooking: boolean | null
  cost_tier: 1 | 2 | 3 | null
  attribution: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export function foodItemToRow(food: FoodItem): FoodItemRow {
  return {
    id: food.id,
    source: food.source,
    external_id: food.externalId,
    name: food.name,
    brand: food.brand,
    barcode: food.barcode,
    category: food.category,
    nutrients_per_100g: food.per100g,
    servings: food.servings,
    allergens: food.allergens,
    is_vegetarian: food.dietFlags.vegetarian,
    is_vegan: food.dietFlags.vegan,
    tags: food.tags,
    meal_types: food.mealTypes,
    prep_minutes: food.prepMinutes,
    requires_cooking: food.requiresCooking,
    cost_tier: food.costTier,
    attribution: food.attribution,
    created_by: food.createdBy,
    created_at: food.createdAt,
    updated_at: food.updatedAt,
  }
}

export function foodItemFromRow(value: unknown): FoodItem | null {
  const row = asRow(value)
  if (!row) return null
  return parseMapped(foodItemSchema, {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    name: row.name,
    brand: row.brand,
    barcode: row.barcode,
    category: row.category,
    per100g: row.nutrients_per_100g,
    servings: numericItemFields(row.servings, ['grams']),
    allergens: row.allergens,
    dietFlags: { vegetarian: row.is_vegetarian, vegan: row.is_vegan },
    tags: row.tags,
    mealTypes: row.meal_types,
    prepMinutes: numeric(row.prep_minutes),
    requiresCooking: row.requires_cooking,
    costTier: numeric(row.cost_tier),
    attribution: row.attribution,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}
