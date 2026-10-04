import type { ActivityCategory, Intensity, WorkoutType } from '@/types'

export interface MetReference {
  /** Metabolic equivalent of task (1 MET ≈ 1 kcal · kg⁻¹ · h⁻¹). */
  met: number
  /** 2024 Adult Compendium specific activity code. */
  code: string
  /** Compendium activity description (abridged). */
  activity: string
}

/**
 * Representative MET values per workout type and self-reported intensity, taken from the
 * 2024 Adult Compendium of Physical Activities — Herrmann SD, Willis EA, Ainsworth BE, et al.
 * J Sport Health Sci 2024;13(1):6–12. doi:10.1016/j.jshs.2023.10.010 (PMID 38242596),
 * activity tables at https://pacompendium.com (retrieved 2026-10-03).
 *
 * The app's workout types are broad, so each cell is the compendium entry that best matches a typical
 * session at that effort; values increase monotonically from light to vigorous within each type.
 */
export const MET_TABLE: Record<WorkoutType, Record<Intensity, MetReference>> = {
  strength: {
    light: { met: 3.5, code: '02054', activity: 'Resistance training, multiple exercises, 8-15 reps, varied resistance' },
    moderate: { met: 5.0, code: '02052', activity: 'Resistance training, squats, deadlift, slow or explosive effort' },
    vigorous: { met: 6.0, code: '02050', activity: 'Resistance training, power lifting or body building, vigorous' },
  },
  cardio: {
    light: { met: 4.0, code: '01214', activity: 'Bicycling, stationary, 50 watts, light effort' },
    moderate: { met: 5.0, code: '02048', activity: 'Elliptical trainer, moderate effort' },
    vigorous: { met: 9.0, code: '02049', activity: 'Elliptical trainer, vigorous effort' },
  },
  hiit: {
    light: { met: 3.5, code: '02034', activity: 'Circuit training, light effort' },
    moderate: { met: 7.0, code: '02210', activity: 'High intensity interval exercise, moderate effort' },
    vigorous: { met: 11.0, code: '02214', activity: 'High intensity interval exercise, Tabata, vigorous effort' },
  },
  walk: {
    light: { met: 3.0, code: '17170', activity: 'Walking, 2.5 mph, firm, level surface' },
    moderate: { met: 4.8, code: '17200', activity: 'Walking, 3.5-3.9 mph, level, brisk, walking for exercise' },
    vigorous: { met: 5.5, code: '17220', activity: 'Walking, 4.0-4.4 mph, level, very brisk pace' },
  },
  run: {
    light: { met: 6.5, code: '12028', activity: 'Running, 4-4.2 mph (13 min/mile)' },
    moderate: { met: 9.3, code: '12050', activity: 'Running, 6-6.3 mph (10 min/mile)' },
    vigorous: { met: 11.0, code: '12070', activity: 'Running, 7 mph (8.5 min/mile)' },
  },
  cycling: {
    light: { met: 4.0, code: '01010', activity: 'Bicycling, <10 mph, leisure, to work or for pleasure' },
    moderate: { met: 8.0, code: '01030', activity: 'Bicycling, 12-13.9 mph, leisure, moderate effort' },
    vigorous: { met: 10.0, code: '01040', activity: 'Bicycling, 14-15.9 mph, racing or leisure, vigorous effort' },
  },
  swimming: {
    light: { met: 4.8, code: '18255', activity: 'Swimming, backstroke, recreational' },
    moderate: { met: 5.8, code: '18292', activity: 'Swimming, crawl, slow speed, moderate effort' },
    vigorous: { met: 9.8, code: '18230', activity: 'Swimming laps, freestyle, fast, vigorous effort' },
  },
  mobility: {
    light: { met: 2.3, code: '02101', activity: 'Stretching, mild' },
    moderate: { met: 2.8, code: '02105', activity: 'Pilates, general' },
    vigorous: { met: 4.0, code: '02160', activity: 'Yoga, Power' },
  },
  sports: {
    light: { met: 3.0, code: '15720', activity: 'Volleyball, non-competitive, general' },
    moderate: { met: 6.8, code: '15675', activity: 'Tennis, general, moderate effort' },
    vigorous: { met: 8.0, code: '15040', activity: 'Basketball, game' },
  },
  other: {
    light: { met: 3.8, code: '02064', activity: 'Home exercise, general' },
    moderate: { met: 5.5, code: '02060', activity: 'Health club exercise, general' },
    vigorous: { met: 7.8, code: '02062', activity: 'Health club exercise, conditioning classes' },
  },
}

