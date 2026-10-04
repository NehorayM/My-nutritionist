import { addDays, daysBetween } from '@/domain/dates'
import {
  TREND_WINDOW_DAYS,
  WEEKLY_CHANGE_FALLBACK_MAX_DAYS,
  WEEKLY_CHANGE_FALLBACK_MIN_DAYS,
  WEEKLY_CHANGE_LOOKBACK_DAYS,
} from './constants'
import { mean, roundKg } from './math'
import { valuesByDate, windowValues } from './movingAverage'
import type { DailyWeight } from './types'

/**
 * trend(latest) − trend(latest − 7 days), using the 7-day moving average. Null when the earlier window
 * [latest − 13, latest − 7] holds no value (the latest window always holds the latest value itself).
 */
export function trendWeeklyChangeKg(daily: readonly DailyWeight[], latest: DailyWeight): number | null {
  const byDate = valuesByDate(daily)
  const earlier = windowValues(byDate, addDays(latest.date, -WEEKLY_CHANGE_LOOKBACK_DAYS), TREND_WINDOW_DAYS)
  if (earlier.length === 0) return null
  const current = windowValues(byDate, latest.date, TREND_WINDOW_DAYS)
  return roundKg(mean(current) - mean(earlier))
}

/**
 * latest − the measurement closest to 7 days before it, among those 4–10 days before (inclusive).
 * At equal distance the earlier measurement wins. Null when no measurement falls in that span.
 */
export function rawWeeklyChangeKg(daily: readonly DailyWeight[], latest: DailyWeight): number | null {
  let best: { day: DailyWeight; gap: number; distance: number } | null = null
  for (const day of daily) {
    const gap = daysBetween(day.date, latest.date)
    if (gap < WEEKLY_CHANGE_FALLBACK_MIN_DAYS || gap > WEEKLY_CHANGE_FALLBACK_MAX_DAYS) continue
    const distance = Math.abs(gap - WEEKLY_CHANGE_LOOKBACK_DAYS)
    const closer = best === null || distance < best.distance
    const tieButEarlier = best !== null && distance === best.distance && gap > best.gap
    if (closer || tieButEarlier) best = { day, gap, distance }
  }
  return best === null ? null : roundKg(latest.weightKg - best.day.weightKg)
}

/** Weekly change: trend-based when both trend values exist, otherwise the raw fallback. */
export function weeklyChangeKg(daily: readonly DailyWeight[], latest: DailyWeight): number | null {
  return trendWeeklyChangeKg(daily, latest) ?? rawWeeklyChangeKg(daily, latest)
}
