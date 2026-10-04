import type { GoalPace, WellnessGoal } from '@/types'

/** One value per local day, chosen by the same-day rule (see selectDailyWeights). */
export interface DailyWeight {
  date: string
  weightKg: number
  /** Id of the entry selected for this day. */
  entryId: string
  /** How many measurements exist for this day. */
  measurementCount: number
}

export type WeightRange = '7d' | '30d' | 'all'

export interface WeightChartPoint {
  date: string
  /** Selected same-day measurement; null on days without a weigh-in. */
  weightKg: number | null
  /** Moving average (trend); null when there is not enough data. */
  trendKg: number | null
  /** Target trajectory value; null when no safe/meaningful target is configured. */
  targetKg: number | null
}

export type TrendDirection = 'down' | 'up' | 'stable' | 'insufficient_data'

export interface WeightStats {
  current: DailyWeight | null
  /** Change vs ~7 days earlier (trend-based when possible); null if insufficient data. */
  weeklyChangeKg: number | null
  /** Latest minus first daily value; null with fewer than 2 days. */
  totalChangeKg: number | null
  /** target − current (negative = above target); null without a target or measurement. */
  distanceToGoalKg: number | null
  trend: TrendDirection
  /** Smoothed rate of change, kg/week; null if insufficient data. */
  trendRateKgPerWeek: number | null
  measurementDays: number
}

/** One calendar day of the trailing moving average (see movingAverage). */
export interface MovingAveragePoint {
  date: string
  /** Mean of the daily values inside the window; null when the window holds none. */
  trendKg: number | null
  /** Number of daily values inside the window. */
  sampleCount: number
}

export interface WeightStatsOptions {
  targetWeightKg: number | null
  /** Local date key (YYYY-MM-DD); measurements dated after it are ignored. */
  today: string
}

/** Goal settings that decide whether a target trajectory is shown. */
export interface WeightGoalInput {
  targetKg: number | null
  goal: WellnessGoal
  goalPace: GoalPace
  /** Caller-derived (profile age ≥ 18). Minors never get a trajectory. */
  isAdult: boolean
}

export interface TrajectoryInput extends WeightGoalInput {
  currentKg: number | null
  /** Local date key the trajectory starts from (usually today). */
  startDate: string
}

export interface TrajectoryPoint {
  date: string
  targetKg: number
}

export interface WeightTrajectory {
  /** Signed planned rate in kg/week (negative while losing, positive while gaining). */
  ratePerWeekKg: number
  /** First local date on which the planned line reaches the target. */
  estimatedGoalDate: string
  /** Whole weeks until estimatedGoalDate (rounded up) — for "about N weeks" copy rather than a date promise. */
  estimatedWeeks: number
  startDate: string
  startKg: number
  targetKg: number
  /** Weekly waypoints from startDate; the last point is estimatedGoalDate at targetKg. */
  points: TrajectoryPoint[]
}

export interface WeightChartOptions {
  range: WeightRange
  /** Local date key (YYYY-MM-DD) the chart ends on; later measurements are ignored. */
  today: string
  /**
   * Goal settings for the forward projection, or null for none. A full TrajectoryInput is accepted too;
   * its currentKg/startDate are ignored because the projection is anchored at today's trend.
   */
  trajectory: WeightGoalInput | null
  /** Days to project past today; defaults per range (see DEFAULT_PROJECTION_DAYS). */
  projectDays?: number
}

export type WeightChartGranularity = 'day' | 'week'
