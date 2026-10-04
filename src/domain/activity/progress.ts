import { compareDateKeys, isDateKey } from '@/domain/dates'
import { ACTIVITY_CATEGORIES } from '@/types'
import type { ActivityCategory, WorkoutEntry, WorkoutType } from '@/types'
import { DAYS_PER_WEEK, MAX_PLANNED_PER_CATEGORY, WALK_MIN_COUNTED_MINUTES, WORKOUT_CATEGORY } from './constants'
import { candidateDays, maxPlaceable } from './schedule'
import type { AdherenceStatus, CategoryProgress, WeekWindow, WeeklyActivityProgress } from './types'
import { getWeekWindow, isInWeek } from './week'

export interface WeeklyPlan {
  strengthSessionsPerWeek: number
  cardioSessionsPerWeek: number
}

export interface WeeklyProgressInput {
  /** Any workouts; only those inside the current week are counted. */
  workouts: readonly WorkoutEntry[]
  /** The CURRENT plan — changing it midweek simply recomputes progress against the new numbers. */
  plan: WeeklyPlan
  today: string
  weekStartsOn: 0 | 1
}

/**
 * Plan category of a workout type (see `WORKOUT_CATEGORY`): strength → strength; cardio, hiit, run, cycling,
 * swimming and walk → cardio; mobility, sports and other → null (they count toward weekly minutes only).
 * Walks additionally need a minimum duration to count — use `countsToward` for logged sessions.
 */
export function categoryOf(type: WorkoutType): ActivityCategory | null {
  return WORKOUT_CATEGORY[type] ?? null
}

/** Category a session counts toward: like `categoryOf`, but a walk counts only when it lasts ≥ 20 minutes. */
export function countsToward(workout: Pick<WorkoutEntry, 'type' | 'durationMin'>): ActivityCategory | null {
  if (workout.type === 'walk' && !(workout.durationMin >= WALK_MIN_COUNTED_MINUTES)) return null
  return categoryOf(workout.type)
}

/** A workout with a real date and a positive, finite duration. */
export function isUsableWorkout(workout: Pick<WorkoutEntry, 'date' | 'durationMin'>): boolean {
  return isDateKey(workout.date) && Number.isFinite(workout.durationMin) && workout.durationMin > 0
}

function compareText(a: string, b: string): number {
  return Number(a > b) - Number(a < b)
}

/** Stable order: date, then creation time, then id. */
export function compareWorkouts(a: WorkoutEntry, b: WorkoutEntry): number {
  return compareDateKeys(a.date, b.date) || compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id)
}

function plannedCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(MAX_PLANNED_PER_CATEGORY, Math.max(0, Math.floor(value)))
}

function categoryProgress(category: ActivityCategory, planned: number, workouts: readonly WorkoutEntry[]): CategoryProgress {
  const completed = workouts.filter((workout) => countsToward(workout) === category).length
  return {
    category,
    planned,
    completed,
    remaining: Math.max(0, planned - completed),
    percent: planned === 0 ? 1 : Math.min(1, completed / planned),
  }
}

/**
 * Sessions expected by the end of today when the plan is spread evenly over the week:
 * floor(planned × daysIncludingToday / 7). `daysElapsed` is the number of days before today in the week.
 */
export function expectedSessions(planned: number, daysElapsed: number): number {
  return Math.floor((planned * (daysElapsed + 1)) / DAYS_PER_WEEK)
}

/** Whether the remaining sessions fit the free days left this week under the recovery rules. */
function remainingFitsSafely(
  week: WeekWindow,
  categories: readonly CategoryProgress[],
  workouts: readonly WorkoutEntry[],
): boolean {
  const need = { strength: 0, cardio: 0 }
  for (const entry of categories) need[entry.category] = entry.remaining
  const days = candidateDays(week.today, week.end, new Set(workouts.map((workout) => workout.date)))
  return maxPlaceable({ days, need, fixed: workouts }) >= need.strength + need.cardio
}

/**
 * Adherence to the user's own plan:
 * - no_plan:  nothing planned;
 * - complete: every category reached its planned count;
 * - on_track: sessions credited toward the plan ≥ floor(planned × daysIncludingToday / 7);
 * - behind:   below that share, but the remaining sessions fit the free days left under the recovery rules;
 * - at_risk:  below that share, and the remaining sessions no longer fit safely this week.
 */
function adherenceOf(
  week: WeekWindow,
  categories: readonly CategoryProgress[],
  totals: { planned: number; remaining: number },
  workouts: readonly WorkoutEntry[],
): AdherenceStatus {
  if (totals.planned === 0) return 'no_plan'
  if (totals.remaining === 0) return 'complete'
  if (totals.planned - totals.remaining >= expectedSessions(totals.planned, week.daysElapsed)) return 'on_track'
  return remainingFitsSafely(week, categories, workouts) ? 'behind' : 'at_risk'
}

/**
 * Weekly progress against the plan. Counted sessions are those inside the week with a plan category (walks ≥ 20 min);
 * all usable workouts in the week add to minutes. `percent` and `totalRemaining` credit each category only up to its
 * planned count, so extra sessions in one category never hide sessions still open in the other; `totalCompleted`
 * is the raw number of counted sessions (it can exceed `totalPlanned`).
 */
export function computeWeeklyProgress(input: WeeklyProgressInput): WeeklyActivityProgress {
  const week = getWeekWindow(input.today, input.weekStartsOn)
  const usable = input.workouts.filter(isUsableWorkout)
  const workouts = usable.filter((workout) => isInWeek(workout.date, week)).sort(compareWorkouts)
  const planned: Record<ActivityCategory, number> = {
    strength: plannedCount(input.plan.strengthSessionsPerWeek),
    cardio: plannedCount(input.plan.cardioSessionsPerWeek),
  }
  const categories = ACTIVITY_CATEGORIES.map((category) => categoryProgress(category, planned[category], workouts))
  const totalPlanned = planned.strength + planned.cardio
  const totalRemaining = categories.reduce((sum, entry) => sum + entry.remaining, 0)
  const minutesByType: Partial<Record<WorkoutType, number>> = {}
  for (const workout of workouts) minutesByType[workout.type] = (minutesByType[workout.type] ?? 0) + workout.durationMin

  return {
    week,
    categories,
    totalPlanned,
    totalCompleted: categories.reduce((sum, entry) => sum + entry.completed, 0),
    totalRemaining,
    percent: totalPlanned === 0 ? 1 : (totalPlanned - totalRemaining) / totalPlanned,
    adherence: adherenceOf(week, categories, { planned: totalPlanned, remaining: totalRemaining }, usable),
    minutesByType,
    totalMinutes: workouts.reduce((sum, workout) => sum + workout.durationMin, 0),
    workouts,
  }
}
