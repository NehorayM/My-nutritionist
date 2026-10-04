import { describe, expect, it } from 'vitest'
import { addDays } from '@/domain/dates'
import { weighIn, weighInSeries } from './__fixtures__/weightEntries'
import { buildWeightChart } from './chart'
import type { WeightChartOptions, WeightGoalInput } from './types'

const TODAY = '2026-10-03'
const LOSS: WeightGoalInput = { targetKg: 72, goal: 'lose_weight', goalPace: 'moderate', isAdult: true }
/** Seven daily weigh-ins of 80 kg ending today, so today's trend is exactly 80. */
const STEADY = weighInSeries(addDays(TODAY, -6), [80, 80, 80, 80, 80, 80, 80])

function chart(entries: Parameters<typeof buildWeightChart>[0], options: Partial<WeightChartOptions> = {}) {
  return buildWeightChart(entries, { range: '7d', today: TODAY, trajectory: LOSS, ...options })
}

describe('buildWeightChart — target projection', () => {
  it('anchors at today’s trend and projects 14 days for 7d by default', () => {
    const points = chart(STEADY)
    expect(points).toHaveLength(7 + 14)
    expect(points[6]).toEqual({ date: TODAY, weightKg: 80, trendKg: 80, targetKg: 80 })
    expect(points[7]).toEqual({ date: addDays(TODAY, 1), weightKg: null, trendKg: null, targetKg: 79.943 })
    expect(points.find((p) => p.date === addDays(TODAY, 7))?.targetKg).toBe(79.6)
    expect(points.at(-1)).toEqual({ date: addDays(TODAY, 14), weightKg: null, trendKg: null, targetKg: 79.2 })
    expect(points.slice(0, 6).every((p) => p.targetKg === null)).toBe(true)
  })

  it('projects 30 days for 30d and all by default', () => {
    expect(chart(STEADY, { range: '30d' })).toHaveLength(30 + 30)
    expect(chart(STEADY, { range: 'all' })).toHaveLength(7 + 30)
    expect(chart(STEADY, { range: 'all' }).at(-1)?.date).toBe('2026-11-02')
  })

  it('anchors on the smoothed trend rather than today’s single weigh-in', () => {
    const points = chart(weighInSeries(addDays(TODAY, -6), [81, 81, 81, 81, 81, 81, 80.3]))
    expect(points[6]).toMatchObject({ weightKg: 80.3, trendKg: 80.9, targetKg: 80.9 })
  })

  it('falls back to the latest weigh-in when no weigh-in is inside today’s trend window', () => {
    const points = chart([weighIn(addDays(TODAY, -10), 85)])
    const today = points.find((p) => p.date === TODAY)
    expect(today).toMatchObject({ weightKg: null, trendKg: null, targetKg: 85 })
    // 85 kg moderate loss → 0.425 kg/week.
    expect(points.find((p) => p.date === addDays(TODAY, 7))?.targetKg).toBe(84.575)
  })

  it('honours a custom projection length, including none', () => {
    const none = chart(STEADY, { projectDays: 0 })
    expect(none).toHaveLength(7)
    expect(none.at(-1)?.targetKg).toBe(80)
    expect(chart(STEADY, { projectDays: 3 }).map((p) => p.date).slice(-3)).toEqual([
      '2026-10-04', '2026-10-05', '2026-10-06',
    ])
  })

  it('rejects projection lengths that are not whole non-negative day counts', () => {
    expect(() => chart(STEADY, { projectDays: -1 })).toThrow(RangeError)
    expect(() => chart(STEADY, { projectDays: 1.5 })).toThrow(RangeError)
  })

  it('holds the projection at the target once it is reached', () => {
    // 72.3 → 72 at 0.3615 kg/week (0.5 %): 0.3 / 0.3615 × 7 ≈ 5.8 days → held at the target from day 6.
    const points = chart(weighInSeries(addDays(TODAY, -6), [72.3, 72.3, 72.3, 72.3, 72.3, 72.3, 72.3]))
    const projected = points.slice(7).map((p) => p.targetKg)
    expect(projected.slice(0, 5).every((kg) => kg !== null && kg > 72)).toBe(true)
    expect(projected.slice(5)).toEqual(Array.from({ length: 9 }, () => 72))
  })

  it('steps the projection weekly when the history is aggregated weekly', () => {
    const points = chart([weighIn(addDays(TODAY, -420), 90), ...STEADY], { range: 'all' })
    const future = points.filter((p) => p.date > TODAY)
    expect(future.map((p) => p.date)).toEqual(['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31'])
    expect(future.map((p) => p.targetKg)).toEqual([79.6, 79.2, 78.8, 78.4])
    expect(points.find((p) => p.date === TODAY)?.targetKg).toBe(80)
  })

  it('crosses into the next year by calendar day', () => {
    const points = chart(weighInSeries('2026-12-25', [80, 80, 80, 80, 80, 80, 80]), { today: '2026-12-31', projectDays: 2 })
    expect(points.slice(-2).map((p) => p.date)).toEqual(['2027-01-01', '2027-01-02'])
  })

  it('shows no projection without goal settings', () => {
    const points = chart(STEADY, { trajectory: null })
    expect(points).toHaveLength(7)
    expect(points.every((p) => p.targetKg === null)).toBe(true)
  })

  it('shows no projection when no safe trajectory exists', () => {
    const cases: WeightGoalInput[] = [
      { ...LOSS, isAdult: false },
      { ...LOSS, goal: 'maintain' },
      { ...LOSS, targetKg: null },
      { ...LOSS, targetKg: 85 },
      { ...LOSS, targetKg: 79.9 },
      { ...LOSS, goal: 'gain_weight' },
    ]
    for (const trajectory of cases) {
      const points = chart(STEADY, { trajectory })
      expect(points).toHaveLength(7)
      expect(points.every((p) => p.targetKg === null)).toBe(true)
    }
  })
})
