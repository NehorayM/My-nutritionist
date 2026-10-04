import { describe, expect, it } from 'vitest'
import { addDays } from '@/domain/dates'
import { day } from './__fixtures__/weightEntries'
import type { DailyWeight } from './types'
import { rawWeeklyChangeKg, trendWeeklyChangeKg, weeklyChangeKg } from './weeklyChange'

const LATEST = '2026-10-03'

/** A daily value `daysBefore` days before LATEST. */
function before(daysBefore: number, weightKg: number): DailyWeight {
  return day(addDays(LATEST, -daysBefore), weightKg)
}

describe('trendWeeklyChangeKg', () => {
  it('compares the 7-day trend at the latest day with the trend 7 days earlier', () => {
    // Earlier window [−13, −7]: 82 and 81 → 81.5. Latest window [−6, 0]: 80.5 and 80 → 80.25.
    const daily = [before(13, 82), before(7, 81), before(6, 80.5), before(0, 80)]
    expect(trendWeeklyChangeKg(daily, before(0, 80))).toBe(-1.25)
  })

  it('is null when the earlier window [latest − 13, latest − 7] is empty', () => {
    const daily = [before(14, 82), before(6, 81), before(0, 80)]
    expect(trendWeeklyChangeKg(daily, before(0, 80))).toBeNull()
  })
})

describe('rawWeeklyChangeKg', () => {
  it('uses the measurement closest to 7 days before the latest', () => {
    const latest = before(0, 80)
    expect(rawWeeklyChangeKg([before(9, 83), before(6, 81), latest], latest)).toBe(-1)
    expect(rawWeeklyChangeKg([before(6, 81), before(9, 83), latest], latest)).toBe(-1)
    expect(rawWeeklyChangeKg([before(5, 81), before(8, 82.4), latest], latest)).toBe(-2.4)
  })

  it('prefers the earlier of two equally close measurements, whatever the input order', () => {
    const latest = before(0, 80)
    const sixDays = before(6, 81)
    const eightDays = before(8, 82)
    expect(rawWeeklyChangeKg([eightDays, sixDays, latest], latest)).toBe(-2)
    expect(rawWeeklyChangeKg([sixDays, eightDays, latest], latest)).toBe(-2)
  })

  it('accepts 4 and 10 days before, but not 3 or 11', () => {
    const latest = before(0, 80)
    expect(rawWeeklyChangeKg([before(4, 80.6), latest], latest)).toBe(-0.6)
    expect(rawWeeklyChangeKg([before(10, 79.2), latest], latest)).toBe(0.8)
    expect(rawWeeklyChangeKg([before(3, 81), latest], latest)).toBeNull()
    expect(rawWeeklyChangeKg([before(11, 81), latest], latest)).toBeNull()
  })
})

describe('weeklyChangeKg', () => {
  it('prefers the trend-based change when both trend values exist', () => {
    const daily = [before(10, 82), before(5, 81), before(0, 80)]
    // Earlier window holds 82; latest window holds 81 and 80 → 80.5 − 82.
    expect(weeklyChangeKg(daily, before(0, 80))).toBe(-1.5)
  })

  it('falls back to the raw change when only recent measurements exist', () => {
    const daily = [before(5, 81.2), before(0, 80)]
    expect(weeklyChangeKg(daily, before(0, 80))).toBe(-1.2)
  })

  it('is null for a single measurement or when nothing is 4–10 days back', () => {
    expect(weeklyChangeKg([before(0, 80)], before(0, 80))).toBeNull()
    expect(weeklyChangeKg([before(2, 81), before(0, 80)], before(0, 80))).toBeNull()
  })

  it('reports gains as positive values', () => {
    const daily = [before(7, 60), before(0, 60.4)]
    expect(weeklyChangeKg(daily, before(0, 60.4))).toBe(0.4)
  })
})
