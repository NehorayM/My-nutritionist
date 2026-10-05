import { LIMITS } from '@/schemas'
import type { FoodPortion, MealEntry, MealType } from '@/types'

/**
 * Pure food-log helpers shared by the meals store and the Meals UI: portion validation, food identity
 * and the Recent foods list.
 */

/** Smallest loggable amount: below it every nutrient rounds to nothing. */
export const MIN_ENTRY_GRAMS = 0.1

export interface RecentFood {
  /** Food identity: food id, else provider source + external id, else name + brand. */
  key: string
  /** The most recently logged portion of this food. */
  portion: FoodPortion
  mealType: MealType
  loggedAt: string
}

/** Validation message for `quantity` units of `servingGrams` (null = grams), or null when loggable. */
export function portionAmountError(quantity: number | null, servingGrams: number | null): string | null {
  if (quantity === null || !Number.isFinite(quantity)) return 'Enter an amount.'
  if (quantity <= 0) return 'Enter an amount greater than 0.'
  if (servingGrams !== null && !(servingGrams > 0 && servingGrams <= LIMITS.servingGrams.max)) {
    return 'This serving size can’t be used. Choose grams or another unit.'
  }
  const grams = quantity * (servingGrams ?? 1)
  if (grams < MIN_ENTRY_GRAMS) return `That’s too small to log. Enter at least ${MIN_ENTRY_GRAMS} g.`
  if (grams > LIMITS.entryGrams.max) {
    return `That’s more than ${LIMITS.entryGrams.max.toLocaleString('en-US')} g in one entry. Check the amount, or log it as separate entries.`
  }
  if (quantity > LIMITS.entryQuantity.max) return `Enter at most ${LIMITS.entryQuantity.max.toLocaleString('en-US')} servings.`
  return null
}

/** The portion fields of an entry (or of any object carrying them). */
export function toPortion(source: FoodPortion): FoodPortion {
  const { foodId, foodSource, foodExternalId, foodName, brand, quantity, servingLabel, servingGrams, grams, per100g } = source
  return { foodId, foodSource, foodExternalId, foodName, brand, quantity, servingLabel, servingGrams, grams, per100g: { ...per100g } }
}

/**
 * Food identity of a portion: the provider record (so a saved USDA/Open Food Facts copy and the unsaved result
 * are one food), else the stored food id, else name + brand.
 */
export function foodKey(portion: Pick<FoodPortion, 'foodId' | 'foodSource' | 'foodExternalId' | 'foodName' | 'brand'>): string {
  if (portion.foodExternalId) return `${portion.foodSource}:${portion.foodExternalId}`
  if (portion.foodId) return `id:${portion.foodId}`
  return `name:${portion.foodName.trim().toLowerCase()}|${(portion.brand ?? '').trim().toLowerCase()}`
}

/** Recent foods from entries (newest first), one per food identity, keeping the last-used portion. */
export function recentFoods(entries: readonly MealEntry[]): RecentFood[] {
  const seen = new Map<string, RecentFood>()
  for (const entry of [...entries].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))) {
    const key = foodKey(entry)
    if (!seen.has(key)) seen.set(key, { key, portion: toPortion(entry), mealType: entry.mealType, loggedAt: entry.loggedAt })
  }
  return [...seen.values()]
}
