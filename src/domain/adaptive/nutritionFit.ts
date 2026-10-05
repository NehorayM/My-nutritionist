import type { MealType, MicroKey, NutrientProfile } from '@/types'
import { KCAL_PER_GRAM } from '../nutrition'
import {
  CALORIE_FIT,
  LIMIT_PENALTY,
  MACRO_FIT,
  MACRO_SHARES,
  MIN_MEAL_FIBER_G,
  NEUTRAL_SUBSCORE,
  PORTION_TOLERANCE,
  UNKNOWN_MICRO_PENALTY,
} from './constants'
import type { EnergyState, MealBudget, RecommendedItem } from './types'

/*
 * Nutrition dimensions of the Recommendation Ranking Engine. Every function returns a 0–1 sub-score
 * (the micronutrient score may dip below 0 through its confidence penalty). Unknown values earn no credit.
 */

export type ScoredItem = Pick<RecommendedItem, 'food' | 'grams' | 'nutrients'>

const MACROS = ['protein', 'carbs', 'fat'] as const
const LIMITS = ['sodium', 'saturatedFat'] as const

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Full credit within ±10 % of the energy budget, falling to 0 at +50 % or −60 %. */
export function calorieFitScore(kcal: number, budgetKcal: number): number {
  if (budgetKcal <= 0) return kcal <= 0 ? 1 : 0
  const deviation = (kcal - budgetKcal) / budgetKcal
  const excess = Math.abs(deviation) - CALORIE_FIT.tolerance
  if (excess <= 0) return 1
  const zeroAt = (deviation > 0 ? CALORIE_FIT.overZero : CALORIE_FIT.underZero) - CALORIE_FIT.tolerance
  return clamp01(1 - excess / zeroAt)
}

/** True when an option's known energy is within ±15 % of the meal's energy budget (unknown energy never fits). */
export function fitsEnergyBudget(kcal: number | null, budgetKcal: number | undefined): boolean {
  if (kcal === null || budgetKcal === undefined) return false
  return Math.abs(kcal - budgetKcal) <= PORTION_TOLERANCE * budgetKcal
}

/** Mean overshoot of the sodium / saturated-fat allowances (0 = within, 1 = at least double). */
function limitOvershoot(totals: NutrientProfile, budget: MealBudget): number {
  let sum = 0
  let count = 0
  for (const key of LIMITS) {
    const allowance = budget[key]
    const amount = totals[key]
    if (allowance === undefined || allowance <= 0 || amount === null) continue
    sum += clamp01((amount - allowance) / allowance)
    count += 1
  }
  return count > 0 ? sum / count : 0
}

/** 1 within the tolerance, falling linearly to 0 at `zeroAt` (relative deviation). */
function deviationFit(deviation: number): number {
  if (deviation <= MACRO_FIT.tolerance) return 1
  return clamp01(1 - (deviation - MACRO_FIT.tolerance) / (MACRO_FIT.zeroAt - MACRO_FIT.tolerance))
}

/**
 * How closely protein, carbohydrate and fat match the meal budget: each macro's relative deviation from its
 * budget (see `MACRO_FIT`; protein above budget counts half), weighted per `MACRO_SHARES`. Overshooting the
 * sodium or saturated-fat allowance removes up to 25 %.
 */
export function macroFitScore(totals: NutrientProfile, budget: MealBudget, state: EnergyState): number {
  const kcal = budget.calories ?? 0
  const shares = MACRO_SHARES[state === 'normal' ? 'normal' : 'light']
  let weighted = 0
  let weightSum = 0
  for (const key of MACROS) {
    const target = budget[key]
    if (target === undefined) continue
    const scale = Math.max(target, (MACRO_FIT.floorEnergyShare * kcal) / KCAL_PER_GRAM[key], Number.EPSILON)
    let diff = (totals[key] ?? 0) - target
    if (key === 'protein' && diff > 0) diff *= MACRO_FIT.extraProteinFactor
    weighted += shares[key] * deviationFit(Math.abs(diff) / scale)
    weightSum += shares[key]
  }
  const base = weightSum > 0 ? weighted / weightSum : NEUTRAL_SUBSCORE
  return base * (1 - LIMIT_PENALTY * limitOvershoot(totals, budget))
}

/** Known fiber against the meal's fiber budget (at least 4 g for a main meal, 2 g for a snack). */
export function fiberScore(totals: NutrientProfile, budget: MealBudget, mealType: MealType): number {
  const fiber = totals.fiber
  if (fiber === null) return 0
  const goal = Math.max(budget.fiber ?? 0, MIN_MEAL_FIBER_G[mealType === 'snack' ? 'snack' : 'main'])
  return clamp01(fiber / goal)
}

/**
 * Coverage of the targeted micronutrient gaps only (known values only), averaged over the gaps, minus a small
 * confidence penalty for every component whose value for a targeted nutrient is unknown. Neutral (0.5) when
 * no micronutrient is a gap, so ordinary days are not ranked on micronutrients at all.
 */
export function micronutrientScore(
  items: readonly ScoredItem[],
  totals: NutrientProfile,
  budget: MealBudget,
  microGaps: readonly MicroKey[],
): number {
  if (microGaps.length === 0) return NEUTRAL_SUBSCORE
  let coverage = 0
  let unknown = 0
  for (const key of microGaps) {
    const goal = budget[key] ?? 0
    const amount = totals[key]
    coverage += goal <= 0 ? 1 : amount === null ? 0 : clamp01(amount / goal)
    unknown += items.filter((item) => item.nutrients[key] === null).length
  }
  const pairs = microGaps.length * items.length
  const unknownShare = pairs > 0 ? unknown / pairs : 0
  return coverage / microGaps.length - UNKNOWN_MICRO_PENALTY * unknownShare
}
