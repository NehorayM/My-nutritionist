import { MEAL_TYPES, NUTRIENT_KEYS, type MealType } from '@/types'
import { KCAL_PER_GRAM, type DailyTargets, type RemainingNutrition } from '../nutrition'
import {
  BUDGET_CAP_SHARE,
  BUDGET_FLOOR_SHARE,
  DEFAULT_CARB_SHARE_OF_REST,
  FALLBACK_DAILY_KCAL,
  LIGHT_MEAL_FACTOR,
  MAX_MEAL_FACTOR,
  LIGHT_PROTEIN_ENERGY_SHARE,
  MEAL_WEIGHTS,
  PROTEIN_MAX_ENERGY_SHARE,
} from './constants'
import type { EnergyState, MealAllocation, MealBudget } from './types'

export interface AllocationOptions {
  /**
   * Regular-sized meals only (used for under-18s): the energy budget never drops below a regular meal and
   * there is no light allowance — in line with guidance to avoid restrictive eating and skipped meals.
   */
  regularMeals?: boolean
}

export function mealWeight(meal: MealType): number {
  return MEAL_WEIGHTS[meal]
}

/** The next meal to plan: the earliest main meal still ahead, otherwise snacks; null when nothing remains. */
export function nextMealSlot(remainingMeals: readonly MealType[]): MealType | null {
  const main = MEAL_TYPES.find((meal) => meal !== 'snack' && remainingMeals.includes(meal))
  if (main) return main
  return remainingMeals.includes('snack') ? 'snack' : null
}

/** Daily energy target, or the population reference when the targets carry none. */
export function dailyEnergyTarget(targets: DailyTargets): number {
  const amount = targets.targets.calories?.amount
  return amount !== undefined && Number.isFinite(amount) && amount > 0 ? amount : FALLBACK_DAILY_KCAL
}

function sumWeights(meals: Iterable<MealType>): number {
  let total = 0
  for (const meal of new Set(meals)) total += mealWeight(meal)
  return total
}

interface EnergyPlan {
  kcal: number
  state: EnergyState
}

function energyPlan(remaining: RemainingNutrition, dailyKcal: number, share: number, regularKcal: number, options: AllocationOptions): EnergyPlan {
  const remainingKcal = remaining.byNutrient.calories?.remaining ?? dailyKcal
  const proportional = Math.max(0, remainingKcal) * share
  const maxKcal = regularKcal * MAX_MEAL_FACTOR
  if (options.regularMeals) return { kcal: Math.min(Math.max(proportional, regularKcal), maxKcal), state: 'normal' }
  const lightKcal = regularKcal * LIGHT_MEAL_FACTOR
  if (remaining.surpluses.includes('calories')) return { kcal: lightKcal, state: 'surplus' }
  if (proportional < lightKcal) return { kcal: lightKcal, state: 'light' }
  return { kcal: Math.min(proportional, maxKcal), state: 'normal' }
}

/**
 * Re-balance protein, carbohydrate and fat so their energy matches the meal's energy budget: protein keeps its
 * amount (at most half the energy), carbohydrate and fat share the rest in proportion to their own budgets
 * (55 / 45 when that proportion is unavailable — one has no target or both are 0).
 */
function balanceMacros(budget: MealBudget, kcal: number): void {
  const proteinKcal = Math.min((budget.protein ?? 0) * KCAL_PER_GRAM.protein, kcal * PROTEIN_MAX_ENERGY_SHARE)
  if (budget.protein !== undefined) budget.protein = proteinKcal / KCAL_PER_GRAM.protein
  const rest = kcal - proteinKcal
  const { carbs, fat } = budget
  const carbKcal = (carbs ?? 0) * KCAL_PER_GRAM.carbs
  const fatKcal = (fat ?? 0) * KCAL_PER_GRAM.fat
  const proportional = carbs !== undefined && fat !== undefined && carbKcal + fatKcal > 0
  const carbShare = proportional ? carbKcal / (carbKcal + fatKcal) : DEFAULT_CARB_SHARE_OF_REST
  if (carbs !== undefined) budget.carbs = (rest * carbShare) / KCAL_PER_GRAM.carbs
  if (fat !== undefined) budget.fat = (rest * (1 - carbShare)) / KCAL_PER_GRAM.fat
}

/**
 * Meal Allocation Engine: the share of what remains of the day that the next meal should aim for.
 *
 * - Share: the target meal's weight over the weights of the meals still ahead (main meals 1, snacks 0.35).
 * - Energy: remaining energy × share, capped at 1.6 × a regular meal (regular = the slot's share of the daily
 *   target). When intake is already above the energy range (`surplus`) or the share is below half a regular
 *   meal (`light`), the budget becomes a light-meal allowance of half a regular meal — meals are never skipped —
 *   and protein aims for at least 30 % of it.
 * - Every other nutrient with a target: remaining × share, kept between half and twice the meal's proportional
 *   share of the daily target (target × meal energy / daily energy), so meals stay balanced, a late snack is not
 *   asked to cover the whole day, and nothing is ever negative. Limits (sodium, saturated fat) are allowances.
 * - Protein, carbohydrate and fat are then balanced to the energy budget (protein ≤ 50 % of it).
 */
export function allocateMeal(
  remaining: RemainingNutrition,
  targets: DailyTargets,
  targetMeal: MealType,
  remainingMeals: readonly MealType[],
  options: AllocationOptions = {},
): MealAllocation {
  const dailyKcal = dailyEnergyTarget(targets)
  const share = mealWeight(targetMeal) / sumWeights([...remainingMeals, targetMeal])
  const regularKcal = (dailyKcal * mealWeight(targetMeal)) / sumWeights(MEAL_TYPES)
  const { kcal, state } = energyPlan(remaining, dailyKcal, share, regularKcal, options)

  const budget: MealBudget = { calories: kcal }
  for (const key of NUTRIENT_KEYS) {
    const target = targets.targets[key]
    if (key === 'calories' || !target) continue
    const left = remaining.byNutrient[key]?.remaining ?? target.amount
    const proportional = (target.amount * kcal) / dailyKcal
    const wanted = Math.max(0, left) * share
    budget[key] = Math.min(Math.max(wanted, BUDGET_FLOOR_SHARE * proportional), BUDGET_CAP_SHARE * proportional)
  }
  if (state !== 'normal' && budget.protein !== undefined) {
    budget.protein = Math.max(budget.protein, (LIGHT_PROTEIN_ENERGY_SHARE * kcal) / KCAL_PER_GRAM.protein)
  }
  balanceMacros(budget, kcal)
  return { budget, share, energyState: state }
}

/** The allocated budget only (see `allocateMeal`). */
export function allocateMealBudget(
  remaining: RemainingNutrition,
  targets: DailyTargets,
  targetMeal: MealType,
  remainingMeals: readonly MealType[],
  options: AllocationOptions = {},
): MealBudget {
  return allocateMeal(remaining, targets, targetMeal, remainingMeals, options).budget
}
