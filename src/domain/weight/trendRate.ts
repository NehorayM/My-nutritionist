import { addDays, compareDateKeys, daysBetween } from '@/domain/dates'
import {
  DAYS_PER_WEEK,
  STABLE_RATE_KG_PER_WEEK,
  TREND_RATE_MIN_POINTS,
  TREND_RATE_MIN_SPAN_DAYS,
  TREND_RATE_WINDOW_DAYS,
} from './constants'
import { mean, roundKg } from './math'
import type { DailyWeight, TrendDirection } from './types'

/**
 * Least-squares slope of the daily values in the last 14 calendar days [today − 13, today], in kg/week.
 * Uses raw daily values (x = calendar day, so irregular spacing is weighted correctly). Null unless there
 * are ≥ 3 values whose first and last dates are ≥ 4 days apart — fewer points would make noise look
 * like a trend. A history that stopped more than 13 days ago therefore has no current trend.
 */
export function trendRateKgPerWeek(daily: readonly DailyWeight[], today: string): number | null {
  const from = addDays(today, -(TREND_RATE_WINDOW_DAYS - 1))
  const samples = daily
    .filter((day) => compareDateKeys(day.date, from) >= 0 && compareDateKeys(day.date, today) <= 0)
    .map((day) => ({ x: daysBetween(from, day.date), y: day.weightKg }))
  if (samples.length < TREND_RATE_MIN_POINTS) return null

  const xs = samples.map((sample) => sample.x)
  if (Math.max(...xs) - Math.min(...xs) < TREND_RATE_MIN_SPAN_DAYS) return null

  const meanX = mean(xs)
  const meanY = mean(samples.map((sample) => sample.y))
  let covariance = 0
  let varianceX = 0
  for (const { x, y } of samples) {
    covariance += (x - meanX) * (y - meanY)
    varianceX += (x - meanX) ** 2
  }
  // varianceX > 0: the span check guarantees at least two distinct x values.
  return roundKg((covariance / varianceX) * DAYS_PER_WEEK)
}

/** 'stable' when |rate| < 0.1 kg/week; otherwise the sign of the rate. */
export function trendDirection(rateKgPerWeek: number | null): TrendDirection {
  if (rateKgPerWeek === null) return 'insufficient_data'
  if (Math.abs(rateKgPerWeek) < STABLE_RATE_KG_PER_WEEK) return 'stable'
  return rateKgPerWeek < 0 ? 'down' : 'up'
}
