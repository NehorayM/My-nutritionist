import { GOAL_TOLERANCE_KG, TREND_RATE_MIN_POINTS, TREND_RATE_MIN_SPAN_DAYS, type WeightStats } from '@/domain/weight'
import { formatDateLabel, formatWeight } from '@/lib/format'
import type { GoalPace, UnitSystem, WeightEntry, WellnessGoal } from '@/types'

/** Neutral, descriptive labels — no direction of change is framed as good or bad. */
export const GOAL_LABELS: Record<WellnessGoal, string> = {
  general_wellness: 'General wellness',
  maintain: 'Maintain weight',
  lose_weight: 'Lose weight',
  gain_weight: 'Gain weight',
  build_muscle: 'Build muscle',
}

export const PACE_LABELS: Record<GoalPace, string> = { gentle: 'Gentle', moderate: 'Moderate' }

/** One-line trend description, e.g. "Trending down ~0.3 kg/week". */
export function trendSummary(stats: Pick<WeightStats, 'trend' | 'trendRateKgPerWeek'>, unitSystem: UnitSystem): string {
  const rate = stats.trendRateKgPerWeek
  switch (stats.trend) {
    case 'down':
    case 'up':
      return `Trending ${stats.trend} ~${formatWeight(Math.abs(rate ?? 0), unitSystem)}/week`
    case 'stable':
      return 'Holding steady over the last two weeks'
    case 'insufficient_data':
      return 'Your trend appears after a few more weigh-ins'
  }
}

/** Supporting line under the trend summary. */
export function trendDetail(stats: Pick<WeightStats, 'trend'>): string {
  if (stats.trend === 'insufficient_data') {
    return `Log at least ${TREND_RATE_MIN_POINTS} weigh-ins spread over ${TREND_RATE_MIN_SPAN_DAYS + 1}+ days within two weeks.`
  }
  return 'Based on your weigh-ins from the last 14 days. Day-to-day ups and downs are normal; the trend smooths them out.'
}

export interface DistanceCopy {
  value: string
  hint: string
}

/** "To target" tile: the remaining distance without judging the direction. */
export function distanceCopy(distanceKg: number, targetKg: number, unitSystem: UnitSystem): DistanceCopy {
  if (Math.abs(distanceKg) <= GOAL_TOLERANCE_KG) {
    return { value: 'At target', hint: `Within ${formatWeight(GOAL_TOLERANCE_KG, unitSystem)} of ${formatWeight(targetKg, unitSystem)}` }
  }
  return { value: formatWeight(Math.abs(distanceKg), unitSystem), hint: `To reach ${formatWeight(targetKg, unitSystem)}` }
}

const NOON = 12

/**
 * Neutral note when the chosen day already has a weigh-in, e.g. "You've already logged 71.2 kg this
 * morning — adding another is fine; the chart uses your first weigh-in of the day."
 */
export function duplicateWeighInNotice(first: WeightEntry, today: string, unitSystem: UnitSystem): string {
  const weight = formatWeight(first.weightKg, unitSystem)
  const tail = 'adding another is fine; the chart uses your first weigh-in of the day.'
  if (first.date === today) {
    const hour = new Date(first.measuredAt).getHours()
    return `You've already logged ${weight} ${hour < NOON ? 'this morning' : 'today'} — ${tail}`
  }
  const day = formatDateLabel(first.date, today)
  const on = day === 'Yesterday' ? 'yesterday' : `on ${day}`
  return `You already logged ${weight} ${on} — ${tail}`
}
