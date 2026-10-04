/**
 * Bundled system food catalog as typed `FoodItem`s (USDA FoodData Central sourced, see system-foods.json).
 * Ids are deterministic (`systemFoodId(slug)`) and identical to the `food_items` seed rows in Supabase.
 */
import { SYSTEM_FOOD_RECORDS, SYSTEM_FOOD_ROWS, type SystemFoodRow } from '@/data/catalog'
import type { UsdaProvenance } from '@/data/catalogSchema'
import {
  ALLERGENS,
  FOOD_CATEGORIES,
  MEAL_TYPES,
  type Allergen,
  type FoodCategory,
  type FoodItem,
  type MealType,
} from '@/types'

export { SYSTEM_FOODS_RELEASED_AT } from '@/data/catalog'

function narrow<T extends string>(allowed: readonly T[], value: string, field: string, slug: string): T {
  const match = allowed.find((candidate) => candidate === value)
  if (match === undefined) throw new Error(`System food "${slug}" has an unsupported ${field} "${value}"`)
  return match
}

function deepFreeze(food: FoodItem): FoodItem {
  Object.freeze(food.per100g)
  food.servings.forEach((serving) => Object.freeze(serving))
  Object.freeze(food.servings)
  if (food.allergens !== null) Object.freeze(food.allergens)
  Object.freeze(food.dietFlags)
  Object.freeze(food.tags)
  Object.freeze(food.mealTypes)
  return Object.freeze(food)
}

/**
 * Narrows a catalog row to the `FoodItem` contract, validating categories, allergens and meal types against
 * the shared enumerations. Throws on unsupported values so an invalid catalog can never ship silently.
 */
export function toSystemFoodItem(row: SystemFoodRow): FoodItem {
  const slug = row.externalId
  const allergens: Allergen[] | null =
    row.allergens === null ? null : row.allergens.map((value) => narrow(ALLERGENS, value, 'allergen', slug))
  const category: FoodCategory = narrow(FOOD_CATEGORIES, row.category, 'category', slug)
  const mealTypes: MealType[] = row.mealTypes.map((value) => narrow(MEAL_TYPES, value, 'meal type', slug))
  return deepFreeze({
    id: row.id,
    source: row.source,
    externalId: slug,
    name: row.name,
    brand: row.brand,
    barcode: row.barcode,
    category,
    per100g: { ...row.per100g },
    servings: row.servings.map((serving) => ({ label: serving.label, grams: serving.grams })),
    allergens,
    dietFlags: { vegetarian: row.dietFlags.vegetarian, vegan: row.dietFlags.vegan },
    tags: [...row.tags],
    mealTypes,
    prepMinutes: row.prepMinutes,
    requiresCooking: row.requiresCooking,
    costTier: row.costTier,
    attribution: row.attribution,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}

/** All system foods in catalog order. Items are frozen: copy before modifying. */
export const SYSTEM_FOODS: readonly FoodItem[] = Object.freeze(SYSTEM_FOOD_ROWS.map(toSystemFoodItem))

const byId = new Map(SYSTEM_FOODS.map((food) => [food.id, food]))
const bySlug = new Map(SYSTEM_FOODS.map((food) => [food.externalId, food]))
const provenanceById = new Map(SYSTEM_FOOD_RECORDS.map((record) => [record.id, record.usda]))

export function systemFoodById(id: string): FoodItem | undefined {
  return byId.get(id.toLowerCase())
}

export function systemFoodBySlug(slug: string): FoodItem | undefined {
  return bySlug.get(slug)
}

/** USDA provenance (fdcId, data type, original description, match quality, note) for a system food id. */
export function systemFoodProvenance(id: string): UsdaProvenance | undefined {
  return provenanceById.get(id.toLowerCase())
}

export function isSystemFoodId(id: string): boolean {
  return byId.has(id.toLowerCase())
}
