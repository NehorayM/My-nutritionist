import type { Allergen, KitchenEquipment, MealConstraint, MealType, PantryItem, PlannerSettings } from '@/types'
import { daysBetween } from '../dates'
import { dietRule, isOccasionalFood, resolvePreferences, type AdaptivePreferences } from '../adaptive'
import { isKnownAmount } from '../nutrition'
import { COOK_PREFERENCE, EXTRA_COOKED_ITEM_MINUTES, MIN_PORTION_GRAMS, REHEAT_MINUTES, REHEAT_PREFERENCE } from './constants'

/** Why a pantry item is never planned (whole day). */
export type PantryExclusion = 'incomplete_nutrition' | 'expired' | 'used_up' | 'occasional' | 'allergen' | 'allergen_unknown' | 'diet'

/** Why an item can't be part of one particular meal. */
export type MealBlock = 'no_equipment' | 'no_cooking' | 'not_enough_time'

export interface ExclusionRules {
  prefs: AdaptivePreferences
  favorites: ReadonlySet<string>
  today: string
}

/** A gluten allergy covers wheat too (as in the Adaptive Nutrition Engine). */
function avoided(allergies: readonly Allergen[]): Set<Allergen> {
  const set = new Set<Allergen>(allergies)
  if (set.has('gluten')) set.add('wheat')
  return set
}

export function exclusionRules(profile: AdaptivePreferences | null, favoriteFoodIds: readonly string[], today: string): ExclusionRules {
  return { prefs: resolvePreferences(profile), favorites: new Set(favoriteFoodIds), today }
}

/**
 * Items never planned: unknown calories, past their use-by date, (almost) used up, occasional foods that are
 * not favorites (same rule as everywhere in the app), allergens of the profile (unknown allergen data counts as
 * a risk when allergies are set) and foods that don't suit the diet.
 */
export function pantryExclusion(item: PantryItem, rules: ExclusionRules): PantryExclusion | null {
  const { food } = item
  if (!isKnownAmount(food.per100g.calories) || food.per100g.calories <= 0) return 'incomplete_nutrition'
  if (item.useBy !== null && daysBetween(rules.today, item.useBy) < 0) return 'expired'
  if (item.grams !== null && item.grams < MIN_PORTION_GRAMS) return 'used_up'
  if (isOccasionalFood(food) && !rules.favorites.has(food.id)) return 'occasional'
  const allergies = avoided(rules.prefs.allergies)
  if (allergies.size > 0) {
    if (food.allergens === null) return 'allergen_unknown'
    if (food.allergens.some((allergen) => allergies.has(allergen))) return 'allergen'
  }
  if (!dietRule(rules.prefs.dietType).isCompatible(food)) return 'diet'
  return null
}

/** Equipment available at a meal: the day's equipment, or the meal's own list. */
export function mealEquipment(settings: PlannerSettings, mealType: MealType): KitchenEquipment[] {
  return settings.equipmentScope === 'day' ? settings.dayEquipment : settings.meals[mealType].equipment
}

/** The equipment this item would use at a meal (null for ready-to-eat items or when none fits). */
export function equipmentFor(item: PantryItem, available: readonly KitchenEquipment[]): KitchenEquipment | null {
  if (item.prep === 'ready') return null
  const order = item.prep === 'reheat' ? REHEAT_PREFERENCE : COOK_PREFERENCE
  return order.find((tool) => available.includes(tool) && item.methods.includes(tool)) ?? null
}

/** Minutes the item needs before eating. */
export function itemMinutes(item: PantryItem): number {
  if (item.prep === 'ready') return 0
  return item.prep === 'reheat' ? REHEAT_MINUTES : (item.cookMinutes ?? 0)
}

/** Whether the item can be part of the meal given its equipment, cooking possibility and time budget. */
export function mealBlock(item: PantryItem, constraint: MealConstraint, available: readonly KitchenEquipment[]): MealBlock | null {
  if (item.prep === 'ready') return null
  if (item.prep === 'cook' && !constraint.canCook) return 'no_cooking'
  if (equipmentFor(item, available) === null) return 'no_equipment'
  if (itemMinutes(item) > constraint.maxMinutes) return 'not_enough_time'
  return null
}

/**
 * Preparation time of a meal: the longest cooking time plus a few minutes for every further item cooked
 * from raw; warming up adds its minutes once when nothing else is cooked (it fits in the cooking time otherwise).
 */
export function mealMinutes(items: readonly PantryItem[]): number {
  const cooked = items.filter((item) => item.prep === 'cook').map(itemMinutes)
  const reheats = items.some((item) => item.prep === 'reheat')
  if (cooked.length === 0) return reheats ? REHEAT_MINUTES : 0
  return Math.max(...cooked) + EXTRA_COOKED_ITEM_MINUTES * (cooked.length - 1)
}

/** True when the item should be used within `days` days (and is not past its date). */
export function usesSoon(item: PantryItem, today: string, days: number): boolean {
  if (item.useBy === null) return false
  const left = daysBetween(today, item.useBy)
  return left >= 0 && left <= days
}
