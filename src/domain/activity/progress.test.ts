import { describe, expect, it } from 'vitest'
import { WORKOUT_TYPES } from '@/types'
import type { WorkoutType } from '@/types'
import { plan, progressFor, session, workout } from './__fixtures__/workouts'
import { categoryOf, computeWeeklyProgress, countsToward, expectedSessions } from './progress'

// Monday-start week: Mon 2026-10-05 … Sun 2026-10-11.
const MON = '2026-10-05'
const TUE = '2026-10-06'
const WED = '2026-10-07'
const THU = '2026-10-08'
const SAT = '2026-10-10'
const SUN = '2026-10-11'

describe('categoryOf', () => {
  it('maps every workout type to its plan category', () => {
    const mapping = Object.fromEntries(WORKOUT_TYPES.map((type) => [type, categoryOf(type)]))
    expect(mapping).toEqual({
      strength: 'strength',
      cardio: 'cardio',
      hiit: 'cardio',
      walk: 'cardio',
      run: 'cardio',
      cycling: 'cardio',
      swimming: 'cardio',
      mobility: null,
      sports: null,
      other: null,
    })
  })

  it('returns null for an unknown stored type', () => {
    expect(categoryOf('zumba' as WorkoutType)).toBeNull()
  })
})

describe('countsToward', () => {
  it('counts a walk toward cardio only from 20 minutes', () => {
    expect(countsToward({ type: 'walk', durationMin: 19 })).toBeNull()
    expect(countsToward({ type: 'walk', durationMin: 20 })).toBe('cardio')
    expect(countsToward({ type: 'walk', durationMin: Number.NaN })).toBeNull()
  })

  it('does not apply the duration rule to other types', () => {
    expect(countsToward({ type: 'run', durationMin: 10 })).toBe('cardio')
    expect(countsToward({ type: 'strength', durationMin: 15 })).toBe('strength')
    expect(countsToward({ type: 'mobility', durationMin: 60 })).toBeNull()
  })
})

describe('expectedSessions', () => {
  it('spreads the plan evenly, rounding down', () => {
    expect(expectedSessions(4, 0)).toBe(0)
    expect(expectedSessions(4, 3)).toBe(2)
    expect(expectedSessions(3, 2)).toBe(1)
    expect(expectedSessions(5, 6)).toBe(5)
  })
})

