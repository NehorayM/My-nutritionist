import { describe, expect, it } from 'vitest'
import { getWeekWindow, isInWeek } from './week'

// 2026-10-04 is a Sunday; 2026-10-05 a Monday; 2026-10-07 a Wednesday.
describe('getWeekWindow', () => {
  it('uses Monday-start weeks when weekStartsOn is 1 (Sunday is the last day)', () => {
    expect(getWeekWindow('2026-10-04', 1)).toEqual({
      start: '2026-09-28',
      end: '2026-10-04',
      today: '2026-10-04',
      daysElapsed: 6,
      daysRemaining: 1,
    })
  })

  it('uses Sunday-start weeks when weekStartsOn is 0 (Sunday is the first day)', () => {
    expect(getWeekWindow('2026-10-04', 0)).toEqual({
      start: '2026-10-04',
      end: '2026-10-10',
      today: '2026-10-04',
      daysElapsed: 0,
      daysRemaining: 7,
    })
  })

  it('places a midweek day correctly for both week starts', () => {
    expect(getWeekWindow('2026-10-07', 1)).toMatchObject({ start: '2026-10-05', end: '2026-10-11', daysElapsed: 2, daysRemaining: 5 })
    expect(getWeekWindow('2026-10-07', 0)).toMatchObject({ start: '2026-10-04', end: '2026-10-10', daysElapsed: 3, daysRemaining: 4 })
  })

  it('handles the first day of a Monday-start week', () => {
    expect(getWeekWindow('2026-10-05', 1)).toMatchObject({ start: '2026-10-05', daysElapsed: 0, daysRemaining: 7 })
  })

  it('spans month and year boundaries', () => {
    // 2027-01-01 is a Friday.
    expect(getWeekWindow('2027-01-01', 1)).toMatchObject({ start: '2026-12-28', end: '2027-01-03', daysElapsed: 4 })
    expect(getWeekWindow('2027-01-01', 0)).toMatchObject({ start: '2026-12-27', end: '2027-01-02', daysElapsed: 5 })
  })

  it('is not affected by daylight-saving transitions', () => {
    // US DST ends 2026-11-01 and EU DST ends 2026-10-25 (both Sundays).
    expect(getWeekWindow('2026-11-01', 1)).toMatchObject({ start: '2026-10-26', end: '2026-11-01', daysRemaining: 1 })
    expect(getWeekWindow('2026-10-27', 0)).toMatchObject({ start: '2026-10-25', end: '2026-10-31' })
  })

  it('rejects malformed or impossible dates', () => {
    expect(() => getWeekWindow('2026-10-4', 1)).toThrow(RangeError)
    expect(() => getWeekWindow('2026-02-30', 0)).toThrow(RangeError)
  })
})

describe('isInWeek', () => {
  const week = { start: '2026-10-05', end: '2026-10-11' }

  it('includes both boundary days', () => {
    expect(isInWeek('2026-10-05', week)).toBe(true)
    expect(isInWeek('2026-10-11', week)).toBe(true)
    expect(isInWeek('2026-10-08', week)).toBe(true)
  })

  it('excludes days outside the week and invalid keys', () => {
    expect(isInWeek('2026-10-04', week)).toBe(false)
    expect(isInWeek('2026-10-12', week)).toBe(false)
    expect(isInWeek('not-a-date', week)).toBe(false)
  })
})
