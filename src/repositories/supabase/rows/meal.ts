import type { Favorite, FoodPortion, FoodSource, MealEntry, MealType, NutrientProfile, SavedMeal } from '@/types'
import { favoriteSchema, mealEntrySchema, savedMealSchema } from '@/schemas'
import { asRow, numeric, numericItemFields, parseMapped } from './shared'

/** `public.meal_logs` row: a logged portion with its nutrient snapshot. */
export interface MealLogRow {
  id: string
  user_id: string
  log_date: string
  meal_type: MealType
  food_id: string | null
  food_source: FoodSource
  food_external_id: string | null
  food_name: string
  brand: string | null
  quantity: number
  serving_label: string | null
  serving_grams: number | null
  grams: number
  nutrients_per_100g: NutrientProfile
  logged_at: string
  created_at: string
  updated_at: string
}

export function mealEntryToRow(entry: MealEntry): MealLogRow {
  return {
    id: entry.id,
    user_id: entry.userId,
    log_date: entry.date,
    meal_type: entry.mealType,
    food_id: entry.foodId,
    food_source: entry.foodSource,
    food_external_id: entry.foodExternalId,
    food_name: entry.foodName,
    brand: entry.brand,
    quantity: entry.quantity,
    serving_label: entry.servingLabel,
    serving_grams: entry.servingGrams,
    grams: entry.grams,
    nutrients_per_100g: entry.per100g,
    logged_at: entry.loggedAt,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  }
}

export function mealEntryFromRow(value: unknown): MealEntry | null {
  const row = asRow(value)
  if (!row) return null
  return parseMapped(mealEntrySchema, {
    id: row.id,
    userId: row.user_id,
    date: row.log_date,
    mealType: row.meal_type,
    foodId: row.food_id,
    foodSource: row.food_source,
    foodExternalId: row.food_external_id,
    foodName: row.food_name,
    brand: row.brand,
    quantity: numeric(row.quantity),
    servingLabel: row.serving_label,
    servingGrams: numeric(row.serving_grams),
    grams: numeric(row.grams),
    per100g: row.nutrients_per_100g,
    loggedAt: row.logged_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

/** `public.saved_meals` row; `items` is a jsonb array of domain-shaped `FoodPortion`s (validated on read). */
export interface SavedMealRow {
  id: string
  user_id: string
  name: string
  meal_type: MealType | null
  items: FoodPortion[]
  created_at: string
  updated_at: string
}

export function savedMealToRow(meal: SavedMeal): SavedMealRow {
  return {
    id: meal.id,
    user_id: meal.userId,
    name: meal.name,
    meal_type: meal.mealType,
    items: meal.items,
    created_at: meal.createdAt,
    updated_at: meal.updatedAt,
  }
}

export function savedMealFromRow(value: unknown): SavedMeal | null {
  const row = asRow(value)
  if (!row) return null
  return parseMapped(savedMealSchema, {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    mealType: row.meal_type,
    items: numericItemFields(row.items, ['quantity', 'servingGrams', 'grams']),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

/** `public.favorites` row. */
export interface FavoriteRow {
  id: string
  user_id: string
  food_id: string
  created_at: string
  updated_at: string
}

export function favoriteToRow(favorite: Favorite): FavoriteRow {
  return {
    id: favorite.id,
    user_id: favorite.userId,
    food_id: favorite.foodId,
    created_at: favorite.createdAt,
    updated_at: favorite.updatedAt,
  }
}

export function favoriteFromRow(value: unknown): Favorite | null {
  const row = asRow(value)
  if (!row) return null
  return parseMapped(favoriteSchema, {
    id: row.id,
    userId: row.user_id,
    foodId: row.food_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}
