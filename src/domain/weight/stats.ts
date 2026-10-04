import type { WeightEntry } from '@/types'
import { dailyWeightsThrough } from './daily'
import { isPositiveKg, roundKg } from './math'
import { trendDirection, trendRateKgPerWeek } from './trendRate'
import type { WeightStats, WeightStatsOptions } from './types'
import { weeklyChangeKg } from './weeklyChange'

type StatsEntry = Pick<WeightEntry, 'id' | 'date' | 'measuredAt' | 'weightKg'>

const EMPTY_STATS: WeightStats = {
  current: null,
  weeklyChangeKg: null,
  totalChangeKg: null,
  distanceToGoalKg: null,
  trend: 'insufficient_data',
  trendRateKgPerWeek: null,
  measurementDays: 0,
}

/**
 * Progress summary from raw weigh-ins. Only measurements dated on or before `today` count.
 * - current: latest daily value (same-day rule: earliest weigh-in of the day)
 * - weeklyChangeKg: trend(latest) − trend(latest − 7 d); else raw change vs the measurement closest to
 *   7 days before within 4–10 days; else null
 * - totalChangeKg: latest − first daily value (null with fewer than 2 days)
 * - distanceToGoalKg: target − current (negative = above target)
 * - trendRateKgPerWeek / trend: 14-day least-squares slope; 'stable' below 0.1 kg/week
 */
export function computeWeightStats(
  entries: readonly StatsEntry[],
  { targetWeightKg, today }: WeightStatsOptions,
): WeightStats {
  const daily = dailyWeightsThrough(entries, today)
  const current = daily[daily.length - 1]
  if (!current) return { ...EMPTY_STATS }

  const rate = trendRateKgPerWeek(daily, today)
  return {
    current,
    weeklyChangeKg: weeklyChangeKg(daily, current),
    // With ≥ 2 days the first element exists.
    totalChangeKg: daily.length < 2 ? null : roundKg(current.weightKg - daily[0]!.weightKg),
    distanceToGoalKg: isPositiveKg(targetWeightKg) ? roundKg(targetWeightKg - current.weightKg) : null,
    trend: trendDirection(rate),
    trendRateKgPerWeek: rate,
    measurementDays: daily.length,
  }
}
