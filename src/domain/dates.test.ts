import { describe, expect, it } from 'vitest'
import {
  addDays,
  ageOn,
  compareDateKeys,
  dateKeyToLocalDate,
  daysBetween,
  eachDay,
  isDateKey,
  minutesOfDay,
  startOfWeek,
  toDateKey,
  todayKey,
  weekdayOf,
} from './dates'

describe('date keys', () => {
  it('validates real calendar dates only', () => {
    expect(isDateKey('2026-10-03')).toBe(true)
    expect(isDateKey('2024-02-29')).toBe(true)
    expect(isDateKey('2025-02-29')).toBe(false)
    expect(isDateKey('2026-13-01')).toBe(false)
    expect(isDateKey('2026-1-01')).toBe(false)
    expect(isDateKey('not-a-date')).toBe(false)
  })

  it('formats local dates without timezone shifting', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(toDateKey(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05')
    expect(todayKey(new Date(2026, 9, 3, 8))).toBe('2026-10-03')
  })

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    // DST transition dates in many zones must not skip/duplicate days
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 3)).toBe('2026-10-27')
  })

  it('counts days between keys', () => {
    expect(daysBetween('2026-10-01', '2026-10-08')).toBe(7)
    expect(daysBetween('2026-10-08', '2026-10-01')).toBe(-7)
    expect(daysBetween('2026-10-03', '2026-10-03')).toBe(0)
  })

  it('computes weekday and week starts for Sunday- and Monday-start weeks', () => {
    expect(weekdayOf('2026-10-03')).toBe(6) // Saturday
    expect(startOfWeek('2026-10-03', 1)).toBe('2026-09-28')
    expect(startOfWeek('2026-10-03', 0)).toBe('2026-09-27')
    expect(startOfWeek('2026-09-28', 1)).toBe('2026-09-28')
    expect(startOfWeek('2026-09-27', 1)).toBe('2026-09-21')
    expect(startOfWeek('2026-09-27', 0)).toBe('2026-09-27')
  })

  it('lists each day inclusively', () => {
    expect(eachDay('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
    expect(eachDay('2026-10-02', '2026-10-01')).toEqual([])
  })

  it('compares keys', () => {
    expect(compareDateKeys('2026-01-01', '2026-01-02')).toBe(-1)
    expect(compareDateKeys('2026-01-02', '2026-01-01')).toBe(1)
    expect(compareDateKeys('2026-01-01', '2026-01-01')).toBe(0)
  })

  it('computes age in completed years', () => {
    expect(ageOn('2000-10-03', '2026-10-03')).toBe(26)
    expect(ageOn('2000-10-04', '2026-10-03')).toBe(25)
    expect(ageOn('2010-01-01', '2026-10-03')).toBe(16)
  })

  it('converts keys to local dates and minutes of day', () => {
    const date = dateKeyToLocalDate('2026-10-03')
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 9, 3, 0])
    expect(minutesOfDay(new Date(2026, 9, 3, 13, 45))).toBe(825)
  })

  it('rejects malformed keys in arithmetic', () => {
    expect(() => addDays('2026/10/03', 1)).toThrow(RangeError)
  })
})
