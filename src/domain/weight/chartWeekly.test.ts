import { describe, expect, it } from 'vitest'
import { addDays, eachDay } from '@/domain/dates'
import { aggregateWeekly } from './chartWeekly'
import type { WeightChartPoint } from './types'

const END = '2026-10-03'

function point(date: string, weightKg: number | null, trendKg: number | null = weightKg): WeightChartPoint {
  return { date, weightKg, trendKg, targetKg: null }
}

describe('aggregateWeekly', () => {
  it('returns no buckets for no points', () => {
    expect(aggregateWeekly([], END)).toEqual([])
  })

  it('builds 7-day buckets ending on the end date; the oldest bucket may be partial', () => {
    const points = eachDay(addDays(END, -9), END).map((date) => point(date, null, null))
    const buckets = aggregateWeekly(points, END)
    // Days −9..−7 form a partial bucket dated −7; days −6..0 form the full bucket dated today.
    expect(buckets.map((b) => b.date)).toEqual([addDays(END, -7), END])
  })

  it('dates each bucket on its last day and averages only the known values in it', () => {
    const points = [
      point(addDays(END, -13), 82, 82),
      point(addDays(END, -10), null, 81.5),
      point(addDays(END, -8), 81, 81.4),
      point(addDays(END, -6), 80.4, 80.9),
      point(addDays(END, -3), null, null),
      point(END, 79.6, 80.2),
    ]
    expect(aggregateWeekly(points, END)).toEqual([
      { date: addDays(END, -7), weightKg: 81.5, trendKg: 81.633, targetKg: null },
      { date: END, weightKg: 80, trendKg: 80.55, targetKg: null },
    ])
  })

  it('keeps a bucket without any value, with null weight and trend', () => {
    const points = [point(addDays(END, -20), 83), point(addDays(END, -10), null, null), point(END, 80)]
    expect(aggregateWeekly(points, END)).toEqual([
      { date: addDays(END, -14), weightKg: 83, trendKg: 83, targetKg: null },
      { date: addDays(END, -7), weightKg: null, trendKg: null, targetKg: null },
      { date: END, weightKg: 80, trendKg: 80, targetKg: null },
    ])
  })

  it('never carries target values into history buckets', () => {
    const buckets = aggregateWeekly([{ date: END, weightKg: 80, trendKg: 80, targetKg: 80 }], END)
    expect(buckets[0]?.targetKg).toBeNull()
  })

  it('steps back whole calendar weeks across a year boundary', () => {
    const end = '2027-01-02'
    const points = eachDay('2026-12-19', end).map((date) => point(date, 80))
    // 2026-12-19 is exactly two weeks back, so it forms a one-day bucket of its own.
    expect(aggregateWeekly(points, end).map((b) => b.date)).toEqual(['2026-12-19', '2026-12-26', end])
  })
})
