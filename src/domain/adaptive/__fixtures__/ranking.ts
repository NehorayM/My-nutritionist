import type { FoodItem } from '@/types'
import { scaleNutrients } from '../../nutrition'
import type { RankingContext, VarietySignals } from '../context'
import type { ScoredItem } from '../nutritionFit'
import { resolvePreferences, type AdaptivePreferences } from '../preferences'
import type { MealBudget } from '../types'

/** A regular lunch budget for a ~2,000 kcal day. */
export const LUNCH_BUDGET: MealBudget = {
  calories: 700,
  protein: 35,
  carbs: 85,
  fat: 23,
  fiber: 10,
  saturatedFat: 8,
  sodium: 800,
  potassium: 1000,
  calcium: 350,
  iron: 6,
  vitaminC: 30,
  vitaminD: 5,
}

export function noVariety(overrides: Partial<VarietySignals> = {}): VarietySignals {
  return { eatenIds: new Set(), eatenNames: new Set(), categoryCounts: new Map(), recentRank: new Map(), ...overrides }
}

export function prefs(overrides: Partial<AdaptivePreferences> = {}): AdaptivePreferences {
  return { ...resolvePreferences(null), maxPrepMinutes: 45, ...overrides }
}

/** Ranking context for a regular lunch with no gaps, preferences or history; override anything. */
export function rankingContext(overrides: Partial<RankingContext> = {}): RankingContext {
  return {
    budget: LUNCH_BUDGET,
    energyState: 'normal',
    mealType: 'lunch',
    gaps: [],
    microGaps: [],
    prefs: prefs(),
    favorites: new Set(),
    variety: noVariety(),
    ...overrides,
  }
}

/** A scored component: `grams` of the food with its scaled nutrients. */
export function item(food: FoodItem, grams: number): ScoredItem {
  return { food, grams, nutrients: scaleNutrients(food.per100g, grams) }
}
