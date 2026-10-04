import { addDays, daysBetween } from '@/domain/dates'
import { DAYS_PER_WEEK } from './constants'
import { mean, roundKg } from './math'
import type { WeightChartPoint } from './types'

function meanOrNull(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null)
  return known.length === 0 ? null : roundKg(mean(known))
}

/**
 * Collapses consecutive daily chart points into 7-day buckets that END on `endDate` and step back in
 * whole weeks, so the newest bucket is always a full week ending today; the oldest may be partial.
 * Each bucket is dated on its last day: weightKg = mean of the weigh-ins in it, trendKg = mean of the
 * daily trend values in it (null when none). targetKg is left null (projection is added separately).
 */
export function aggregateWeekly(points: readonly WeightChartPoint[], endDate: string): WeightChartPoint[] {
  const buckets = new Map<string, WeightChartPoint[]>()
  for (const point of points) {
    const weeksBack = Math.floor(daysBetween(point.date, endDate) / DAYS_PER_WEEK)
    const bucketEnd = addDays(endDate, -weeksBack * DAYS_PER_WEEK)
    const members = buckets.get(bucketEnd)
    if (members) members.push(point)
    else buckets.set(bucketEnd, [point])
  }
  // Points arrive ascending, so Map insertion order is already oldest → newest.
  return [...buckets.entries()].map(([date, members]) => ({
    date,
    weightKg: meanOrNull(members.map((member) => member.weightKg)),
    trendKg: meanOrNull(members.map((member) => member.trendKg)),
    targetKg: null,
  }))
}
