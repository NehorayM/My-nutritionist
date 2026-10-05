import type { FoodItem, MealType, NutrientKey } from '@/types'
import { isKnownAmount } from '../nutrition'
import { effectivePrepMinutes } from './candidates'
import { QUICK_PREP_MINUTES } from './constants'
import { proteinEnergyShare } from './diets'
import { dishName } from './dishes'
import { pairs } from './pairing'
import type { AdaptivePreferences } from './preferences'
import { RECOMMENDATION_STYLES, type EnergyState, type RecommendationStyle } from './types'

/** A side joins an option when it is a different dish (by display name) that pairs with every component already in it. */
export function fitsWith(side: FoodItem, chosen: readonly FoodItem[], mealType: MealType): boolean {
  return chosen.every((food) => dishName(food) !== dishName(side) && pairs(food, side, mealType))
}

export interface StyleSignals {
  gaps: readonly NutrientKey[]
  energyState: EnergyState
  prefs: AdaptivePreferences
}

export interface StyleRule {
  /** Food may carry an option of this style. */
  anchor: (food: FoodItem) => boolean
  /** Food may complete an option of this style. */
  side: (food: FoodItem) => boolean
  /** Most components an option of this style combines with its anchor (the meal slot can lower it). */
  maxSides: number
  /** Share of the energy budget the option aims for. */
  energyFactor: (state: EnergyState) => number
  /** How relevant the style is today (higher first); 0 = still offered, just not prioritized. */
  relevance: (signals: StyleSignals) => number
}

/** The light style aims at 70 % of a regular budget; with a light allowance the budget is already light. */
export const LIGHT_STYLE_FACTOR = 0.7
/** Light options: anchors up to 200 kcal/100 g, sides up to 150 kcal/100 g (and no added fats). */
const LIGHT_KCAL_PER_100G = { anchor: 200, side: 150 } as const
/** High-protein anchors get at least 30 % of their energy from protein. */
const HIGH_PROTEIN_ANCHOR_SHARE = 0.3

const anyFood = (): boolean => true
const full = (): number => 1
const quick = (food: FoodItem): boolean => (effectivePrepMinutes(food) ?? Number.POSITIVE_INFINITY) <= QUICK_PREP_MINUTES
const noCook = (food: FoodItem): boolean => food.requiresCooking === false
const budgetTier = (food: FoodItem): boolean => food.costTier === 1
const mediterranean = (food: FoodItem): boolean => food.tags.includes('mediterranean')
const kcalAtMost =
  (limit: number) =>
  (food: FoodItem): boolean => {
    const kcal = food.per100g.calories
    return isKnownAmount(kcal) && kcal <= limit
  }

const has = (signals: StyleSignals, key: NutrientKey): number => (signals.gaps.includes(key) ? 1 : 0)
const hasMicroGap = (signals: StyleSignals): number =>
  signals.gaps.some((key) => key !== 'protein' && key !== 'fiber') ? 1 : 0
const beginner = (signals: StyleSignals): number => (signals.prefs.cookingSkill === 'beginner' ? 1 : 0)

export const STYLE_RULES: Readonly<Record<RecommendationStyle, StyleRule>> = {
  balanced: { anchor: anyFood, side: anyFood, maxSides: 2, energyFactor: full, relevance: (s) => 1 + has(s, 'fiber') + hasMicroGap(s) },
  high_protein: {
    anchor: (food) => proteinEnergyShare(food) >= HIGH_PROTEIN_ANCHOR_SHARE,
    side: anyFood,
    maxSides: 2,
    energyFactor: full,
    relevance: (s) => 2 * has(s, 'protein') + (s.prefs.dietType === 'high_protein' ? 1 : 0),
  },
  quick: { anchor: quick, side: quick, maxSides: 2, energyFactor: full, relevance: (s) => (s.prefs.maxPrepMinutes <= 15 ? 1 : 0) + beginner(s) },
  no_cook: { anchor: noCook, side: noCook, maxSides: 2, energyFactor: full, relevance: beginner },
  mediterranean: {
    anchor: mediterranean,
    side: (food) => mediterranean(food) || food.category === 'vegetable' || food.category === 'fruit',
    maxSides: 2,
    energyFactor: full,
    relevance: (s) =>
      (s.prefs.dietType === 'mediterranean' ? 2 : 0) + (s.prefs.preferredCuisines.includes('mediterranean') ? 1 : 0) + has(s, 'fiber'),
  },
  budget: { anchor: budgetTier, side: budgetTier, maxSides: 2, energyFactor: full, relevance: () => 0 },
  light: {
    anchor: kcalAtMost(LIGHT_KCAL_PER_100G.anchor),
    side: (food) => food.category !== 'fat' && kcalAtMost(LIGHT_KCAL_PER_100G.side)(food),
    maxSides: 1,
    energyFactor: (state) => (state === 'normal' ? LIGHT_STYLE_FACTOR : 1),
    relevance: (s) => (s.energyState === 'normal' ? 0 : 3),
  },
}

/** Styles ordered by today's relevance (ties keep the canonical order). */
export function stylesByRelevance(signals: StyleSignals): Array<{ style: RecommendationStyle; relevance: number }> {
  return RECOMMENDATION_STYLES.map((style) => ({ style, relevance: STYLE_RULES[style].relevance(signals) })).sort(
    (a, b) => b.relevance - a.relevance,
  )
}

/** Most sides for an option: snacks take at most one. */
export function maxSidesFor(style: RecommendationStyle, mealType: MealType): number {
  return Math.min(STYLE_RULES[style].maxSides, mealType === 'snack' ? 1 : 2)
}
