import type { ActivityLevel, WellnessGoal } from '@/types'
import { ACTIVITY_FACTORS, MIN_PLAUSIBLE_BMR_KCAL, POPULATION_DEFAULT_KCAL } from './constants'
import type { MissingField, TargetContext } from './context'
import { goalAdjustment, maintenanceFromBmr, mifflinStJeorBmr } from './energy'
import { formatAmount, roundKcal } from './format'
import type { DailyTargets, EnergyEstimate } from './types'

export interface EnergyPlan {
  mode: DailyTargets['mode']
  estimate: EnergyEstimate
  /** Daily energy target, kcal (multiple of 10). */
  energyKcal: number
  notes: string[]
}

export const MINOR_NOTE = 'General wellness targets — no weight-change targets for people under 18.'

const ACTIVITY_LABELS: Readonly<Record<ActivityLevel, string>> = {
  sedentary: 'mostly seated',
  light: 'lightly active',
  moderate: 'moderately active',
  active: 'active',
  very_active: 'very active',
}

const WEIGHT_GOALS: ReadonlySet<WellnessGoal> = new Set<WellnessGoal>(['lose_weight', 'gain_weight', 'build_muscle'])

function listFields(fields: readonly MissingField[]): string {
  if (fields.length <= 1) return fields.join('')
  return `${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1]}`
}

function generalPlan(notes: string[]): EnergyPlan {
  return {
    mode: 'general',
    estimate: { method: 'population_default', bmrKcal: null, maintenanceKcal: POPULATION_DEFAULT_KCAL, goalAdjustmentKcal: 0 },
    energyKcal: POPULATION_DEFAULT_KCAL,
    notes: [...notes, `Energy uses a general reference of ${formatAmount(POPULATION_DEFAULT_KCAL)} kcal/day.`],
  }
}

function incompleteNotes(ctx: TargetContext): string[] {
  const notes = [`Add your ${listFields(ctx.missing)} for personalized targets.`]
  if (WEIGHT_GOALS.has(ctx.goal)) notes.push('Weight-goal adjustments start once your profile is complete.')
  return notes
}

/**
 * Energy part of the Daily Target Engine: physiological estimate (Mifflin-St Jeor × activity factor) →
 * product-goal adjustment. Minors, incomplete profiles and implausible estimates get the population default.
 */
export function estimateEnergy(ctx: TargetContext): EnergyPlan {
  if (ctx.minor) return generalPlan([MINOR_NOTE])
  const { ageYears, heightCm, weightKg } = ctx
  if (ageYears === null || heightCm === null || weightKg === null) return generalPlan(incompleteNotes(ctx))

  const bmr = mifflinStJeorBmr({ sex: ctx.sex, weightKg, heightCm, ageYears })
  if (bmr < MIN_PLAUSIBLE_BMR_KCAL) {
    return generalPlan(['Your height, weight and birth date give an unusual estimate, so general targets are shown — please check them.'])
  }

  const maintenanceKcal = roundKcal(maintenanceFromBmr(bmr, ctx.activityLevel))
  const adjustment = goalAdjustment({
    goal: ctx.goal,
    pace: ctx.pace,
    sex: ctx.sex,
    weightKg,
    targetWeightKg: ctx.targetWeightKg,
    maintenanceKcal,
  })
  const notes = [
    `Maintenance of about ${formatAmount(maintenanceKcal)} kcal/day is estimated with the Mifflin-St Jeor equation for a ${ACTIVITY_LABELS[ctx.activityLevel]} lifestyle (× ${ACTIVITY_FACTORS[ctx.activityLevel]}).`,
  ]
  if (ctx.sex === 'unspecified') notes.push('Sex isn’t specified, so the estimate averages the female and male equations.')

  return {
    mode: 'personalized',
    estimate: {
      method: 'mifflin_st_jeor',
      bmrKcal: roundKcal(bmr),
      maintenanceKcal,
      goalAdjustmentKcal: adjustment.adjustmentKcal,
    },
    energyKcal: maintenanceKcal + adjustment.adjustmentKcal,
    notes: [...notes, ...adjustment.notes],
  }
}
