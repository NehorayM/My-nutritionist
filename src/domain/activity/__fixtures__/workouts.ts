import type { Intensity, ScheduledWorkout, WorkoutEntry, WorkoutType } from '@/types'
import { planCatchUp } from '../catchUp'
import type { CatchUpInput } from '../catchUp'
import { computeWeeklyProgress } from '../progress'
import type { WeeklyPlan } from '../progress'
import type { CatchUpPlan, CatchUpSuggestion, WeeklyActivityProgress } from '../types'

let counter = 0

/** A logged workout on a local date (moderate, 40 min unless overridden). Ids are unique per call. */
export function workout(
  date: string,
  type: WorkoutType,
  overrides: Partial<WorkoutEntry> = {},
): WorkoutEntry {
  counter += 1
  const stamp = `${date}T08:00:00.000Z`
  return {
    id: `wk-${date}-${type}-${counter}`,
    userId: 'user-1',
    date,
    type,
    durationMin: 40,
    intensity: 'moderate',
    estimatedKcal: null,
    kcalSource: null,
    notes: null,
    scheduledWorkoutId: null,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  }
}

/** Shorthand for a logged session with a given intensity. */
export function session(date: string, type: WorkoutType, intensity: Intensity, durationMin = 40): WorkoutEntry {
  return workout(date, type, { intensity, durationMin })
}

/** A scheduled session (planned, catch-up source, 40 min moderate unless overridden). */
export function scheduledSession(
  date: string,
  type: WorkoutType,
  overrides: Partial<ScheduledWorkout> = {},
): ScheduledWorkout {
  const stamp = `${date}T06:00:00.000Z`
  return {
    id: `sch-${date}-${type}`,
    userId: 'user-1',
    date,
    type,
    durationMin: 40,
    intensity: 'moderate',
    status: 'planned',
    source: 'catch_up',
    rationale: null,
    completedWorkoutId: null,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  }
}

export function plan(strengthSessionsPerWeek: number, cardioSessionsPerWeek: number): WeeklyPlan {
  return { strengthSessionsPerWeek, cardioSessionsPerWeek }
}

/** Weekly progress for a Monday-start week. */
export function progressFor(
  today: string,
  weeklyPlan: WeeklyPlan,
  workouts: readonly WorkoutEntry[] = [],
  weekStartsOn: 0 | 1 = 1,
): WeeklyActivityProgress {
  return computeWeeklyProgress({ workouts, plan: weeklyPlan, today, weekStartsOn })
}

/** Smart Catch-Up for a Monday-start week with 40-minute preferred sessions unless overridden. */
export function catchUpFor(
  today: string,
  weeklyPlan: WeeklyPlan,
  workouts: readonly WorkoutEntry[] = [],
  overrides: Partial<Omit<CatchUpInput, 'progress'>> = {},
): CatchUpPlan {
  return planCatchUp({
    progress: progressFor(today, weeklyPlan, workouts),
    recentWorkouts: workouts,
    scheduled: [],
    preferredMinutes: 40,
    dismissedIds: [],
    variant: 0,
    ...overrides,
  })
}

/** Every complete option of a plan: the primary suggestions followed by the alternatives. */
export function allOptions(result: CatchUpPlan): CatchUpSuggestion[][] {
  return [result.suggestions, ...result.alternatives].filter((option) => option.length > 0)
}

/** Words that must never appear in catch-up copy (food, calories, judgemental framing). */
export const FORBIDDEN_COPY =
  /\b(food|meal|eat|eating|calorie|calories|kcal|diet|burn|earn|cheat|bad|failure|fail|guilt|compensate|make up|punish)\b/i
