import { describe, expect, it } from 'vitest'
import { addDays } from '@/domain/dates'
import { createDefaultProfile } from '@/domain/profile'
import { weighIn } from './__fixtures__/weightEntries'
import {
  buildWeightChart,
  calculateTrajectory,
  computeWeightStats,
  movingAverage,
  selectDailyWeights,
  trajectoryWeightOn,
  weightGoalInput,
} from './index'

const TODAY = '2026-10-03'

/** Three weeks of irregular morning weigh-ins trending down ~0.35 kg/week, plus an evening re-weigh. */
const history = [
  ['2026-09-13', 82.4], ['2026-09-14', 82.9], ['2026-09-16', 82.2], ['2026-09-19', 82.6],
  ['2026-09-21', 82.0], ['2026-09-22', 82.3], ['2026-09-24', 81.9], ['2026-09-27', 81.8],
  ['2026-09-29', 81.5], ['2026-09-30', 81.9], ['2026-10-02', 81.4], ['2026-10-03', 81.2],
] as const
const entries = [
  ...history.map(([date, kg]) => weighIn(date, kg)),
  weighIn(TODAY, 82.1, { id: 'evening', measuredAt: `${TODAY}T20:00:00Z` }),
]
const profile = {
  ...createDefaultProfile('user-1', '2026-01-01T00:00:00.000Z'),
  birthDate: '1988-04-12',
  goal: 'lose_weight' as const,
  goalPace: 'gentle' as const,
  targetWeightKg: 76,
}

describe('weight engine public API', () => {
  it('turns raw weigh-ins into consistent stats, trend and chart', () => {
    const daily = selectDailyWeights(entries)
    expect(daily).toHaveLength(12)
    expect(daily.at(-1)).toMatchObject({ date: TODAY, weightKg: 81.2, measurementCount: 2 })

    const stats = computeWeightStats(entries, { targetWeightKg: profile.targetWeightKg, today: TODAY })
    expect(stats.current?.weightKg).toBe(81.2)
    expect(stats.totalChangeKg).toBe(-1.2)
    expect(stats.distanceToGoalKg).toBe(-5.2)
    expect(stats.trend).toBe('down')
    expect(stats.weeklyChangeKg).toBeLessThan(0)
    expect(stats.measurementDays).toBe(12)

    const trend = movingAverage(daily).at(-1)?.trendKg ?? null
    const chart = buildWeightChart(entries, { range: '30d', today: TODAY, trajectory: weightGoalInput(profile, TODAY) })
    expect(chart).toHaveLength(60)
    expect(chart[29]).toMatchObject({ date: TODAY, weightKg: 81.2, trendKg: trend, targetKg: trend })

    const plan = calculateTrajectory({ ...weightGoalInput(profile, TODAY), currentKg: trend, startDate: TODAY })
    // Gentle loss: 0.25 % of ~81.6 kg ≈ 0.204 kg/week.
    expect(plan?.ratePerWeekKg).toBe(-0.204)
    expect(trend).toBe(81.56)
    // The chart's projection follows the same plan: 30 days × 0.204 / 7 below today's trend.
    expect(chart.at(-1)).toEqual({ date: addDays(TODAY, 30), weightKg: null, trendKg: null, targetKg: 80.686 })
    expect(plan && trajectoryWeightOn(plan, addDays(TODAY, 30))).toBe(80.686)
  })

  it('shows a minor’s progress without any target line', () => {
    const teen = { ...profile, birthDate: '2010-06-01' }
    const chart = buildWeightChart(entries, { range: '7d', today: TODAY, trajectory: weightGoalInput(teen, TODAY) })
    expect(chart).toHaveLength(7)
    expect(chart.every((p) => p.targetKg === null)).toBe(true)
  })
})
