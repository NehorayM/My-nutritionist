import { describe, expect, it } from 'vitest'
import { addDays } from '@/domain/dates'
import { weighIn, weighInSeries } from './__fixtures__/weightEntries'
import { buildWeightChart, weightChartGranularity } from './chart'
import type { WeightRange } from './types'

const TODAY = '2026-10-03'

function chart(entries: Parameters<typeof buildWeightChart>[0], range: WeightRange, today = TODAY) {
  return buildWeightChart(entries, { range, today, trajectory: null })
}

describe('buildWeightChart — history', () => {
  it('returns no points without weigh-ins, for every range', () => {
    for (const range of ['7d', '30d', 'all'] as const) expect(chart([], range)).toEqual([])
  })

  it('returns no points when every weigh-in is dated after today', () => {
    expect(chart([weighIn(addDays(TODAY, 1), 80)], '7d')).toEqual([])
  })

  it('shows today − 6 … today for 7d, with null on days without a weigh-in', () => {
    const points = chart([weighIn('2026-09-25', 82), weighIn('2026-09-30', 80), weighIn(TODAY, 79)], '7d')
    expect(points.map((p) => p.date)).toEqual([
      '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03',
    ])
    expect(points.map((p) => p.weightKg)).toEqual([null, null, null, 80, null, null, 79])
    // The trend window looks back before the range start: Sep 25 counts until Oct 1.
    expect(points.map((p) => p.trendKg)).toEqual([82, 82, 82, 81, 81, 80, 79.5])
    expect(points.every((p) => p.targetKg === null)).toBe(true)
  })

  it('shows today − 29 … today for 30d', () => {
    const points = chart([weighIn('2026-09-10', 80)], '30d')
    expect(points).toHaveLength(30)
    expect(points[0]?.date).toBe('2026-09-04')
    expect(points.at(-1)?.date).toBe(TODAY)
    expect(points.find((p) => p.date === '2026-09-10')).toMatchObject({ weightKg: 80, trendKg: 80 })
    expect(points.find((p) => p.date === '2026-09-17')).toMatchObject({ weightKg: null, trendKg: null })
  })

  it('shows the first weigh-in … today for all, even when the last weigh-in is older than today', () => {
    const points = chart([weighIn('2026-09-30', 79.5), weighIn('2026-09-28', 80)], 'all')
    expect(points.map((p) => p.date)).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03',
    ])
    expect(points.map((p) => p.trendKg)).toEqual([80, 80, 79.75, 79.75, 79.75, 79.75])
  })

  it('keeps the fixed range when the history is older than it, with empty points', () => {
    const points = chart([weighIn('2026-08-01', 80)], '7d')
    expect(points).toHaveLength(7)
    expect(points.every((p) => p.weightKg === null && p.trendKg === null)).toBe(true)
  })

  it('plots the earliest weigh-in of a day and ignores future-dated entries', () => {
    const points = chart(
      [
        weighIn(TODAY, 81.2, { id: 'evening', measuredAt: `${TODAY}T19:00:00Z` }),
        weighIn(TODAY, 80.1, { id: 'morning', measuredAt: `${TODAY}T06:00:00Z` }),
        weighIn(addDays(TODAY, 2), 70),
      ],
      'all',
    )
    expect(points).toEqual([{ date: TODAY, weightKg: 80.1, trendKg: 80.1, targetKg: null }])
  })

  it('walks month and year boundaries one calendar day at a time', () => {
    const points = chart([weighIn('2026-12-30', 80), weighIn('2027-01-01', 79)], '7d', '2027-01-02')
    expect(points.map((p) => p.date)).toEqual([
      '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02',
    ])
    expect(points.at(-1)?.trendKg).toBe(79.5)
  })

  it('emits each day exactly once across DST changes', () => {
    const spring = chart([weighIn('2026-03-27', 70)], '7d', '2026-03-30')
    expect(spring.map((p) => p.date)).toEqual([
      '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30',
    ])
    const autumn = chart([weighIn('2026-10-20', 70)], '30d', '2026-11-05')
    expect(new Set(autumn.map((p) => p.date)).size).toBe(30)
    expect(autumn[0]?.date).toBe('2026-10-07')
  })
})

describe('buildWeightChart — weekly aggregation for long histories', () => {
  it('keeps daily points for all when the history spans exactly 400 days', () => {
    const points = chart([weighIn(addDays(TODAY, -399), 90), weighIn(TODAY, 80)], 'all')
    expect(points).toHaveLength(400)
  })

  it('switches all to weekly mean points beyond 400 days, ending on today', () => {
    const recent = weighInSeries(addDays(TODAY, -6), [80, null, null, 79, null, null, 78])
    const points = chart([weighIn(addDays(TODAY, -400), 90), ...recent], 'all')
    // 401 days → 57 full weeks plus a two-day partial week at the start.
    expect(points).toHaveLength(58)
    expect(points[0]).toMatchObject({ date: addDays(TODAY, -399), weightKg: 90, trendKg: 90 })
    expect(points.at(-1)).toMatchObject({ date: TODAY, weightKg: 79, targetKg: null })
    expect(points[1]).toMatchObject({ weightKg: null })
  })

  it('never aggregates the fixed ranges', () => {
    const entries = [weighIn(addDays(TODAY, -900), 90), weighIn(TODAY, 80)]
    expect(chart(entries, '7d')).toHaveLength(7)
    expect(chart(entries, '30d')).toHaveLength(30)
  })
})

describe('weightChartGranularity', () => {
  it('reports week only for all spanning more than 400 days', () => {
    const long = [weighIn(addDays(TODAY, -400), 90), weighIn(TODAY, 80)]
    const exact = [weighIn(addDays(TODAY, -399), 90)]
    expect(weightChartGranularity(long, { range: 'all', today: TODAY })).toBe('week')
    expect(weightChartGranularity(exact, { range: 'all', today: TODAY })).toBe('day')
    expect(weightChartGranularity(long, { range: '30d', today: TODAY })).toBe('day')
    expect(weightChartGranularity([], { range: 'all', today: TODAY })).toBe('day')
  })
})
