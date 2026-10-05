import { isSystemFoodId, systemFoodById } from '@/data/systemFoods'
import { scaleNutrients } from '@/domain/nutrition'
import { formatKcal } from '@/lib/format'
import { isUnsavedProviderFood } from '@/services/food'
import { foodKey } from '@/domain/foodLog'
import type { FoodItem, FoodPortion, NutrientProfile } from '@/types'

/** "73 kcal / 100 g" ("— kcal / 100 g" when unknown). */
export function kcalPer100gText(food: Pick<FoodItem, 'per100g'>): string {
  return `${formatKcal(food.per100g.calories)} / 100 g`
}

/** Nutrients of a portion for display (unknown stays null). */
export function portionProfile(per100g: NutrientProfile, grams: number): NutrientProfile {
  return scaleNutrients(per100g, Math.max(0, grams))
}

/** Catalog foods, provider results and the user's own existing foods can be favorites (rebuilt snapshots can't). */
export function canFavorite(food: FoodItem, userFoods: readonly FoodItem[]): boolean {
  if (food.source === 'system') return isSystemFoodId(food.id)
  if (isUnsavedProviderFood(food)) return food.externalId !== null
  return userFoods.some((own) => own.id === food.id)
}

/**
 * The food behind a logged portion: the catalog or the user's own copy when it still exists, otherwise a
 * read-only food rebuilt from the portion's snapshot (its own serving is kept so it can be logged again).
 */
export function foodFromPortion(portion: FoodPortion, userFoods: readonly FoodItem[]): FoodItem {
  if (portion.foodId) {
    const known = systemFoodById(portion.foodId) ?? userFoods.find((food) => food.id === portion.foodId)
    if (known) return known
  }
  const servings = portion.servingLabel && portion.servingGrams ? [{ label: portion.servingLabel, grams: portion.servingGrams }] : []
  const provider = portion.foodSource === 'usda' || portion.foodSource === 'off'
  return {
    id: `snapshot:${foodKey(portion)}`,
    source: portion.foodSource,
    externalId: portion.foodExternalId,
    name: portion.foodName,
    brand: portion.brand,
    barcode: null,
    category: null,
    per100g: { ...portion.per100g },
    servings,
    allergens: null,
    dietFlags: { vegetarian: null, vegan: null },
    tags: [],
    mealTypes: [],
    prepMinutes: null,
    requiresCooking: null,
    costTier: null,
    attribution: null,
    // A provider snapshot stays "unsaved" (no owner) so favoriting saves a proper copy first.
    createdBy: provider || portion.foodSource === 'system' ? null : 'snapshot',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }
}