describe('computeWeeklyProgress', () => {
  it('reports no_plan when nothing is planned, while still totalling minutes', () => {
    const result = progressFor(WED, plan(0, 0), [workout(MON, 'run', { durationMin: 30 })])
    expect(result).toMatchObject({ adherence: 'no_plan', totalPlanned: 0, percent: 1, totalMinutes: 30, totalCompleted: 1 })
  })

  it('handles a week with no activity', () => {
    const monday = progressFor(MON, plan(2, 2))
    expect(monday).toMatchObject({ adherence: 'on_track', totalCompleted: 0, totalRemaining: 4, percent: 0, totalMinutes: 0 })
    expect(monday.workouts).toEqual([])
    expect(monday.minutesByType).toEqual({})
    expect(progressFor(THU, plan(2, 2)).adherence).toBe('behind')
  })

  it('is complete when every category reaches its target', () => {
    const result = progressFor(THU, plan(1, 2), [workout(MON, 'strength'), workout(TUE, 'run'), workout(WED, 'swimming')])
    expect(result).toMatchObject({ adherence: 'complete', totalRemaining: 0, percent: 1, totalCompleted: 3 })
    expect(result.categories).toEqual([
      { category: 'strength', planned: 1, completed: 1, remaining: 0, percent: 1 },
      { category: 'cardio', planned: 2, completed: 2, remaining: 0, percent: 1 },
    ])
  })

  it('clamps percent when the target is exceeded but keeps the raw completed count', () => {
    const result = progressFor(THU, plan(1, 1), [
      workout(MON, 'strength'),
      workout(TUE, 'strength'),
      workout(WED, 'cycling'),
      workout(THU, 'hiit'),
    ])
    expect(result).toMatchObject({ adherence: 'complete', totalCompleted: 4, totalRemaining: 0, percent: 1 })
    expect(result.categories[0]).toMatchObject({ completed: 2, remaining: 0, percent: 1 })
  })

  it('does not let extra sessions in one category hide open sessions in the other', () => {
    const result = progressFor(THU, plan(1, 1), [workout(MON, 'strength'), workout(WED, 'strength')])
    expect(result).toMatchObject({ adherence: 'on_track', totalCompleted: 2, totalRemaining: 1, percent: 0.5 })
  })

  it('applies the on_track threshold floor(planned × daysIncludingToday / 7)', () => {
    // Wednesday: floor(3 × 3 / 7) = 1 session expected.
    expect(progressFor(WED, plan(0, 3), [workout(MON, 'run')]).adherence).toBe('on_track')
    expect(progressFor(WED, plan(0, 3)).adherence).toBe('behind')
  })

  it('is behind early in the week and at_risk when the rest no longer fits safely', () => {
    expect(progressFor(MON, plan(2, 2)).adherence).toBe('on_track')
    // Tuesday: floor(4 × 2 / 7) = 1 session expected.
    expect(progressFor(TUE, plan(2, 2)).adherence).toBe('behind')
    // Saturday with two strength sessions open: Sat + Sun would be back-to-back strength days.
    expect(progressFor(SAT, plan(2, 0)).adherence).toBe('at_risk')
    // Saturday with one strength and one cardio open fits (one per day).
    expect(progressFor(SAT, plan(1, 1)).adherence).toBe('behind')
  })

  it('is at_risk on the last day when a session is already logged and others remain', () => {
    expect(progressFor(SUN, plan(2, 2), [workout(SUN, 'walk')]).adherence).toBe('at_risk')
  })

  it('uses last week for recovery spacing when judging what still fits', () => {
    // Sunday (week start 0) with one strength session open and strength logged yesterday (previous week).
    const yesterday = workout('2026-10-10', 'strength')
    expect(progressFor('2026-10-11', plan(1, 0), [], 0).adherence).toBe('on_track')
    const result = computeWeeklyProgress({ workouts: [yesterday], plan: plan(2, 0), today: SAT, weekStartsOn: 0 })
    expect(result.adherence).toBe('at_risk')
  })

  it('counts only workouts inside the week', () => {
    const result = progressFor(WED, plan(1, 1), [workout('2026-10-04', 'strength'), workout('2026-10-12', 'run'), workout(TUE, 'run')])
    expect(result.workouts.map((entry) => entry.date)).toEqual([TUE])
    expect(result.categories.map((entry) => entry.completed)).toEqual([0, 1])
  })

  it('counts the same Sunday in different weeks depending on the week start', () => {
    const sunday = workout('2026-10-04', 'strength')
    expect(progressFor('2026-10-05', plan(1, 0), [sunday], 1).totalCompleted).toBe(0)
    expect(progressFor('2026-10-05', plan(1, 0), [sunday], 0).totalCompleted).toBe(1)
  })

  it('adds minutes for every type, including short walks and uncategorised activity', () => {
    const result = progressFor(THU, plan(0, 2), [
      workout(MON, 'walk', { durationMin: 15 }),
      workout(TUE, 'walk', { durationMin: 25 }),
      workout(TUE, 'mobility', { durationMin: 30 }),
      workout(WED, 'sports', { durationMin: 60 }),
    ])
    expect(result.minutesByType).toEqual({ walk: 40, mobility: 30, sports: 60 })
    expect(result.totalMinutes).toBe(130)
    expect(result.categories[1]).toMatchObject({ completed: 1, remaining: 1 })
  })

  it('ignores workouts with an invalid date or duration', () => {
    const result = progressFor(THU, plan(0, 3), [
      workout('2026-13-01', 'run'),
      workout(MON, 'run', { durationMin: 0 }),
      workout(TUE, 'run', { durationMin: Number.NaN }),
      workout(WED, 'run', { durationMin: 30 }),
    ])
    expect(result.workouts).toHaveLength(1)
    expect(result.totalMinutes).toBe(30)
  })

  it('sorts workouts by date, then creation time, then id', () => {
    const late = workout(TUE, 'run', { id: 'b', createdAt: '2026-10-06T18:00:00Z' })
    const early = workout(TUE, 'walk', { id: 'c', createdAt: '2026-10-06T07:00:00Z' })
    const sameTime = workout(TUE, 'cycling', { id: 'a', createdAt: '2026-10-06T18:00:00Z' })
    const monday = workout(MON, 'strength', { id: 'z' })
    const result = progressFor(WED, plan(1, 1), [late, sameTime, monday, early])
    expect(result.workouts.map((entry) => entry.id)).toEqual(['z', 'c', 'a', 'b'])
  })

  it('recomputes against the current plan when the plan changes midweek', () => {
    const logged = [workout(MON, 'strength'), workout(TUE, 'run')]
    expect(progressFor(WED, plan(1, 1), logged).adherence).toBe('complete')
    const raised = progressFor(WED, plan(3, 3), logged)
    expect(raised).toMatchObject({ adherence: 'on_track', totalPlanned: 6, totalRemaining: 4 })
    expect(progressFor(THU, plan(3, 3), logged).adherence).toBe('behind')
    // Six sessions open with four days left cannot fit at one per day.
    expect(progressFor(THU, plan(4, 4), logged).adherence).toBe('at_risk')
  })

  it('sanitises planned counts (negative, fractional, too large, not a number)', () => {
    const result = progressFor(WED, plan(-2, 2.7))
    expect(result.categories.map((entry) => entry.planned)).toEqual([0, 2])
    expect(progressFor(WED, plan(20, Number.NaN)).categories.map((entry) => entry.planned)).toEqual([14, 0])
  })

  it('treats a vigorous session like any other session for counting', () => {
    const result = progressFor(WED, plan(0, 1), [session(MON, 'run', 'vigorous', 25)])
    expect(result.adherence).toBe('complete')
  })
})
