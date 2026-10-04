import { compareDateKeys } from '@/domain/dates'
import type { ActivityCategory, ScheduledWorkout, WorkoutEntry } from '@/types'
import { buildCatchUpOptions } from './catchUpOptions'
import { catchUpMessage } from './catchUpText'
import { cardioChoices } from './cardioPreference'
import {
  CATCH_UP_MAX_MINUTES,
  CATCH_UP_MIN_MINUTES,
  CATCH_UP_MINUTES_STEP,
  DEFAULT_PREFERRED_MINUTES,
  FULL_BODY_MAX_STRENGTH_PER_WEEK,
  MAX_CATCH_UP_ALTERNATIVES,
  SHORTER_SESSION_FACTOR,
} from './constants'
import { countsToward, expectedSessions, isUsableWorkout } from './progress'
import { candidateDays, maxPlaceable } from './schedule'
import type { CatchUpPlan, CatchUpStatus, WeekWindow, WeeklyActivityProgress } from './types'
import { isInWeek } from './week'

export interface CatchUpInput {
  /** This week's progress (from `computeWeeklyProgress`); its `week.today` is the planning day. */
  progress: WeeklyActivityProgress
  /** Logged workouts from about the last 14 days; may include the previous week (recovery spacing, cardio preference). */
  recentWorkouts: readonly WorkoutEntry[]
  /** Scheduled sessions. Only `planned` ones from today to the end of the week count; they occupy their day. */
  scheduled: readonly ScheduledWorkout[]
  /** Preferred session length in minutes; clamped to 20–60 (null → 40). */
  preferredMinutes: number | null
  /** Suggestion ids the user dismissed; they never appear in any option. */
  dismissedIds: Iterable<string>
  /** "View another option" counter; option order rotates deterministically with it. */
  variant: number
}

/** Catch-up session length: the preferred minutes rounded to 5 and clamped to 20–60 (no extra-long make-up sessions). */
export function catchUpMinutes(preferred: number | null): number {
  const base = preferred !== null && Number.isFinite(preferred) ? preferred : DEFAULT_PREFERRED_MINUTES
  const stepped = Math.round(base / CATCH_UP_MINUTES_STEP) * CATCH_UP_MINUTES_STEP
  return Math.min(CATCH_UP_MAX_MINUTES, Math.max(CATCH_UP_MIN_MINUTES, stepped))
}

/** Logged workouts from both inputs, deduplicated by id. */
function mergeLogged(progress: WeeklyActivityProgress, recent: readonly WorkoutEntry[]): WorkoutEntry[] {
  const byId = new Map<string, WorkoutEntry>()
  for (const workout of [...recent, ...progress.workouts]) if (isUsableWorkout(workout)) byId.set(workout.id, workout)
  return [...byId.values()]
}

/**
 * Scheduled sessions that still count as planned: status `planned`, dated from today to the end of the week, and not
 * already linked to a logged workout (a session missed earlier in the week no longer holds its slot).
 */
function openScheduled(scheduled: readonly ScheduledWorkout[], logged: readonly WorkoutEntry[], week: WeekWindow): ScheduledWorkout[] {
  const linked = new Set(logged.map((workout) => workout.scheduledWorkoutId))
  return scheduled.filter(
    (session) =>
      session.status === 'planned' &&
      session.completedWorkoutId === null &&
      !linked.has(session.id) &&
      isUsableWorkout(session) &&
      isInWeek(session.date, week) &&
      compareDateKeys(session.date, week.today) >= 0,
  )
}

function sessionsToPlace(progress: WeeklyActivityProgress, open: readonly ScheduledWorkout[]): Record<ActivityCategory, number> {
  const need: Record<ActivityCategory, number> = { strength: 0, cardio: 0 }
  for (const entry of progress.categories) need[entry.category] = entry.remaining
  for (const session of open) {
    const category = countsToward(session)
    if (category) need[category] = Math.max(0, need[category] - 1)
  }
  return need
}

