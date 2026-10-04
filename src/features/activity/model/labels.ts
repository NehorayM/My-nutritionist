import { countsToward, WALK_MIN_COUNTED_MINUTES, type AdherenceStatus, type CatchUpStatus } from '@/domain/activity'
import { dateKeyToLocalDate, isDateKey } from '@/domain/dates'
import { formatKcal } from '@/lib/format'
import type { Tone } from '@/components/ui'
import type { ActivityCategory, Intensity, WorkoutEntry, WorkoutType } from '@/types'

/** Presentation copy for the Activity tab. Neutral and supportive; activity is never tied to food. */
export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  hiit: 'HIIT',
  walk: 'Walk',
  run: 'Run',
  cycling: 'Cycling',
  swimming: 'Swimming',
  mobility: 'Mobility',
  sports: 'Sports',
  other: 'Other',
}

export const INTENSITY_LABELS: Record<Intensity, string> = {
  light: 'Light',
  moderate: 'Moderate',
  vigorous: 'Vigorous',
}

export const CATEGORY_LABELS: Record<ActivityCategory, string> = { strength: 'Strength', cardio: 'Cardio' }
export const CATEGORY_TONES: Record<ActivityCategory, Tone> = { strength: 'primary', cardio: 'accent' }

export const ADHERENCE_COPY: Record<AdherenceStatus, string> = {
  no_plan: 'No sessions planned yet. Set a weekly plan to follow your progress.',
  complete: 'Your plan for this week is complete. Nice consistency!',
  on_track: "You're on track with your plan this week.",
  behind: "There's still room this week for your remaining sessions.",
  at_risk: 'A busy week. Every session still counts, and rest days are part of the plan.',
}

export const CATCH_UP_BADGES: Record<CatchUpStatus, { label: string; tone: Tone }> = {
  no_plan: { label: 'No plan yet', tone: 'neutral' },
  complete: { label: 'All done', tone: 'success' },
  on_track: { label: 'On track', tone: 'success' },
  catch_up: { label: 'Suggestions', tone: 'accent' },
  limited: { label: 'Busy week', tone: 'info' },
}

export const NO_PLAN_MESSAGE = 'No strength or cardio sessions are planned for this week. Set a weekly plan to see suggestions.'

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const dayOnly = new Intl.DateTimeFormat('en-US', { day: 'numeric' })

/** "Oct 5 – 11" or "Sep 28 – Oct 4". */
export function formatWeekRange(start: string, end: string): string {
  if (!isDateKey(start) || !isDateKey(end)) return ''
  const first = monthDay.format(dateKeyToLocalDate(start))
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  return `${first} – ${(sameMonth ? dayOnly : monthDay).format(dateKeyToLocalDate(end))}`
}

/** "3 days left this week, including today" / "Today is the last day of the week". */
export function daysLeftText(daysRemaining: number): string {
  return daysRemaining <= 1 ? 'Today is the last day of the week' : `${daysRemaining} days left this week, including today`
}

/** What a workout of this type and length counts toward in the weekly plan. */
export function countsTowardText(type: WorkoutType, durationMin: number | null): string {
  const category = countsToward({ type, durationMin: durationMin ?? 0 })
  if (category) return `Counts toward your ${category} sessions.`
  if (type === 'walk') return `Walks of ${WALK_MIN_COUNTED_MINUTES} minutes or more count toward cardio.`
  return 'Adds to your weekly active minutes.'
}

export function workoutCategory(workout: Pick<WorkoutEntry, 'type' | 'durationMin'>): ActivityCategory | null {
  return countsToward(workout)
}

/** Informational energy line for a logged workout ("≈ 325 kcal · estimate"), or null when unknown. */
export function workoutKcalText(workout: Pick<WorkoutEntry, 'estimatedKcal' | 'kcalSource'>): string | null {
  if (workout.estimatedKcal === null) return null
  return workout.kcalSource === 'user'
    ? `${formatKcal(workout.estimatedKcal)} · entered`
    : `≈ ${formatKcal(workout.estimatedKcal)} · estimate`
}
