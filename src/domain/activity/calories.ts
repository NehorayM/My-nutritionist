import { INTENSITIES, WORKOUT_TYPES } from '@/types'
import type { Intensity, WorkoutType } from '@/types'
import {
  DEFAULT_ESTIMATE_INTENSITY,
  KCAL_ROUNDING_STEP,
  MAX_BODY_WEIGHT_KG,
  MAX_WORKOUT_MINUTES,
  MET_TABLE,
  MIN_BODY_WEIGHT_KG,
  MIN_WORKOUT_MINUTES,
} from './constants'
import type { MetReference } from './constants'

export interface WorkoutKcalInput {
  type: WorkoutType
  /** Self-reported effort; `null` is estimated as moderate. */
  intensity: Intensity | null
  durationMin: number
  /** Body weight in kg; `null` when unknown. */
  weightKg: number | null
}

function isWorkoutType(value: string): value is WorkoutType {
  return (WORKOUT_TYPES as readonly string[]).includes(value)
}

function isIntensity(value: string): value is Intensity {
  return (INTENSITIES as readonly string[]).includes(value)
}

function inRange(value: number | null, min: number, max: number): value is number {
  return value !== null && Number.isFinite(value) && value >= min && value <= max
}

/**
 * Compendium MET reference used for a workout type and intensity (missing intensity → moderate).
 * Returns null for values outside the known type/intensity lists (e.g. corrupted stored data).
 */
export function metReferenceFor(type: WorkoutType, intensity: Intensity | null): MetReference | null {
  const effort = intensity ?? DEFAULT_ESTIMATE_INTENSITY
  if (!isWorkoutType(type) || !isIntensity(effort)) return null
  return MET_TABLE[type][effort]
}

/**
 * Rough energy cost of a workout: kcal = MET × body weight (kg) × duration (h), rounded to the nearest 5 kcal,
 * using MET values from the 2024 Adult Compendium of Physical Activities (see `MET_TABLE`).
 *
 * INFORMATIONAL ONLY. The estimate is shown next to the workout for interest; it is never added to,
 * subtracted from or otherwise used to adjust daily food or nutrient targets.
 *
 * Returns null when the weight is unknown or any input is invalid: weight outside 20–400 kg, duration outside
 * 1–600 minutes, a non-finite number, or an unknown type/intensity.
 */
export function estimateWorkoutKcal(input: WorkoutKcalInput): number | null {
  const { type, intensity, durationMin, weightKg } = input
  if (!inRange(weightKg, MIN_BODY_WEIGHT_KG, MAX_BODY_WEIGHT_KG)) return null
  if (!inRange(durationMin, MIN_WORKOUT_MINUTES, MAX_WORKOUT_MINUTES)) return null
  const reference = metReferenceFor(type, intensity)
  if (!reference) return null
  const kcal = reference.met * weightKg * (durationMin / 60)
  return Math.round(kcal / KCAL_ROUNDING_STEP) * KCAL_ROUNDING_STEP
}
