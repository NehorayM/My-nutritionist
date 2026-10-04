import { describe, expect, it } from 'vitest'
import type { WeightEntry } from '@/types'
import { firstWeighInOn, groupHistory } from './history'

function entry(id: string, date: string, time: string, weightKg: number): WeightEntry {
  const [hours, minutes] = time.split(':').map(Number) as [number, number]
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const iso = new Date(year, month - 1, day, hours, minutes).toISOString()
  return { id, userId: 'u', date, measuredAt: iso, weightKg, inputUnit: 'kg', note: null, createdAt: iso, updatedAt: iso }
}

const entries = [
  entry('b', '2026-10-07', '19:00', 72.1),
  entry('a', '2026-10-05', '07:00', 71.8),
  entry('c', '2026-10-07', '06:40', 71.4),
  entry('d', '2026-10-07', '12:15', 71.9),
]

describe('groupHistory', () => {
  it('groups by day, newest day and newest time first, marking the weigh-in the chart uses', () => {
    const days = groupHistory(entries)
    expect(days.map((day) => day.date)).toEqual(['2026-10-07', '2026-10-05'])
    expect(days[0]?.items.map(({ entry: { id }, usedInChart }) => [id, usedInChart])).toEqual([
      ['b', false],
      ['d', false],
      ['c', true],
    ])
    expect(days[1]?.items).toEqual([{ entry: entries[1], usedInChart: true }])
  })

  it('returns nothing for no entries', () => {
    expect(groupHistory([])).toEqual([])
  })
})

describe('firstWeighInOn', () => {
  it('returns the earliest weigh-in of the day or null', () => {
    expect(firstWeighInOn(entries, '2026-10-07')?.id).toBe('c')
    expect(firstWeighInOn(entries, '2026-10-06')).toBeNull()
  })
})
