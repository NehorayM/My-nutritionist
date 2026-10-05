import { MICRO_KEYS, type FoodCategory, type FoodItem, type MealEntry, type MealType, type MicroKey, type NutrientKey } from '@/types'
import { RECENT_WINDOW } from './constants'
import { memoize } from './memo'
import type { AdaptivePreferences } from './preferences'
import type { EnergyState, MealBudget } from './types'

/** What was eaten today and recently, for the variety dimension. */
export interface VarietySignals {
  /** Food ids logged on the planned day. */
  eatenIds: ReadonlySet<string>
  /** Normalized names logged on the planned day (matches foods logged without an id). */
  eatenNames: ReadonlySet<string>
  /** How many of the day's entries fall in each category. */
  categoryCounts: ReadonlyMap<FoodCategory, number>
  /** Position in the recent-foods list (0 = most recent), first RECENT_WINDOW foods only. */
  recentRank: ReadonlyMap<string, number>
}

export interface RankingContext {
  budget: MealBudget
  energyState: EnergyState
  mealType: MealType
  /** Goal nutrients still well short today (protein, fiber, micronutrients). */
  gaps: readonly NutrientKey[]
  /** Micronutrient gaps with a positive meal budget — the only micronutrients the ranking credits. */
  microGaps: readonly MicroKey[]
  prefs: AdaptivePreferences
  favorites: ReadonlySet<string>
  variety: VarietySignals
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

/** A food's normalized full name (matches entries logged by name). */
export const foodNameKey = memoize((food: Pick<FoodItem, 'name'>): string => normalizeName(food.name))

/**
 * Variety signals for `date`: entries of other dates are ignored. Categories come from the candidate pool
 * (matched by food id, then by name); entries whose food is not in the pool add no category.
 */
export function varietySignals(
  entries: readonly MealEntry[],
  date: string,
  foods: readonly FoodItem[],
  recentFoodIds: readonly string[],
): VarietySignals {
  const byId = new Map(foods.map((food) => [food.id, food]))
  const byName = new Map(foods.map((food) => [foodNameKey(food), food]))
  const eatenIds = new Set<string>()
  const eatenNames = new Set<string>()
  const categoryCounts = new Map<FoodCategory, number>()
  for (const entry of entries) {
    if (entry.date !== date) continue
    if (entry.foodId !== null) eatenIds.add(entry.foodId)
    const name = normalizeName(entry.foodName)
    eatenNames.add(name)
    const category = ((entry.foodId !== null ? byId.get(entry.foodId) : undefined) ?? byName.get(name))?.category
    if (category) categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
  }
  const recentRank = new Map<string, number>()
  recentFoodIds.slice(0, RECENT_WINDOW).forEach((id, rank) => {
    if (!recentRank.has(id)) recentRank.set(id, rank)
  })
  return { eatenIds, eatenNames, categoryCounts, recentRank }
}

/** Micronutrient gaps the next meal has a positive budget for, in gap order. */
export function microGapsOf(gaps: readonly NutrientKey[], budget: MealBudget): MicroKey[] {
  return MICRO_KEYS.filter((key) => gaps.includes(key) && (budget[key] ?? 0) > 0).sort(
    (a, b) => gaps.indexOf(a) - gaps.indexOf(b),
  )
}
