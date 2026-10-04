import { describe, expect, it } from 'vitest'
import type { WeightEntry } from '@/types'
import { distanceCopy, duplicateWeighInNotice, trendDetail, trendSummary } from './progressCopy'

const TODAY = '2026-10-07'

function weighIn(date: string, hour: number, weightKg = 71.2): WeightEntry {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const iso = new Date(year, month - 1, day, hour, 0).toISOString()
  return { id: 'w', userId: 'u', date, measuredAt: iso, weightKg, inputUnit: 'kg', note: null, createdAt: iso, updatedAt: iso }
}

describe('trend copy', () => {
  it('describes the direction neutrally with the rate in the user unit', () => {
    expect(trendSummary({ trend: 'down', trendRateKgPerWeek: -0.31 }, 'metric')).toBe('Trending down ~0.3 kg/week')
    expect(trendSummary({ trend: 'up', trendRateKgPerWeek: 0.45 }, 'imperial')).toBe('Trending up ~1.0 lb/week')
    expect(trendSummary({ trend: 'stable', trendRateKgPerWeek: 0.02 }, 'metric')).toBe('Holding steady over the last two weeks')
    expect(trendSummary({ trend: 'insufficient_data', trendRateKgPerWeek: null }, 'metric')).toBe(
      'Your trend appears after a few more weigh-ins',
    )
  })

  it('explains what the trend needs or is based on', () => {
    expect(trendDetail({ trend: 'insufficient_data' })).toBe('Log at least 3 weigh-ins spread over 5+ days within two weeks.')
    expect(trendDetail({ trend: 'down' })).toMatch(/^Based on your weigh-ins from the last 14 days\./)
  })
})

describe('distanceCopy', () => {
  it('shows the remaining distance without a direction judgement', () => {
    expect(distanceCopy(-5.55, 74, 'metric')).toEqual({ value: '5.6 kg', hint: 'To reach 74.0 kg' })
    expect(distanceCopy(2, 74, 'imperial')).toEqual({ value: '4.4 lb', hint: 'To reach 163.1 lb' })
  })

  it('reads as at target within the tolerance', () => {
    expect(distanceCopy(0.15, 74, 'metric')).toEqual({ value: 'At target', hint: 'Within 0.2 kg of 74.0 kg' })
  })
})

describe('duplicateWeighInNotice', () => {
  it('names the time of day for today', () => {
    expect(duplicateWeighInNotice(weighIn(TODAY, 7), TODAY, 'metric')).toBe(
      "You've already logged 71.2 kg this morning — adding another is fine; the chart uses your first weigh-in of the day.",
    )
    expect(duplicateWeighInNotice(weighIn(TODAY, 14), TODAY, 'metric')).toMatch(/^You've already logged 71\.2 kg today — /)
  })

  it('names earlier days', () => {
    expect(duplicateWeighInNotice(weighIn('2026-10-06', 7), TODAY, 'imperial')).toMatch(
      /^You already logged 157\.0 lb yesterday — adding another is fine/,
    )
    expect(duplicateWeighInNotice(weighIn('2026-10-01', 7), TODAY, 'metric')).toMatch(/^You already logged 71\.2 kg on Thu, Oct 1 — /)
  })
})
