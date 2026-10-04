import {
  MEAL_TYPES,
  NUTRIENT_KEYS,
  type FoodPortion,
  type MealEntry,
  type MealType,
  type NutrientProfile,
  type NutrientTotals,
} from '@/types'
import { emptyTotals } from '../nutrients'
import { isKnownAmount, portionNutrients } from './portion'
import type { DayTotals } from './types'

/**
 * Nutrient Aggregation Engine: sum known values per nutrient and count known/missing items.
 * An unknown value (null) is never treated as 0 — it increments `missingCount` instead.
 */
export function sumNutrientProfiles(profiles: readonly NutrientProfile[]): NutrientTotals {
  const totals = emptyTotals()
  for (const profile of profiles) {
    for (const key of NUTRIENT_KEYS) {
      const value = profile[key]
      const total = totals[key]
      if (isKnownAmount(value)) {
        total.value += value
        total.knownCount += 1
      } else {
        total.missingCount += 1
      }
    }
  }
  return totals
}

/** Totals for a set of portions (each scaled from its per-100 g snapshot). */
export function totalsForPortions(portions: ReadonlyArray<Pick<FoodPortion, 'per100g' | 'grams'>>): NutrientTotals {
  return sumNutrientProfiles(portions.map(portionNutrients))
}

/**
 * Daily totals, overall and per meal slot (every slot present, empty slots have zero totals).
 * Entries whose `date` differs from `date` are ignored.
 */
export function aggregateDay(
  date: string,
  entries: ReadonlyArray<Pick<MealEntry, 'date' | 'mealType' | 'per100g' | 'grams'>>,
): DayTotals {
  const dayEntries = entries.filter((entry) => entry.date === date)
  const byMeal = Object.fromEntries(
    MEAL_TYPES.map((mealType) => [mealType, totalsForPortions(dayEntries.filter((entry) => entry.mealType === mealType))]),
  ) as Record<MealType, NutrientTotals>
  return { date, totals: totalsForPortions(dayEntries), byMeal, entryCount: dayEntries.length }
}

/** Collapse totals to a profile: the summed value when anything was known, otherwise null. */
export function totalsToProfile(totals: NutrientTotals): NutrientProfile {
  const profile = {} as NutrientProfile
  for (const key of NUTRIENT_KEYS) {
    const total = totals[key]
    profile[key] = total.knownCount > 0 ? total.value : null
  }
  return profile
}
