import type { Intensity, ScheduledStatus, ScheduledWorkout, WeightEntry, WeightUnit, WorkoutEntry, WorkoutType } from '@/types'
import { scheduledWorkoutSchema, weightEntrySchema, workoutEntrySchema } from '@/schemas'
import { asRow, numeric, parseMapped } from './shared'

/** `public.weight_logs` row (`measured_on` = local date, `measured_at` = instant). */
export interface WeightLogRow {
  id: string
  user_id: string
  measured_on: string
  measured_at: string
  weight_kg: number
  input_unit: WeightUnit
  note: string | null
  created_at: string
  updated_at: string
}

export function weightEntryToRow(entry: WeightEntry): WeightLogRow {
  return {
    id: entry.id,
    user_id: entry.userId,
    measured_on: entry.date,
    measured_at: entry.measuredAt,
    weight_kg: entry.weightKg,
    input_unit: entry.inputUnit,
    note: entry.note,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  }
}

export function weightEntryFromRow(value: unknown): WeightEntry | null {
  const row = asRow(value)
  if (!row) return null
  return parseMapped(weightEntrySchema, {
    id: row.id,
    userId: row.user_id,
    date: row.measured_on,
    measuredAt: row.measured_at,
    weightKg: numeric(row.weight_kg),
    inputUnit: row.input_unit,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

/** `public.workout_logs` row. */
export interface WorkoutLogRow {
  id: string
  user_id: string
  workout_date: string
  type: WorkoutType
  duration_min: number
  intensity: Intensity | null
  estimated_kcal: number | null
  kcal_source: 'user' | 'estimate' | null
  notes: string | null
  scheduled_workout_id: string | null
  created_at: string
  updated_at: string
}

export function workoutEntryToRow(entry: WorkoutEntry): WorkoutLogRow {
  return {
    id: entry.id,
    user_id: entry.userId,
    workout_date: entry.date,
    type: entry.type,
    duration_min: entry.durationMin,
    intensity: entry.intensity,
    estimated_kcal: entry.estimatedKcal,
    kcal_source: entry.kcalSource,
    notes: entry.notes,
    scheduled_workout_id: entry.scheduledWorkoutId,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  }
}

export function workoutEntryFromRow(value: unknown): WorkoutEntry | null {
  const row = asRow(value)
  if (!row) return null
  return parseMapped(workoutEntrySchema, {
    id: row.id,
    userId: row.user_id,
    date: row.workout_date,
    type: row.type,
    durationMin: numeric(row.duration_min),
    intensity: row.intensity,
    estimatedKcal: numeric(row.estimated_kcal),
    kcalSource: row.kcal_source,
    notes: row.notes,
    scheduledWorkoutId: row.scheduled_workout_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

/** `public.scheduled_workouts` row. */
export interface ScheduledWorkoutRow {
  id: string
  user_id: string
  scheduled_date: string
  type: WorkoutType
  duration_min: number
  intensity: Intensity | null
  status: ScheduledStatus
  source: 'catch_up' | 'manual'
  rationale: string | null
  completed_workout_id: string | null
  created_at: string
  updated_at: string
}

export function scheduledWorkoutToRow(entry: ScheduledWorkout): ScheduledWorkoutRow {
  return {
    id: entry.id,
    user_id: entry.userId,
    scheduled_date: entry.date,
    type: entry.type,
    duration_min: entry.durationMin,
    intensity: entry.intensity,
    status: entry.status,
    source: entry.source,
    rationale: entry.rationale,
    completed_workout_id: entry.completedWorkoutId,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  }
}

export function scheduledWorkoutFromRow(value: unknown): ScheduledWorkout | null {
  const row = asRow(value)
  if (!row) return null
  return parseMapped(scheduledWorkoutSchema, {
    id: row.id,
    userId: row.user_id,
    date: row.scheduled_date,
    type: row.type,
    durationMin: numeric(row.duration_min),
    intensity: row.intensity,
    status: row.status,
    source: row.source,
    rationale: row.rationale,
    completedWorkoutId: row.completed_workout_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}
