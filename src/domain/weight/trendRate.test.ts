import { describe, expect, it } from 'vitest'
import { addDays } from '@/domain/dates'
import { day } from './__fixtures__/weightEntries'
import type { DailyWeight } from './types'
import { trendDirection, trendRateKgPerWeek } from './trendRate'

const TODAY = '2026-10-03'

function before(daysBefore: number, weightKg: number): DailyWeight {
  return day(addDays(TODAY, -daysBefore), weightKg)
}

/** Daily values for the last `days` days ending today, changing by `perDay` each day. */
function linear(days: number, endKg: number, perDay: number): DailyWeight[] {
  return Array.from({ length: days }, (_, i) => before(days - 1 - i, endKg - perDay * (days - 1 - i)))
}

describe('trendRateKgPerWeek', () => {
  it('measures a steady loss as a negative weekly rate', () => {
    expect(trendRateKgPerWeek(linear(14, 78.7, -0.1), TODAY)).toBe(-0.7)
  })

  it('measures a steady gain as a positive weekly rate', () => {
    expect(trendRateKgPerWeek(linear(10, 62, 0.05), TODAY)).toBe(0.35)
  })

  it('weights irregular intervals by calendar distance', () => {
    // x = 0, 1, 10 → slope −19/182 kg/day → −0.731 kg/week.
    const daily = [before(13, 80), before(12, 80), before(3, 79)]
    expect(trendRateKgPerWeek(daily, TODAY)).toBe(-0.731)
  })

  it('uses only the 14 days ending today (today − 13 is in, today − 14 is out)', () => {
    const inWindow = [before(13, 80), before(8, 80), before(0, 80)]
    expect(trendRateKgPerWeek([before(14, 95), ...inWindow], TODAY)).toBe(0)
    expect(trendRateKgPerWeek([before(14, 95), before(8, 80), before(0, 80)], TODAY)).toBeNull()
  })

  it('ignores values dated after today', () => {
    const daily = [before(6, 80), before(3, 80), before(0, 80), day(addDays(TODAY, 1), 90)]
    expect(trendRateKgPerWeek(daily, TODAY)).toBe(0)
  })

  it('needs at least 3 values', () => {
    expect(trendRateKgPerWeek([], TODAY)).toBeNull()
    expect(trendRateKgPerWeek([before(10, 81), before(0, 80)], TODAY)).toBeNull()
  })

  it('needs the values to span at least 4 days', () => {
    expect(trendRateKgPerWeek([before(3, 81), before(2, 80.5), before(0, 80)], TODAY)).toBeNull()
    expect(trendRateKgPerWeek([before(4, 80.4), before(2, 80.2), before(0, 80)], TODAY)).toBe(-0.7)
  })

  it('is null when the last weigh-in is older than the window', () => {
    expect(trendRateKgPerWeek(linear(10, 80, -0.1).map((d) => ({ ...d, date: addDays(d.date, -20) })), TODAY)).toBeNull()
  })
})

describe('trendDirection', () => {
  it('reports insufficient data without a rate', () => {
    expect(trendDirection(null)).toBe('insufficient_data')
  })

  it('treats |rate| below 0.1 kg/week as stable', () => {
    expect(trendDirection(0)).toBe('stable')
    expect(trendDirection(0.099)).toBe('stable')
    expect(trendDirection(-0.099)).toBe('stable')
  })

  it('reports direction at and beyond the 0.1 kg/week threshold', () => {
    expect(trendDirection(0.1)).toBe('up')
    expect(trendDirection(-0.1)).toBe('down')
    expect(trendDirection(-0.7)).toBe('down')
  })
})
