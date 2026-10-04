import { describe, expect, it } from 'vitest'
import { weighIn } from './__fixtures__/weightEntries'
import { dailyWeightsThrough, selectDailyWeights } from './daily'

describe('selectDailyWeights', () => {
  it('returns an empty list without entries', () => {
    expect(selectDailyWeights([])).toEqual([])
  })

  it('maps a single weigh-in to one daily value', () => {
    expect(selectDailyWeights([weighIn('2026-10-03', 80.4, { id: 'a' })])).toEqual([
      { date: '2026-10-03', weightKg: 80.4, entryId: 'a', measurementCount: 1 },
    ])
  })

  it('sorts days ascending regardless of input order', () => {
    const result = selectDailyWeights([
      weighIn('2026-10-03', 80),
      weighIn('2026-09-28', 81),
      weighIn('2026-10-01', 80.5),
    ])
    expect(result.map((d) => d.date)).toEqual(['2026-09-28', '2026-10-01', '2026-10-03'])
    expect(result.map((d) => d.weightKg)).toEqual([81, 80.5, 80])
  })

  it('keeps the earliest measurement of the day and counts all of them', () => {
    const morning = weighIn('2026-10-03', 79.8, { id: 'z-morning', measuredAt: '2026-10-03T06:10:00Z' })
    const noon = weighIn('2026-10-03', 80.6, { id: 'a-noon', measuredAt: '2026-10-03T12:00:00Z' })
    const evening = weighIn('2026-10-03', 81.1, { id: 'b-evening', measuredAt: '2026-10-03T20:30:00Z' })
    for (const input of [[morning, noon, evening], [evening, noon, morning], [noon, evening, morning]]) {
      expect(selectDailyWeights(input)).toEqual([
        { date: '2026-10-03', weightKg: 79.8, entryId: 'z-morning', measurementCount: 3 },
      ])
    }
  })

  it('breaks equal instants by id ascending, independent of input order', () => {
    const b = weighIn('2026-10-03', 80.2, { id: 'b', measuredAt: '2026-10-03T07:00:00Z' })
    const a = weighIn('2026-10-03', 80.9, { id: 'a', measuredAt: '2026-10-03T07:00:00Z' })
    expect(selectDailyWeights([b, a])[0]?.entryId).toBe('a')
    expect(selectDailyWeights([a, b])[0]?.entryId).toBe('a')
  })

  it('compares real instants, not timestamp strings, across UTC offsets on a DST change day', () => {
    // 07:00+03:00 is 04:00Z — earlier than 06:30+02:00 (04:30Z) although its string sorts later.
    const later = weighIn('2026-03-27', 70.4, { id: 'a', measuredAt: '2026-03-27T06:30:00+02:00' })
    const earlier = weighIn('2026-03-27', 70.1, { id: 'b', measuredAt: '2026-03-27T07:00:00+03:00' })
    expect(selectDailyWeights([later, earlier])[0]?.entryId).toBe('b')
  })

  it('ranks unparseable timestamps after valid ones and orders two unparseable ones by id', () => {
    const broken = weighIn('2026-10-03', 79, { id: 'a', measuredAt: 'not-a-time' })
    const valid = weighIn('2026-10-03', 81, { id: 'b', measuredAt: '2026-10-03T23:59:00Z' })
    expect(selectDailyWeights([broken, valid])[0]?.entryId).toBe('b')
    expect(selectDailyWeights([valid, broken])[0]?.entryId).toBe('b')

    const alsoBroken = weighIn('2026-10-03', 78, { id: 'c', measuredAt: '' })
    expect(selectDailyWeights([alsoBroken, broken])[0]).toMatchObject({ entryId: 'a', measurementCount: 2 })
  })

  it('ignores non-finite or non-positive weights and invalid date keys', () => {
    const result = selectDailyWeights([
      weighIn('2026-10-01', Number.NaN, { id: 'nan' }),
      weighIn('2026-10-01', Number.POSITIVE_INFINITY, { id: 'inf' }),
      weighIn('2026-10-01', 0, { id: 'zero' }),
      weighIn('2026-10-01', -70, { id: 'negative' }),
      weighIn('2026-02-30', 70, { id: 'no-such-day' }),
      weighIn('2026-1-05', 70, { id: 'malformed' }),
      weighIn('', 70, { id: 'empty' }),
      weighIn('2026-10-01', 80, { id: 'ok', measuredAt: '2026-10-01T09:00:00Z' }),
    ])
    expect(result).toEqual([{ date: '2026-10-01', weightKg: 80, entryId: 'ok', measurementCount: 1 }])
  })

  it('groups by the stored local date even when the instant falls on another UTC day', () => {
    // 00:30 local in UTC+3 is the previous UTC day; the entry still belongs to its local date.
    const result = selectDailyWeights([weighIn('2026-10-03', 80, { measuredAt: '2026-10-02T21:30:00Z' })])
    expect(result[0]?.date).toBe('2026-10-03')
  })
})

describe('dailyWeightsThrough', () => {
  it('keeps days up to and including today and drops future-dated ones', () => {
    const result = dailyWeightsThrough(
      [weighIn('2026-10-02', 80), weighIn('2026-10-03', 79.9), weighIn('2026-10-04', 79.5)],
      '2026-10-03',
    )
    expect(result.map((d) => d.date)).toEqual(['2026-10-02', '2026-10-03'])
  })
})
