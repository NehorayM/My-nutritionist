import { describe, expect, it } from 'vitest'
import { addDays, compareDateKeys, daysBetween } from '@/domain/dates'
import type { WorkoutEntry } from '@/types'
import { FORBIDDEN_COPY, allOptions, catchUpFor, plan, progressFor, session, workout } from './__fixtures__/workouts'
import { planCatchUp } from './catchUp'
import { isHardSession } from './recovery'
import type { CatchUpSuggestion } from './types'

// Monday-start week: Mon 2026-10-05 … Sun 2026-10-11. Sunday-start week: Sun 2026-10-04 … Sat 2026-10-10.
const MON = '2026-10-05'
const THU = '2026-10-08'
const FRI = '2026-10-09'
const SAT = '2026-10-10'
const SUN = '2026-10-11'

/** Matches the `rationale` length check on scheduled_workouts. */
const MAX_RATIONALE_LENGTH = 300

function expectSafe(option: readonly CatchUpSuggestion[], logged: readonly WorkoutEntry[]): void {
  const dates = option.map((suggestion) => suggestion.date)
  expect(new Set(dates).size).toBe(dates.length)
  const demanding = new Set(logged.filter((entry) => entry.type === 'strength' || isHardSession(entry)).map((entry) => entry.date))
  for (const suggestion of option) {
    expect(suggestion.intensity).not.toBe('vigorous')
    expect(suggestion.durationMin).toBeGreaterThanOrEqual(20)
    expect(suggestion.durationMin).toBeLessThanOrEqual(60)
    expect(suggestion.rationale.length).toBeLessThanOrEqual(MAX_RATIONALE_LENGTH)
    expect(suggestion.rationale).not.toMatch(FORBIDDEN_COPY)
    if (suggestion.category !== 'strength') continue
    const before = addDays(suggestion.date, -1)
    expect(demanding.has(before)).toBe(false)
    expect(option.some((other) => other.category === 'strength' && other.date === before)).toBe(false)
  }
}

describe('planCatchUp with a Sunday-start week', () => {
  it('ends the week on Saturday and starts the next one on Sunday', () => {
    const sundayStart = planCatchUp({
      progress: progressFor(THU, plan(1, 2), [], 0),
      recentWorkouts: [],
      scheduled: [],
      preferredMinutes: 40,
      dismissedIds: [],
      variant: 0,
    })
    expect(sundayStart).toMatchObject({ status: 'catch_up', deferredSessions: 0 })
    for (const option of allOptions(sundayStart)) {
      for (const suggestion of option) expect(compareDateKeys(suggestion.date, SAT)).toBeLessThanOrEqual(0)
    }
    expect(sundayStart.suggestions.map((suggestion) => suggestion.date)).toEqual([THU, FRI, SAT])
    // The same Thursday in a Monday-start week can still use Sunday.
    expect(allOptions(catchUpFor(THU, plan(1, 2))).flat().some((suggestion) => suggestion.date === SUN)).toBe(true)
  })
})

describe('planCatchUp late in the week', () => {
  it('fits the rest one per day and alternates categories when everything still fits', () => {
    const result = catchUpFor(FRI, plan(1, 2))
    expect(result).toMatchObject({ status: 'catch_up', deferredSessions: 0 })
    expect(result.suggestions.map((suggestion) => [suggestion.date, suggestion.category])).toEqual([
      [FRI, 'cardio'],
      [SAT, 'strength'],
      [SUN, 'cardio'],
    ])
    expect(result.message).toBe('Three planned sessions remain this week. These suggestions spread them out with recovery days in between.')
  })

  it('leaves Saturday free of strength after a vigorous Friday and keeps Saturday cardio light', () => {
    const logged = [session(FRI, 'cycling', 'vigorous')]
    const result = catchUpFor(SAT, plan(1, 2), logged)
    expect(result.suggestions.map((suggestion) => [suggestion.date, suggestion.category, suggestion.intensity])).toEqual([
      [SAT, 'cardio', 'light'],
      [SUN, 'strength', 'moderate'],
    ])
    expect(result.suggestions[1]?.rationale).toContain("strength session tomorrow leaves a recovery day after yesterday's session")
  })
})

describe('planCatchUp safety across many weeks and plans', () => {
  const plans = [plan(1, 1), plan(2, 2), plan(3, 2), plan(1, 4), plan(4, 0), plan(0, 6), plan(5, 5)]
  const histories: WorkoutEntry[][] = [
    [],
    [workout(addDays(MON, -1), 'strength'), session(addDays(MON, -2), 'run', 'vigorous')],
    [workout(MON, 'strength'), session(addDays(MON, 1), 'hiit', 'moderate', 25), workout(addDays(MON, 2), 'walk', { durationMin: 45 })],
  ]

  it('never stacks, never spaces strength unsafely and accounts for every open session', () => {
    for (let offset = 0; offset < 7; offset += 1) {
      const today = addDays(MON, offset)
      for (const weeklyPlan of plans) {
        for (const history of histories) {
          const logged = history.filter((entry) => compareDateKeys(entry.date, today) <= 0)
          const result = catchUpFor(today, weeklyPlan, logged)
          const progress = progressFor(today, weeklyPlan, logged)
          expect(result.status === 'complete').toBe(progress.totalRemaining === 0)
          expect(result.suggestions.length + result.deferredSessions).toBe(progress.totalRemaining)
          expect(result.status === 'limited').toBe(result.deferredSessions > 0)
          expect(result.alternatives.length).toBeLessThanOrEqual(2)
          expect(result.message).not.toMatch(FORBIDDEN_COPY)
          for (const option of allOptions(result)) {
            expect(option).toHaveLength(result.suggestions.length)
            for (const suggestion of option) {
              expect(compareDateKeys(suggestion.date, today)).toBeGreaterThanOrEqual(0)
              expect(daysBetween(suggestion.date, SUN)).toBeGreaterThanOrEqual(0)
              expect(logged.some((entry) => entry.date === suggestion.date)).toBe(false)
            }
            expectSafe(option, logged)
          }
        }
      }
    }
  })
})
