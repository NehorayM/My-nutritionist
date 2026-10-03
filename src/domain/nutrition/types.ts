import type { MealType, NutrientKey, NutrientTotal, NutrientTotals } from '@/types'

/** goal = aim to reach (protein, fiber, micronutrients); limit = stay under (sodium, sat. fat, sugars); energy = calories. */
export type TargetKind = 'energy' | 'goal' | 'limit'

export interface NutrientTarget {
  /** Point target in the nutrient's unit. */
  amount: number
  /** Lower bound of the comfortable range (null when not meaningful). */
  min: number | null
  /** Upper bound of the comfortable range / upper limit (null when not meaningful). */
  max: number | null
  kind: TargetKind
}

export type NutrientTargets = Partial<Record<NutrientKey, NutrientTarget>>

/** Physiological estimate — separated from the product goal and recommendation. */
export interface EnergyEstimate {
  method: 'mifflin_st_jeor' | 'population_default'
  /** Resting energy estimate, kcal/day; null when inputs were insufficient. */
  bmrKcal: number | null
  /** Maintenance estimate (BMR × activity factor), kcal/day. */
  maintenanceKcal: number
  /** Product-goal adjustment applied to maintenance (negative = deficit). Always 0 in wellness mode. */
  goalAdjustmentKcal: number
}

export interface DailyTargets {
  /**
   * personalized: full profile available and adult.
   * general:      profile incomplete or user is a minor → population-level wellness targets, no deficit/surplus.
   */
  mode: 'personalized' | 'general'
  estimate: EnergyEstimate
  targets: NutrientTargets
  /** Human-readable assumptions behind the numbers (shown in "How targets are calculated"). */
  assumptions: string[]
}

export interface DayTotals {
  date: string
  totals: NutrientTotals
  byMeal: Record<MealType, NutrientTotals>
  entryCount: number
}

/**
 * under:    below the comfortable range so far
 * on_track: within range, or progressing as expected for this time of day
 * met:      goal reached
 * over:     above the upper bound (or limit exceeded)
 * unknown:  no known data for this nutrient yet
 */
export type NutrientStatus = 'under' | 'on_track' | 'met' | 'over' | 'unknown'

export interface RemainingNutrient {
  key: NutrientKey
  target: NutrientTarget
  consumed: NutrientTotal
  /** target.amount − consumed.value; may be negative (surplus). */
  remaining: number
  /** consumed.value / target.amount (0 when target is 0). Not clamped. */
  progress: number
  status: NutrientStatus
  /** False when at least one logged item lacks this nutrient. */
  dataComplete: boolean
}

export interface RemainingNutrition {
  byNutrient: Partial<Record<NutrientKey, RemainingNutrient>>
  /** Meal slots still ahead in the day (by local time and what was logged). */
  remainingMeals: MealType[]
  /** Nutrients with a meaningful shortfall worth addressing in the remaining meals. */
  gaps: NutrientKey[]
  /** Nutrients already meaningfully above target/limit. */
  surpluses: NutrientKey[]
}

export interface MicronutrientCoverageItem {
  key: NutrientKey
  consumed: number
  target: number
  /** consumed / target clamped to [0, 1]. */
  ratio: number
  dataComplete: boolean
}

export interface MicronutrientCoverage {
  items: MicronutrientCoverageItem[]
  /** Mean of clamped ratios over nutrients with a target; null when nothing logged. */
  overall: number | null
  /** Share of logged items that report ALL tracked micronutrients (0–1); null when nothing logged. */
  dataCompleteness: number | null
}
