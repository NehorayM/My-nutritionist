import { describe, expect, it } from 'vitest'
import { day } from './__fixtures__/weightEntries'
import { movingAverage, trendLookup } from './movingAverage'

describe('movingAverage', () => {
  it('returns an empty series without values', () => {
    expect(movingAverage([])).toEqual([])
  })

  it('emits a single point for a single value', () => {
    expect(movingAverage([day('2026-10-03', 80)])).toEqual([
      { date: '2026-10-03', trendKg: 80, sampleCount: 1 },
    ])
  })

  it('includes a value exactly 6 days earlier in the 7-day window', () => {
    const series = movingAverage([day('2026-09-27', 80), day('2026-10-03', 81)])
    expect(series).toHaveLength(7)
    expect(series[6]).toEqual({ date: '2026-10-03', trendKg: 80.5, sampleCount: 2 })
  })

  it('excludes a value exactly 7 days earlier from the 7-day window', () => {
    const series = movingAverage([day('2026-09-26', 80), day('2026-10-03', 82)])
    expect(series.at(-1)).toEqual({ date: '2026-10-03', trendKg: 82, sampleCount: 1 })
    // The day before still sees the older value through its own window.
    expect(series.at(-2)).toEqual({ date: '2026-10-02', trendKg: 80, sampleCount: 1 })
  })

  it('averages only the values present — missing days are never treated as zero', () => {
    const series = movingAverage([day('2026-10-01', 80), day('2026-10-03', 79)])
    expect(series).toEqual([
      { date: '2026-10-01', trendKg: 80, sampleCount: 1 },
      { date: '2026-10-02', trendKg: 80, sampleCount: 1 },
      { date: '2026-10-03', trendKg: 79.5, sampleCount: 2 },
    ])
  })

  it('emits every calendar day, with null where a gap is longer than the window', () => {
    const series = movingAverage([day('2026-09-01', 80), day('2026-09-12', 79)])
    expect(series).toHaveLength(12)
    expect(series.map((p) => p.date)[7]).toBe('2026-09-08')
    expect(series[6]).toMatchObject({ date: '2026-09-07', trendKg: 80 })
    expect(series[7]).toEqual({ date: '2026-09-08', trendKg: null, sampleCount: 0 })
    expect(series[10]).toEqual({ date: '2026-09-11', trendKg: null, sampleCount: 0 })
    expect(series[11]).toMatchObject({ date: '2026-09-12', trendKg: 79 })
  })

  it('extends through a later date and goes null once the window empties', () => {
    const series = movingAverage([day('2026-10-01', 80)], 7, '2026-10-09')
    expect(series.map((p) => p.trendKg)).toEqual([80, 80, 80, 80, 80, 80, 80, null, null])
  })

  it('returns an empty series when `through` precedes the first value', () => {
    expect(movingAverage([day('2026-10-03', 80)], 7, '2026-10-01')).toEqual([])
  })

  it('supports other windows; a 1-day window reproduces the raw values', () => {
    const daily = [day('2026-10-01', 80), day('2026-10-02', 81), day('2026-10-04', 83)]
    expect(movingAverage(daily, 1).map((p) => p.trendKg)).toEqual([80, 81, null, 83])
    expect(movingAverage(daily, 3).map((p) => p.trendKg)).toEqual([80, 80.5, 80.5, 82])
  })

  it('rejects windows that are not whole positive day counts', () => {
    expect(() => movingAverage([day('2026-10-03', 80)], 0)).toThrow(RangeError)
    expect(() => movingAverage([day('2026-10-03', 80)], -7)).toThrow(RangeError)
    expect(() => movingAverage([day('2026-10-03', 80)], 2.5)).toThrow(RangeError)
  })

  it('does not depend on input order', () => {
    const daily = [day('2026-10-01', 80), day('2026-10-02', 81), day('2026-10-03', 79.6)]
    expect(movingAverage([...daily].reverse())).toEqual(movingAverage(daily))
  })

  it('rounds to grams to remove floating-point noise', () => {
    const series = movingAverage([day('2026-10-01', 80.1), day('2026-10-02', 80.2), day('2026-10-03', 80.2)])
    expect(series.at(-1)?.trendKg).toBe(80.167)
  })

  it('walks month, year and leap-day boundaries one calendar day at a time', () => {
    const series = movingAverage([day('2027-12-30', 80), day('2028-01-02', 79)])
    expect(series.map((p) => p.date)).toEqual(['2027-12-30', '2027-12-31', '2028-01-01', '2028-01-02'])
    expect(series.at(-1)?.trendKg).toBe(79.5)

    const leap = movingAverage([day('2028-02-28', 80), day('2028-03-01', 78)])
    expect(leap.map((p) => p.date)).toEqual(['2028-02-28', '2028-02-29', '2028-03-01'])
    expect(leap.at(-1)?.trendKg).toBe(79)
  })

  it('emits each day exactly once across DST transitions', () => {
    // Israel (Mar 27), EU (Mar 29) spring forward; EU (Oct 25) and US (Nov 1) fall back.
    const spring = movingAverage([day('2026-03-26', 70), day('2026-03-30', 71)])
    expect(spring.map((p) => p.date)).toEqual([
      '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30',
    ])
    const autumn = movingAverage([day('2026-10-24', 70), day('2026-11-02', 72)])
    expect(new Set(autumn.map((p) => p.date)).size).toBe(10)
    expect(autumn.at(-1)).toEqual({ date: '2026-11-02', trendKg: 72, sampleCount: 1 })
  })
})

describe('trendLookup', () => {
  it('indexes non-null trend values by date', () => {
    const lookup = trendLookup([
      { date: '2026-10-01', trendKg: 80, sampleCount: 1 },
      { date: '2026-10-02', trendKg: null, sampleCount: 0 },
    ])
    expect([...lookup.entries()]).toEqual([['2026-10-01', 80]])
  })
})
