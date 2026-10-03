export const WORKOUT_TYPES = [
  'strength',
  'cardio',
  'hiit',
  'walk',
  'run',
  'cycling',
  'swimming',
  'mobility',
  'sports',
  'other',
] as const
export type WorkoutType = (typeof WORKOUT_TYPES)[number]

export const INTENSITIES = ['light', 'moderate', 'vigorous'] as const
export type Intensity = (typeof INTENSITIES)[number]

/** Weekly plan categories that the profile sets targets for. */
export const ACTIVITY_CATEGORIES = ['strength', 'cardio'] as const
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]

export interface WorkoutEntry {
  id: string
  userId: string
  /** Local calendar date YYYY-MM-DD. */
  date: string
  type: WorkoutType
  durationMin: number
  intensity: Intensity | null
  /** Informational estimate only; never used to adjust food targets. */
  estimatedKcal: number | null
  /** Whether estimatedKcal was typed by the user or estimated by the app. */
  kcalSource: 'user' | 'estimate' | null
  notes: string | null
  /** Set when this workout completed a scheduled (e.g. catch-up) session. */
  scheduledWorkoutId: string | null
  createdAt: string
  updatedAt: string
}

export const SCHEDULED_STATUSES = ['planned', 'completed', 'dismissed'] as const
export type ScheduledStatus = (typeof SCHEDULED_STATUSES)[number]

export interface ScheduledWorkout {
  id: string
  userId: string
  date: string
  type: WorkoutType
  durationMin: number
  intensity: Intensity | null
  status: ScheduledStatus
  source: 'catch_up' | 'manual'
  rationale: string | null
  completedWorkoutId: string | null
  createdAt: string
  updatedAt: string
}
