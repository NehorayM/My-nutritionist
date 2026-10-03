/** One value per local day, chosen by the same-day rule (see weightEngine). */
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
