import type { ActivityLevel, GoalPace, Sex, WellnessGoal } from '@/types'
import {
  ACTIVITY_FACTORS,
  CALORIE_FLOOR_KCAL,
  DAYS_PER_WEEK,
  GAIN_RATE_PCT_PER_WEEK,
  GAIN_SURPLUS_KCAL_CAP,
  KCAL_PER_KG_BODY_WEIGHT,
  LOSS_DEFICIT_KCAL_CAP,
  LOSS_RATE_PCT_PER_WEEK,
  MIFFLIN_SEX_CONSTANT,
  MIFFLIN_ST_JEOR,
} from './constants'
import { formatAmount, roundKcal } from './format'

export interface BodyMetrics {
  sex: Sex
  weightKg: number
  heightCm: number
  ageYears: number
}

/** Mifflin-St Jeor resting energy, kcal/day (unrounded). `unspecified` averages both equations. */
export function mifflinStJeorBmr({ sex, weightKg, heightCm, ageYears }: BodyMetrics): number {
  return (
    MIFFLIN_ST_JEOR.perKg * weightKg +
    MIFFLIN_ST_JEOR.perCm * heightCm +
    MIFFLIN_ST_JEOR.perYear * ageYears +
    MIFFLIN_SEX_CONSTANT[sex]
  )
}

/** Maintenance estimate = resting energy × activity factor, kcal/day (unrounded). */
export function maintenanceFromBmr(bmrKcal: number, activityLevel: ActivityLevel): number {
  return bmrKcal * ACTIVITY_FACTORS[activityLevel]
}

/** kcal/day equivalent of changing `ratePctPerWeek` % of body weight per week. */
export function dailyKcalForWeeklyRate(weightKg: number, ratePctPerWeek: number): number {
  return (weightKg * (ratePctPerWeek / 100) * KCAL_PER_KG_BODY_WEIGHT) / DAYS_PER_WEEK
}

export interface GoalAdjustmentInput {
  goal: WellnessGoal
  pace: GoalPace
  sex: Sex
  weightKg: number
  targetWeightKg: number | null
  /** Maintenance already rounded to 10 kcal. */
  maintenanceKcal: number
}

export interface GoalAdjustment {
  /** Multiple of 10 kcal; negative = deficit. */
  adjustmentKcal: number
  notes: string[]
}

const TARGET_REACHED_NOTE = 'You’ve reached your target weight, so energy is set for maintenance.'

function lossAdjustment(input: GoalAdjustmentInput): GoalAdjustment {
  const { pace, sex, weightKg, targetWeightKg, maintenanceKcal } = input
  if (targetWeightKg !== null && weightKg <= targetWeightKg) return { adjustmentKcal: 0, notes: [TARGET_REACHED_NOTE] }
  const floor = CALORIE_FLOOR_KCAL[sex]
  if (maintenanceKcal <= floor) {
    return {
      adjustmentKcal: 0,
      notes: [
        'Your target is set at your estimated maintenance. For a personalized plan below this level, a registered dietitian or doctor can help.',
      ],
    }
  }
  const deficit = Math.min(LOSS_DEFICIT_KCAL_CAP[pace], dailyKcalForWeeklyRate(weightKg, LOSS_RATE_PCT_PER_WEEK[pace]))
  const floored = maintenanceKcal - deficit < floor
  const target = roundKcal(Math.max(maintenanceKcal - deficit, floor))
  const adjustmentKcal = target - maintenanceKcal
  const notes = [`Includes a ${pace} deficit of ${formatAmount(-adjustmentKcal)} kcal/day toward your weight goal.`]
  if (floored) notes.push(`Energy stays at or above ${formatAmount(floor)} kcal/day, a common minimum without professional guidance.`)
  return { adjustmentKcal, notes }
}

function gainAdjustment(input: GoalAdjustmentInput): GoalAdjustment {
  const { pace, weightKg, targetWeightKg } = input
  if (targetWeightKg !== null && weightKg >= targetWeightKg) return { adjustmentKcal: 0, notes: [TARGET_REACHED_NOTE] }
  const surplus = Math.min(GAIN_SURPLUS_KCAL_CAP[pace], dailyKcalForWeeklyRate(weightKg, GAIN_RATE_PCT_PER_WEEK[pace]))
  const adjustmentKcal = roundKcal(surplus)
  return {
    adjustmentKcal,
    notes: [`Includes a ${pace} surplus of ${formatAmount(adjustmentKcal)} kcal/day toward your goal.`],
  }
}

/**
 * Product-goal adjustment for adults with a complete profile (see research §2.2):
 * - lose_weight: deficit = min(cap[pace], weight × rate % × 7700 / 7); never below the sex floor and never
 *   above maintenance (when maintenance ≤ floor there is no deficit).
 * - gain_weight / build_muscle: surplus = min(cap[pace], weight × rate % × 7700 / 7).
 * - general_wellness / maintain: none.
 * A target weight already reached in the goal's direction means no adjustment.
 */
export function goalAdjustment(input: GoalAdjustmentInput): GoalAdjustment {
  switch (input.goal) {
    case 'lose_weight':
      return lossAdjustment(input)
    case 'gain_weight':
    case 'build_muscle':
      return gainAdjustment(input)
    case 'general_wellness':
    case 'maintain':
      return { adjustmentKcal: 0, notes: [] }
  }
}
