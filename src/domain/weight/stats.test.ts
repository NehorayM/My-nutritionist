import { describe, expect, it } from 'vitest'
import { addDays } from '@/domain/dates'
import { weighIn, weighInSeries } from './__fixtures__/weightEntries'
import { computeWeightStats } from './stats'

const TODAY = '2026-10-03'
const options = { targetWeightKg: null, today: TODAY }

describe('computeWeightStats', () => {
  it('reports no data for an empty history', () => {
    expect(computeWeightStats([], { targetWeightKg: 70, today: TODAY })).toEqual({
      current: null,
      weeklyChangeKg: null,
      totalChangeKg: null,
      distanceToGoalKg: null,
      trend: 'insufficient_data',
      trendRateKgPerWeek: null,
      measurementDays: 0,
    })
  })

  it('handles a single weigh-in', () => {
    const stats = computeWeightStats([weighIn(TODAY, 82.5, { id: 'only' })], { targetWeightKg: 75, today: TODAY })
    expect(stats).toEqual({
      current: { date: TODAY, weightKg: 82.5, entryId: 'only', measurementCount: 1 },
      weeklyChangeKg: null,
      totalChangeKg: null,
      distanceToGoalKg: -7.5,
      trend: 'insufficient_data',
      trendRateKgPerWeek: null,
      measurementDays: 1,
    })
  })

  it('summarises a steady two-week loss', () => {
    // 80.0 on today − 13 down to 78.7 today, 0.1 kg per day.
    const values = Array.from({ length: 14 }, (_, i) => 80 - i * 0.1)
    const stats = computeWeightStats(weighInSeries(addDays(TODAY, -13), values), { targetWeightKg: 75, today: TODAY })
    expect(stats.current?.weightKg).toBeCloseTo(78.7, 10)
    expect(stats.totalChangeKg).toBe(-1.3)
    // Trend means: days −6..0 → 79.0; days −13..−7 → 79.7.
    expect(stats.weeklyChangeKg).toBe(-0.7)
    expect(stats.trendRateKgPerWeek).toBe(-0.7)
    expect(stats.trend).toBe('down')
    expect(stats.distanceToGoalKg).toBe(-3.7)
    expect(stats.measurementDays).toBe(14)
  })

  it('reports an upward trend and a positive distance for a gain goal', () => {
    const stats = computeWeightStats(weighInSeries(addDays(TODAY, -6), [58, 58.1, 58.2, 58.3, 58.4, 58.5, 58.6]), {
      targetWeightKg: 62,
      today: TODAY,
    })
    expect(stats.trend).toBe('up')
    expect(stats.trendRateKgPerWeek).toBe(0.7)
    expect(stats.distanceToGoalKg).toBe(3.4)
    expect(stats.totalChangeKg).toBe(0.6)
    // No value 7–13 days back, so the raw change vs 6 days earlier is used.
    expect(stats.weeklyChangeKg).toBe(0.6)
  })

  it('reports a stable trend for small fluctuations', () => {
    const stats = computeWeightStats(weighInSeries(addDays(TODAY, -9), [80, 80.3, 79.9, 80.2, 80, 79.8, 80.1, 80.2, 79.9, 80]), options)
    expect(stats.trend).toBe('stable')
    expect(Math.abs(stats.trendRateKgPerWeek ?? 1)).toBeLessThan(0.1)
  })

  it('uses the earliest weigh-in of each day', () => {
    const stats = computeWeightStats(
      [
        weighIn(addDays(TODAY, -1), 80, { id: 'y' }),
        weighIn(TODAY, 81.4, { id: 'late', measuredAt: `${TODAY}T19:00:00Z` }),
        weighIn(TODAY, 79.6, { id: 'early', measuredAt: `${TODAY}T05:45:00Z` }),
      ],
      options,
    )
    expect(stats.current).toMatchObject({ entryId: 'early', weightKg: 79.6, measurementCount: 2 })
    expect(stats.totalChangeKg).toBe(-0.4)
    expect(stats.measurementDays).toBe(2)
  })

  it('ignores weigh-ins dated after today', () => {
    const stats = computeWeightStats([weighIn(addDays(TODAY, -1), 80), weighIn(addDays(TODAY, 1), 70)], options)
    expect(stats.current?.weightKg).toBe(80)
    expect(stats.measurementDays).toBe(1)
  })

  it('keeps the latest weigh-in as current even when it is not today', () => {
    const stats = computeWeightStats([weighIn('2026-09-01', 81), weighIn('2026-09-10', 80)], options)
    expect(stats.current?.date).toBe('2026-09-10')
    expect(stats.totalChangeKg).toBe(-1)
    expect(stats.trend).toBe('insufficient_data')
  })

  it('signs the distance to goal and omits it without a usable target', () => {
    const entries = [weighIn(TODAY, 80)]
    expect(computeWeightStats(entries, { targetWeightKg: 72.5, today: TODAY }).distanceToGoalKg).toBe(-7.5)
    expect(computeWeightStats(entries, { targetWeightKg: 84, today: TODAY }).distanceToGoalKg).toBe(4)
    expect(computeWeightStats(entries, { targetWeightKg: 80, today: TODAY }).distanceToGoalKg).toBe(0)
    expect(computeWeightStats(entries, { targetWeightKg: null, today: TODAY }).distanceToGoalKg).toBeNull()
    expect(computeWeightStats(entries, { targetWeightKg: 0, today: TODAY }).distanceToGoalKg).toBeNull()
    expect(computeWeightStats(entries, { targetWeightKg: Number.NaN, today: TODAY }).distanceToGoalKg).toBeNull()
  })

  it('computes total change across a year boundary from irregular weigh-ins', () => {
    const stats = computeWeightStats(
      [weighIn('2027-01-02', 77.8), weighIn('2026-12-20', 79.1), weighIn('2026-12-31', 78.4)],
      { targetWeightKg: null, today: '2027-01-02' },
    )
    expect(stats.totalChangeKg).toBe(-1.3)
    // Trend at Jan 2 = mean(78.4, 77.8); trend at Dec 26 = 79.1 (Dec 20 is inside its window).
    expect(stats.weeklyChangeKg).toBe(-1)
    expect(stats.measurementDays).toBe(3)
  })

  it('returns a fresh object for an empty history', () => {
    const first = computeWeightStats([], options)
    first.measurementDays = 5
    expect(computeWeightStats([], options).measurementDays).toBe(0)
  })
})
