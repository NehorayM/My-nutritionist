import type { WeightEntry } from '@/types'
import { addDays, daysBetween, eachDay } from '@/domain/dates'
import { aggregateWeekly } from './chartWeekly'
import {
  DAYS_PER_WEEK,
  DEFAULT_PROJECTION_DAYS,
  RANGE_DAYS,
  TREND_WINDOW_DAYS,
  WEEKLY_AGGREGATION_THRESHOLD_DAYS,
} from './constants'
import { dailyWeightsThrough } from './daily'
import { assertWholeDays, movingAverage, trendLookup, valuesByDate } from './movingAverage'
import { calculateTrajectory, trajectoryWeightOn } from './trajectory'
import type { WeightChartGranularity, WeightChartOptions, WeightChartPoint, WeightRange } from './types'

type ChartEntry = Pick<WeightEntry, 'id' | 'date' | 'measuredAt' | 'weightKg'>

function granularityFor(range: WeightRange, firstDate: string, today: string): WeightChartGranularity {
  const spanDays = daysBetween(firstDate, today) + 1
  return range === 'all' && spanDays > WEEKLY_AGGREGATION_THRESHOLD_DAYS ? 'week' : 'day'
}

/**
 * 'week' when buildWeightChart would aggregate: range 'all' spanning more than 400 calendar days
 * (first measurement through today, inclusive); otherwise 'day'.
 */
export function weightChartGranularity(
  entries: readonly ChartEntry[],
  { range, today }: Pick<WeightChartOptions, 'range' | 'today'>,
): WeightChartGranularity {
  const first = dailyWeightsThrough(entries, today)[0]
  return first ? granularityFor(range, first.date, today) : 'day'
}

/**
 * Chart series for the Progress tab. Only measurements dated on or before `today` are used.
 *
 * History: one point per calendar day — '7d' = today−6 … today, '30d' = today−29 … today,
 * 'all' = first measurement … today. weightKg is the day's selected weigh-in (null without one);
 * trendKg is the 7-day moving average (it also looks back before the range start). For 'all' spanning
 * more than 400 days, points become weekly means (see aggregateWeekly); the last point is still today.
 *
 * Projection: only when `trajectory` is non-null and calculateTrajectory accepts it with
 * currentKg = today's trend (or the latest weigh-in when the trend window is empty) and startDate = today.
 * Then today's point gets targetKg = that anchor and points follow for each day (weekly in weekly mode)
 * up to `projectDays` after today, with weightKg/trendKg null. All other targetKg values are null.
 * Empty history → [].
 */
export function buildWeightChart(entries: readonly ChartEntry[], options: WeightChartOptions): WeightChartPoint[] {
  const { range, today, trajectory } = options
  const projectDays = options.projectDays ?? DEFAULT_PROJECTION_DAYS[range]
  assertWholeDays(projectDays, 0, 'projectDays')

  const daily = dailyWeightsThrough(entries, today)
  const first = daily[0]
  if (!first) return []
  // daily is non-empty here, so the last element exists.
  const latest = daily[daily.length - 1]!

  const trend = trendLookup(movingAverage(daily, TREND_WINDOW_DAYS, today))
  const weightByDate = valuesByDate(daily)
  const start = range === 'all' ? first.date : addDays(today, -(RANGE_DAYS[range] - 1))
  const dailyPoints: WeightChartPoint[] = eachDay(start, today).map((date) => ({
    date,
    weightKg: weightByDate.get(date) ?? null,
    trendKg: trend.get(date) ?? null,
    targetKg: null,
  }))

  const weekly = granularityFor(range, first.date, today) === 'week'
  const history = weekly ? aggregateWeekly(dailyPoints, today) : dailyPoints
  if (!trajectory) return history

  const anchorKg = trend.get(today) ?? latest.weightKg
  const plan = calculateTrajectory({ ...trajectory, currentKg: anchorKg, startDate: today })
  if (!plan) return history

  const step = weekly ? DAYS_PER_WEEK : 1
  const projection: WeightChartPoint[] = []
  for (let offset = step; offset <= projectDays; offset += step) {
    const date = addDays(today, offset)
    projection.push({ date, weightKg: null, trendKg: null, targetKg: trajectoryWeightOn(plan, date) })
  }
  // The last history point is always today; anchor the projection line there.
  const anchored = history.map((point) => (point.date === today ? { ...point, targetKg: anchorKg } : point))
  return [...anchored, ...projection]
}