/** Intensity assumed for the kcal estimate when a workout was logged without one. */
export const DEFAULT_ESTIMATE_INTENSITY: Intensity = 'moderate'

/** Estimates are rounded to the nearest 5 kcal — they are approximations, not measurements. */
export const KCAL_ROUNDING_STEP = 5

/** Plausible input ranges (match the database checks on workout_logs and weight_logs). */
export const MIN_WORKOUT_MINUTES = 1
export const MAX_WORKOUT_MINUTES = 600
export const MIN_BODY_WEIGHT_KG = 20
export const MAX_BODY_WEIGHT_KG = 400

/**
 * Which weekly-plan category a workout type belongs to.
 * - strength → strength
 * - cardio, hiit, run, cycling, swimming → cardio
 * - walk → cardio, but a walk only COUNTS toward the plan when it lasts at least WALK_MIN_COUNTED_MINUTES
 * - mobility, sports, other → no category: they still add to weekly minutes but not to planned sessions,
 *   because the plan only sets strength and cardio targets and these activities vary too much to map reliably.
 */
export const WORKOUT_CATEGORY: Record<WorkoutType, ActivityCategory | null> = {
  strength: 'strength',
  cardio: 'cardio',
  hiit: 'cardio',
  walk: 'cardio',
  run: 'cardio',
  cycling: 'cardio',
  swimming: 'cardio',
  mobility: null,
  sports: null,
  other: null,
}

export const WALK_MIN_COUNTED_MINUTES = 20

/** Planned sessions per category are clamped to the profile range (database check 0–14). */
export const MAX_PLANNED_PER_CATEGORY = 14

export const DAYS_PER_WEEK = 7

/**
 * Recovery rules (date granularity):
 * - a strength session needs 48 h after a previous strength or vigorous session, i.e. nothing of the
 *   kind on the day before (two days earlier is fine) — and, for already planned sessions, the day after;
 * - vigorous sessions are never on consecutive days;
 * - HIIT always counts as a vigorous session for recovery, whatever intensity was logged.
 */
export const STRENGTH_RECOVERY_DAYS = 2

/** Smart Catch-Up never suggests more than one session per day. */
export const MAX_SESSIONS_PER_DAY = 1

/** Catch-up sessions use the preferred length clamped to this range (no extra-long make-up sessions). */
export const CATCH_UP_MIN_MINUTES = 20
export const CATCH_UP_MAX_MINUTES = 60
export const CATCH_UP_MINUTES_STEP = 5
/** Used when the preferred length is missing or not a number (profile default). */
export const DEFAULT_PREFERRED_MINUTES = 40
/** "Shorter sessions" alternative: about three quarters of the usual length. */
export const SHORTER_SESSION_FACTOR = 0.75

/** Strength suggestions are described as full-body when the plan has at most this many per week. */
export const FULL_BODY_MAX_STRENGTH_PER_WEEK = 2

/** Number of alternative complete options returned next to the primary one. */
export const MAX_CATCH_UP_ALTERNATIVES = 2

/** History window used for cardio preferences. */
export const RECENT_WINDOW_DAYS = 14

/**
 * Cardio types Smart Catch-Up may suggest, in tie-break order. HIIT is excluded: it always counts as a
 * vigorous session, and catch-up suggestions stay light or moderate so they never stack hard days.
 */
export const CATCH_UP_CARDIO_TYPES = ['walk', 'run', 'cycling', 'swimming', 'cardio'] as const
export type CatchUpCardioType = (typeof CATCH_UP_CARDIO_TYPES)[number]

/** Suggested when there is no cardio history: a brisk walk. */
export const DEFAULT_CARDIO_TYPE: CatchUpCardioType = 'walk'
