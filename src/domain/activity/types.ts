import type { ActivityCategory, Intensity, WorkoutEntry, WorkoutType } from '@/types'

export interface WeekWindow {
  /** First local date of the week (YYYY-MM-DD). */
  start: string
  /** Last local date of the week (inclusive). */
  end: string
  today: string
  /** Days before today in this week (0 on the first day). */
  daysElapsed: number
  /** Days left INCLUDING today (7 on the first day, 1 on the last day). */
  daysRemaining: number
}

export interface CategoryProgress {
  category: ActivityCategory
  planned: number
  completed: number
  /** max(0, planned − completed). */
  remaining: number
  /** completed / planned clamped to [0, 1]; 1 when planned is 0. */
  percent: number
}

/**
 * no_plan:  no weekly targets configured
 * complete: all planned sessions done (or exceeded)
 * on_track: completed ≥ expected share for elapsed days
 * behind:   completed < expected share, but remaining days can fit the rest safely
 * at_risk:  remaining sessions exceed what can be scheduled safely this week
 */
export type AdherenceStatus = 'no_plan' | 'complete' | 'on_track' | 'behind' | 'at_risk'

export interface WeeklyActivityProgress {
  week: WeekWindow
  categories: CategoryProgress[]
  totalPlanned: number
  totalCompleted: number
  totalRemaining: number
  /** totalCompleted / totalPlanned clamped to [0, 1]; 1 when nothing planned. */
  percent: number
  adherence: AdherenceStatus
  /** Total minutes per workout type this week. */
  minutesByType: Partial<Record<WorkoutType, number>>
  totalMinutes: number
  /** Workouts that fall inside the week, sorted by date. */
  workouts: WorkoutEntry[]
}

export interface CatchUpSuggestion {
  /** Deterministic id (date + type + duration). */
  id: string
  date: string
  type: WorkoutType
  category: ActivityCategory
  durationMin: number
  intensity: Intensity
  rationale: string
}

export type CatchUpStatus = 'no_plan' | 'complete' | 'on_track' | 'catch_up' | 'limited'

export interface CatchUpPlan {
  status: CatchUpStatus
  /** Neutral, supportive summary. */
  message: string
  /** Primary option: one suggestion per remaining session that fits safely. */
  suggestions: CatchUpSuggestion[]
  /** Alternative full options for "View another option". */
  alternatives: CatchUpSuggestion[][]
  /** Planned sessions that cannot fit safely this week (never stacked unsafely). */
  deferredSessions: number
}
