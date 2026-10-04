import { addDays, compareDateKeys, eachDay } from '@/domain/dates'
import { TREND_WINDOW_DAYS } from './constants'
import { mean, roundKg } from './math'
import type { DailyWeight, MovingAveragePoint } from './types'

/** Throws for a day count that is not a whole number ≥ min (a programming error, not user data). */
export function assertWholeDays(value: number, min: number, name: string): void {
  if (!Number.isInteger(value) || value < min) {
    throw new RangeError(`${name} must be a whole number ≥ ${min}, received ${value}`)
  }
}

/** Daily value by date key. */
export function valuesByDate(daily: readonly DailyWeight[]): Map<string, number> {
  return new Map(daily.map((day) => [day.date, day.weightKg]))
}

/** Values present in the trailing window [end − (windowDays − 1), end]. */
export function windowValues(
  byDate: ReadonlyMap<string, number>,
  end: string,
  windowDays: number,
): number[] {
  const values: number[] = []
  for (let offset = 0; offset < windowDays; offset += 1) {
    const value = byDate.get(addDays(end, -offset))
    if (value !== undefined) values.push(value)
  }
  return values
}

/**
 * Trailing calendar-day moving average.
 *
 * For a date d the window is the calendar days [d − (windowDays − 1), d]: with the default 7, a value
 * exactly 6 days earlier is inside the window and one 7 days earlier is not. The value is the plain mean
 * of the daily values present in the window — missing days are skipped, never treated as 0.
 *
 * Emitted dates: every calendar day from the first daily value through `through` (default: the last
 * daily value's date), ascending. Days whose window holds no value are still emitted, with
 * `trendKg: null` and `sampleCount: 0`. Returns [] for no values or when `through` precedes the first
 * value. Input is expected to hold one value per date (see selectDailyWeights); order does not matter.
 */
export function movingAverage(
  daily: readonly DailyWeight[],
  windowDays: number = TREND_WINDOW_DAYS,
  through?: string,
): MovingAveragePoint[] {
  assertWholeDays(windowDays, 1, 'windowDays')
  const sorted = [...daily].sort((a, b) => compareDateKeys(a.date, b.date))
  const first = sorted[0]
  if (!first) return []
  // sorted is non-empty here, so the last element exists.
  const end = through ?? sorted[sorted.length - 1]!.date
  const byDate = valuesByDate(sorted)

  return eachDay(first.date, end).map((date) => {
    const values = windowValues(byDate, date, windowDays)
    return {
      date,
      trendKg: values.length === 0 ? null : roundKg(mean(values)),
      sampleCount: values.length,
    }
  })
}

/** Non-null trend values by date, for O(1) lookups. */
export function trendLookup(points: readonly MovingAveragePoint[]): Map<string, number> {
  const lookup = new Map<string, number>()
  for (const point of points) {
    if (point.trendKg !== null) lookup.set(point.date, point.trendKg)
  }
  return lookup
}
