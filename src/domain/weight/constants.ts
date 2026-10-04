import type { GoalPace, WellnessGoal } from '@/types'
import type { WeightRange } from './types'

export const DAYS_PER_WEEK = 7

/** Engine outputs are rounded to grams to strip floating-point noise (UI formats further). */
export const KG_DECIMALS = 3

/** Trailing calendar-day window of the trend line (7-day moving average). */
export const TREND_WINDOW_DAYS = 7

/** Weekly change compares the trend at the latest day with the trend this many days earlier. */
export const WEEKLY_CHANGE_LOOKBACK_DAYS = 7
/** Raw fallback: the measurement closest to a week before the latest, 4–10 days before it (inclusive). */
export const WEEKLY_CHANGE_FALLBACK_MIN_DAYS = 4
export const WEEKLY_CHANGE_FALLBACK_MAX_DAYS = 10

/** Trend rate: least-squares fit over the last 14 calendar days, today included. */
export const TREND_RATE_WINDOW_DAYS = 14
export const TREND_RATE_MIN_POINTS = 3
/** Minimum days between the first and last fitted measurement. */
export const TREND_RATE_MIN_SPAN_DAYS = 4
/** |rate| below this (kg/week) reads as stable — within normal day-to-day fluctuation. */
export const STABLE_RATE_KG_PER_WEEK = 0.1

/** Within this distance (kg, inclusive) of the target there is no trajectory to draw. */
export const GOAL_TOLERANCE_KG = 0.2

/** Trajectories are only planned for body weights in this range (guards against unit/typing errors). */
export const PLAUSIBLE_BODY_WEIGHT_KG = { min: 20, max: 600 } as const

/** Goals that get a target trajectory; every other goal (maintain, wellness, muscle) never does. */
export const WEIGHT_CHANGE_GOALS = ['lose_weight', 'gain_weight'] as const satisfies readonly WellnessGoal[]
export type WeightChangeGoal = (typeof WEIGHT_CHANGE_GOALS)[number]

/**
 * Planned weekly change as a share of current body weight: 0.25 % gentle / 0.5 % moderate for both
 * loss (CDC gradual pace) and gain (Iraki 2019: ~0.25–0.5 %/week for novice/intermediate lifters).
 */
export const PLANNED_SHARE_PER_WEEK: Record<WeightChangeGoal, Record<GoalPace, number>> = {
  lose_weight: { gentle: 0.0025, moderate: 0.005 },
  gain_weight: { gentle: 0.0025, moderate: 0.005 },
}

/** Hard ceilings no plan may exceed: 1 %/week loss (Helms 2014 upper bound) and 0.5 %/week gain. */
export const MAX_SHARE_PER_WEEK: Record<WeightChangeGoal, number> = { lose_weight: 0.01, gain_weight: 0.005 }

/**
 * Daily deficit/surplus caps the calorie targets are built on (AHA/ACC/TOS 500 kcal/d option; conservative
 * end of a 10–20 % surplus). The trajectory never runs faster than these caps imply, so it matches the plan.
 */
export const ENERGY_CAP_KCAL_PER_DAY: Record<WeightChangeGoal, Record<GoalPace, number>> = {
  lose_weight: { gentle: 250, moderate: 500 },
  gain_weight: { gentle: 250, moderate: 300 },
}

/** Static energy density of body-weight change (~3,500 kcal/lb); a short-horizon approximation (Hall 2011). */
export const KCAL_PER_KG_BODY_WEIGHT = 7700

/** Calendar days shown by the fixed ranges (ending today). */
export const RANGE_DAYS = { '7d': 7, '30d': 30 } as const satisfies Partial<Record<WeightRange, number>>

/** Forward projection length, days past today. */
export const DEFAULT_PROJECTION_DAYS: Record<WeightRange, number> = { '7d': 14, '30d': 30, all: 30 }

/** The 'all' range switches to weekly mean points when it spans more calendar days than this. */
export const WEEKLY_AGGREGATION_THRESHOLD_DAYS = 400