function rotate<T>(items: readonly T[], variant: number): T[] {
  const step = Number.isFinite(variant) ? Math.trunc(variant) : 0
  const start = items.length === 0 ? 0 : ((step % items.length) + items.length) % items.length
  return [...items.slice(start), ...items.slice(0, start)]
}

function emptyPlan(status: CatchUpStatus): CatchUpPlan {
  const message = catchUpMessage(status, { needed: 0, placed: 0, deferred: 0, shown: 0, freeDays: 0 })
  return { status, message, suggestions: [], alternatives: [], deferredSessions: 0 }
}

/**
 * Smart Catch-Up: one way (plus up to two alternatives) to fit the planned sessions still open this week.
 *
 * Rules: candidate days run from today (tomorrow when something is already logged or planned today) to the end of
 * the week, skipping days that already hold a session; at most one suggestion per day; no strength session within
 * 48 h of a strength or vigorous/HIIT session (including last week's and planned ones); suggestions are never
 * vigorous, so hard days are never stacked, and cardio after a hard day is light; durations are the preferred
 * length clamped to 20–60 minutes; categories alternate when both remain. Sessions that do not fit safely become
 * `deferredSessions` — never squeezed onto the same day or lengthened.
 *
 * Status:
 * - no_plan:  no sessions planned this week;
 * - complete: every planned session is logged;
 * - limited:  some open sessions cannot fit safely in the days left (`deferredSessions > 0`);
 * - on_track: everything fits, and either every open session is already scheduled or the sessions logged so far meet
 *             the even-pace share for the week, floor(planned × daysIncludingToday / 7);
 * - catch_up: everything fits, but the sessions logged so far are below that share.
 */
export function planCatchUp(input: CatchUpInput): CatchUpPlan {
  const { progress } = input
  const { week } = progress
  if (progress.totalPlanned === 0) return emptyPlan('no_plan')
  if (progress.totalRemaining === 0) return emptyPlan('complete')

  const logged = mergeLogged(progress, input.recentWorkouts)
  const open = openScheduled(input.scheduled, logged, week)
  const need = sessionsToPlace(progress, open)
  const needed = need.strength + need.cardio
  if (needed === 0) return emptyPlan('on_track')

  const fixed = [...logged, ...open]
  const days = candidateDays(week.today, week.end, new Set(fixed.map((session) => session.date)))
  const placed = maxPlaceable({ days, need, fixed })
  const durationMin = catchUpMinutes(input.preferredMinutes)
  const cardio = cardioChoices(logged, week.today)
  const fullBody = !progress.categories.some(
    (entry) => entry.category === 'strength' && entry.planned > FULL_BODY_MAX_STRENGTH_PER_WEEK,
  )
  const { options } = buildCatchUpOptions(
    {
      days,
      need,
      fixed,
      dismissed: new Set(input.dismissedIds),
      text: {
        today: week.today,
        weekStart: week.start,
        remaining: needed,
        fullBody,
      },
    },
    {
      preferredCardio: cardio.preferred,
      variantCardio: cardio.variant,
      durationMin,
      shorterMin: catchUpMinutes(durationMin * SHORTER_SESSION_FACTOR),
    },
  )

  const deferredSessions = needed - placed
  const credited = progress.totalPlanned - progress.totalRemaining
  const onPace = credited >= expectedSessions(progress.totalPlanned, week.daysElapsed)
  const status: CatchUpStatus = deferredSessions > 0 ? 'limited' : onPace ? 'on_track' : 'catch_up'
  const [suggestions = [], ...others] = rotate(options, input.variant)
  return {
    status,
    message: catchUpMessage(status, { needed, placed, deferred: deferredSessions, shown: suggestions.length, freeDays: days.length }),
    suggestions,
    alternatives: others.slice(0, MAX_CATCH_UP_ALTERNATIVES),
    deferredSessions,
  }
}
