import type { MealType, PlannerSettings } from '@/types'
import { DAILY_RANGE_TOLERANCE, MEAL_RANGE_TOLERANCE, MEAL_SHARES } from './constants'

export interface KcalRange {
  min: number
  max: number
  /** Point aimed at when sizing portions. */
  target: number
}

/** The day's calorie target and comfortable range (from the nutrition targets). */
export interface CalorieTarget {
  amount: number
  min: number | null
  max: number | null
}

const round = (value: number) => Math.round(value)

function range(min: number, max: number, target?: number): KcalRange {
  const low = Math.min(min, max)
  const high = Math.max(min, max)
  const aim = target === undefined ? (low + high) / 2 : Math.min(high, Math.max(low, target))
  return { min: round(low), max: round(high), target: round(aim) }
}

/**
 * Daily range: the user's limits where set; otherwise the targets' comfortable range, or the target ±10 %.
 * With only one limit set, the other comes from the targets (and never crosses the set one).
 */
export function dailyRange(settings: Pick<PlannerSettings, 'dailyKcalMin' | 'dailyKcalMax'>, calories: CalorieTarget): KcalRange {
  const derivedMin = calories.min ?? calories.amount * (1 - DAILY_RANGE_TOLERANCE)
  const derivedMax = calories.max ?? calories.amount * (1 + DAILY_RANGE_TOLERANCE)
  const { dailyKcalMin: setMin, dailyKcalMax: setMax } = settings
  if (setMin !== null && setMax !== null) return range(setMin, setMax)
  if (setMin !== null) return range(setMin, Math.max(setMin, derivedMax), calories.amount)
  if (setMax !== null) return range(Math.min(setMax, derivedMin), setMax, calories.amount)
  return range(derivedMin, derivedMax, calories.amount)
}

/**
 * Calorie range of each planned meal: the meal's own limits where set; otherwise its share of the daily target
 * (shares of the planned meals sum to 1) ±15 %.
 */
export function mealRanges(settings: PlannerSettings, meals: readonly MealType[], day: KcalRange): Partial<Record<MealType, KcalRange>> {
  const totalShare = meals.reduce((sum, meal) => sum + MEAL_SHARES[meal], 0)
  const result: Partial<Record<MealType, KcalRange>> = {}
  for (const meal of meals) {
    const target = totalShare > 0 ? (day.target * MEAL_SHARES[meal]) / totalShare : 0
    const derived = { min: target * (1 - MEAL_RANGE_TOLERANCE), max: target * (1 + MEAL_RANGE_TOLERANCE) }
    const { kcalMin, kcalMax } = settings.meals[meal]
    const min = kcalMin ?? (kcalMax !== null ? Math.min(kcalMax, derived.min) : derived.min)
    const max = kcalMax ?? (kcalMin !== null ? Math.max(kcalMin, derived.max) : derived.max)
    result[meal] = range(min, max, kcalMin === null && kcalMax === null ? target : undefined)
  }
  return result
}
