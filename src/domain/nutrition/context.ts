import type { ActivityLevel, DietType, GoalPace, Sex, WellnessGoal } from '@/types'
import { ADULT_AGE, profileAge } from '../profile'
import { isDateKey } from '../dates'
import { PLAUSIBLE_INPUTS } from './constants'
import { ageBandFor, type AgeBand } from './dri'
import type { DailyTargetsInput } from './types'

export type MissingField = 'birth date' | 'height' | 'weight'

/** Normalized, validated inputs of the Daily Target Engine. */
export interface TargetContext {
  /** Whole years on `date`; null when unknown or implausible. */
  ageYears: number | null
  minor: boolean
  ageBand: AgeBand
  sex: Sex
  weightKg: number | null
  heightCm: number | null
  targetWeightKg: number | null
  activityLevel: ActivityLevel
  goal: WellnessGoal
  pace: GoalPace
  /** Diet the user chose. */
  requestedDiet: DietType
  /** Diet the targets follow (keto is not applied to under-18s → balanced). */
  diet: DietType
  /** Profile values needed for personalized energy that are missing or implausible. */
  missing: MissingField[]
}

function inRange(value: number | null | undefined, range: { min: number; max: number }): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return value >= range.min && value <= range.max ? value : null
}

function resolveAge(birthDate: string | null, date: string): number | null {
  if (!isDateKey(date)) throw new RangeError(`Invalid target date: ${date}`)
  return inRange(profileAge({ birthDate }, date), PLAUSIBLE_INPUTS.ageYears)
}

/**
 * Validate and normalize the profile for target calculation. Implausible values (outside database
 * bounds, or a birth date after `date`) are treated as missing rather than trusted.
 * Weight: the latest weigh-in, falling back to the profile weight when there is none (or it is implausible).
 */
export function resolveTargetContext({ profile, date, latestWeightKg }: DailyTargetsInput): TargetContext {
  const ageYears = resolveAge(profile?.birthDate ?? null, date)
  const minor = ageYears !== null && ageYears < ADULT_AGE
  const weightKg =
    inRange(latestWeightKg, PLAUSIBLE_INPUTS.weightKg) ?? inRange(profile?.currentWeightKg, PLAUSIBLE_INPUTS.weightKg)
  const heightCm = inRange(profile?.heightCm, PLAUSIBLE_INPUTS.heightCm)
  const requestedDiet = profile?.dietType ?? 'balanced'

  const missing: MissingField[] = []
  if (ageYears === null) missing.push('birth date')
  if (heightCm === null) missing.push('height')
  if (weightKg === null) missing.push('weight')

  return {
    ageYears,
    minor,
    ageBand: ageBandFor(ageYears),
    sex: profile?.sex ?? 'unspecified',
    weightKg,
    heightCm,
    targetWeightKg: inRange(profile?.targetWeightKg, PLAUSIBLE_INPUTS.weightKg),
    activityLevel: profile?.activityLevel ?? 'light',
    goal: profile?.goal ?? 'general_wellness',
    pace: profile?.goalPace ?? 'gentle',
    requestedDiet,
    diet: minor && requestedDiet === 'keto' ? 'balanced' : requestedDiet,
    missing,
  }
}
