import { compareDateKeys, isDateKey } from '@/domain/dates'
import { formatNumber } from '@/lib/format'
import { LIMITS, TEXT_LIMITS } from '@/schemas'
import type { WorkoutInput } from '@/stores/activityStore'
import type { Intensity, ScheduledWorkout, WorkoutEntry, WorkoutType } from '@/types'

export interface WorkoutFormValues {
  type: WorkoutType
  date: string
  durationMin: number | null
  intensity: Intensity
  /** kcal typed by the user; null = use the informational estimate. */
  kcal: number | null
  notes: string
}

export type WorkoutFormField = 'date' | 'durationMin' | 'kcal' | 'notes'
export type WorkoutFormErrors = Partial<Record<WorkoutFormField, string>>

/** What the workout sheet is doing. */
export type WorkoutSheetTarget =
  | { mode: 'log' }
  | { mode: 'edit'; workout: WorkoutEntry }
  | { mode: 'complete'; session: ScheduledWorkout }

const DEFAULT_INTENSITY: Intensity = 'moderate'

function earlierOf(date: string, today: string): string {
  return compareDateKeys(date, today) > 0 ? today : date
}

/** Initial form values: a new workout today, an existing workout, or a scheduled session to complete. */
export function initialWorkoutValues(target: WorkoutSheetTarget, today: string, preferredMinutes: number): WorkoutFormValues {
  switch (target.mode) {
    case 'log':
      return { type: 'strength', date: today, durationMin: preferredMinutes, intensity: DEFAULT_INTENSITY, kcal: null, notes: '' }
    case 'edit': {
      const { workout } = target
      return {
        type: workout.type,
        date: workout.date,
        durationMin: workout.durationMin,
        intensity: workout.intensity ?? DEFAULT_INTENSITY,
        kcal: workout.kcalSource === 'user' ? workout.estimatedKcal : null,
        notes: workout.notes ?? '',
      }
    }
    case 'complete': {
      const { session } = target
      return {
        type: session.type,
        date: earlierOf(session.date, today),
        durationMin: session.durationMin,
        intensity: session.intensity ?? DEFAULT_INTENSITY,
        kcal: null,
        notes: '',
      }
    }
  }
}

const { min: MIN_MINUTES, max: MAX_MINUTES } = LIMITS.workoutDurationMin
const { min: MIN_KCAL, max: MAX_KCAL } = LIMITS.workoutKcal

/** Field-level validation messages (empty object = valid). */
export function validateWorkoutForm(values: WorkoutFormValues, today: string): WorkoutFormErrors {
  const errors: WorkoutFormErrors = {}
  if (!isDateKey(values.date)) errors.date = 'Choose the day of your workout.'
  else if (compareDateKeys(values.date, today) > 0) errors.date = 'Choose today or an earlier date.'

  const minutes = values.durationMin
  if (minutes === null) errors.durationMin = 'Enter how many minutes you were active.'
  else if (!Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
    errors.durationMin = `Enter whole minutes between ${MIN_MINUTES} and ${MAX_MINUTES}.`
  }

  const kcal = values.kcal
  if (kcal !== null && (!Number.isFinite(kcal) || kcal < MIN_KCAL || kcal > MAX_KCAL)) {
    errors.kcal = `Enter ${MIN_KCAL}–${formatNumber(MAX_KCAL)} kcal, or leave it empty to use the estimate.`
  }

  if ([...values.notes.trim()].length > TEXT_LIMITS.workoutNotes) {
    errors.notes = `Keep notes to ${TEXT_LIMITS.workoutNotes} characters.`
  }
  return errors
}

export function hasErrors(errors: WorkoutFormErrors): boolean {
  return Object.keys(errors).length > 0
}

/** Store input from valid form values. */
export function toWorkoutInput(values: WorkoutFormValues, weightKg: number | null): WorkoutInput {
  return {
    date: values.date,
    type: values.type,
    durationMin: values.durationMin ?? 0,
    intensity: values.intensity,
    kcal: values.kcal === null ? null : Math.round(values.kcal),
    notes: values.notes.trim() === '' ? null : values.notes.trim(),
    weightKg,
  }
}
