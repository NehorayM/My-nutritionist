import { describe, expect, it } from 'vitest'
import { compareDateKeys } from '@/domain/dates'
import { FORBIDDEN_COPY, allOptions, catchUpFor, plan, scheduledSession, workout } from './__fixtures__/workouts'
import { catchUpMinutes } from './catchUp'
import { categoryOf } from './progress'
import type { CatchUpSuggestion } from './types'

// Monday-start week: Mon 2026-10-05 … Sun 2026-10-11.
const MON = '2026-10-05'
const TUE = '2026-10-06'
const WED = '2026-10-07'
const THU = '2026-10-08'
const FRI = '2026-10-09'
const SAT = '2026-10-10'
const SUN = '2026-10-11'

function dates(suggestions: readonly CatchUpSuggestion[]): string[] {
  return suggestions.map((suggestion) => suggestion.date)
}

describe('planCatchUp status', () => {
  it('is no_plan without weekly targets', () => {
    const result = catchUpFor(WED, plan(0, 0), [workout(MON, 'run')])
    expect(result).toMatchObject({ status: 'no_plan', suggestions: [], alternatives: [], deferredSessions: 0 })
    expect(result.message).toContain('Profile')
  })

  it('is complete when the target is met or exceeded', () => {
    const met = catchUpFor(THU, plan(1, 1), [workout(MON, 'strength'), workout(WED, 'run')])
    expect(met).toMatchObject({ status: 'complete', suggestions: [], alternatives: [], deferredSessions: 0 })
    const exceeded = catchUpFor(THU, plan(1, 1), [workout(MON, 'strength'), workout(TUE, 'run'), workout(WED, 'cycling')])
    expect(exceeded.status).toBe('complete')
  })

  it('is on_track with a full spread-out plan at the start of a week with no activity', () => {
    const result = catchUpFor(MON, plan(2, 2))
    expect(result.status).toBe('on_track')
    expect(result.deferredSessions).toBe(0)
    expect(result.suggestions).toHaveLength(4)
    expect(new Set(dates(result.suggestions)).size).toBe(4)
    expect(result.message).toBe("You're on track this week. Here's one way to fit the remaining four sessions.")
  })

  it('is catch_up when behind early in the week but everything still fits', () => {
    const result = catchUpFor(WED, plan(2, 2))
    expect(result.status).toBe('catch_up')
    expect(result.deferredSessions).toBe(0)
    expect(result.suggestions).toHaveLength(4)
    for (const date of dates(result.suggestions)) {
      expect(compareDateKeys(date, WED)).toBeGreaterThanOrEqual(0)
      expect(compareDateKeys(date, SUN)).toBeLessThanOrEqual(0)
    }
    expect(result.message).toMatch(/^Four planned sessions remain this week\./)
  })

  it('is limited late in the week and defers what cannot fit safely', () => {
    const result = catchUpFor(SAT, plan(2, 2), [workout(TUE, 'cycling')])
    expect(result.status).toBe('limited')
    expect(result.deferredSessions).toBe(1)
    expect(dates(result.suggestions)).toEqual([SAT, SUN])
    expect(result.suggestions.map((suggestion) => suggestion.category).sort()).toEqual(['cardio', 'strength'])
    expect(result.message).toBe(
      'Two of the three remaining sessions fit safely this week. The other one can carry over to next week — rest is part of the plan.',
    )
  })

  it('defers everything on the last day when a workout is already logged', () => {
    const result = catchUpFor(SUN, plan(2, 2), [workout(SUN, 'walk')])
    expect(result).toMatchObject({ status: 'limited', suggestions: [], alternatives: [], deferredSessions: 3 })
    expect(result.message).toMatch(/^No free days are left this week\./)
  })

  it('uses the last day when it is still free', () => {
    const result = catchUpFor(SUN, plan(0, 1))
    expect(result.status).toBe('catch_up')
    expect(dates(result.suggestions)).toEqual([SUN])
    expect(result.suggestions[0]?.rationale).toContain('today')
  })

  it('starts tomorrow when a workout is already logged today', () => {
    const result = catchUpFor(WED, plan(1, 2), [workout(WED, 'walk', { durationMin: 30 })])
    expect(result.suggestions.length).toBeGreaterThan(0)
    for (const date of dates(result.suggestions)) expect(compareDateKeys(date, THU)).toBeGreaterThanOrEqual(0)
  })

  it('is on_track with no suggestions when every open session is already scheduled', () => {
    const scheduled = [scheduledSession(FRI, 'strength'), scheduledSession(SAT, 'run')]
    const result = catchUpFor(THU, plan(1, 1), [], { scheduled })
    expect(result).toMatchObject({ status: 'on_track', suggestions: [], deferredSessions: 0 })
    expect(result.message).toBe('Your remaining sessions are already scheduled for this week.')
  })

  it('recomputes against the current plan when the plan changes midweek', () => {
    const logged = [workout(MON, 'strength'), workout(TUE, 'run')]
    expect(catchUpFor(WED, plan(1, 1), logged).status).toBe('complete')
    const raised = catchUpFor(WED, plan(3, 3), logged)
    expect(raised.status).toBe('on_track')
    expect(raised.suggestions).toHaveLength(4)
    expect(raised.suggestions.filter((suggestion) => suggestion.category === 'strength')).toHaveLength(2)
  })
})

describe('planCatchUp suggestion content', () => {
  it('suggests specific, moderate sessions with neutral rationale', () => {
    const result = catchUpFor(WED, plan(2, 2))
    for (const suggestion of allOptions(result).flat()) {
      expect(suggestion.durationMin === 40 || suggestion.durationMin === 30).toBe(true)
      expect(suggestion.intensity).not.toBe('vigorous')
      expect(categoryOf(suggestion.type)).toBe(suggestion.category)
      expect(suggestion.id).toBe(`catch-up:${suggestion.date}:${suggestion.type}:${suggestion.durationMin}`)
      expect(suggestion.rationale).toMatch(/^Four planned sessions remain this week\. A \d+-minute /)
      expect(suggestion.rationale).not.toMatch(FORBIDDEN_COPY)
    }
    expect(result.message).not.toMatch(FORBIDDEN_COPY)
  })

  it('describes strength as full-body only for up to two strength sessions a week', () => {
    const twice = catchUpFor(MON, plan(2, 0))
    expect(twice.suggestions.every((suggestion) => suggestion.rationale.includes('full-body strength session'))).toBe(true)
    const thrice = catchUpFor(MON, plan(3, 0))
    expect(thrice.suggestions.some((suggestion) => suggestion.rationale.includes('full-body'))).toBe(false)
  })

  it('suggests a brisk walk without cardio history and the most frequent type with it', () => {
    expect(catchUpFor(WED, plan(0, 1)).suggestions[0]).toMatchObject({ type: 'walk', category: 'cardio' })
    const history = [workout('2026-09-29', 'cycling'), workout('2026-10-01', 'cycling'), workout('2026-10-03', 'swimming')]
    const result = catchUpFor(WED, plan(0, 1), [], { recentWorkouts: history })
    expect(result.suggestions[0]?.type).toBe('cycling')
    expect(result.suggestions[0]?.rationale).toContain('bike ride')
  })

  it('offers a shorter-session option and a cardio variant among the options', () => {
    const options = [0, 1, 2, 3].flatMap((variant) => allOptions(catchUpFor(MON, plan(1, 1), [], { variant })))
    expect(options.some((option) => option.every((suggestion) => suggestion.durationMin === 30))).toBe(true)
    expect(options.some((option) => option.some((suggestion) => suggestion.type === 'cardio'))).toBe(true)
  })

  it('uses the preferred length, clamped to 20–60 minutes', () => {
    expect(catchUpFor(MON, plan(0, 1), [], { preferredMinutes: 90 }).suggestions[0]?.durationMin).toBe(60)
    expect(catchUpFor(MON, plan(0, 1), [], { preferredMinutes: 10 }).suggestions[0]?.durationMin).toBe(20)
    expect(catchUpFor(MON, plan(0, 1), [], { preferredMinutes: null }).suggestions[0]?.durationMin).toBe(40)
  })
})

describe('catchUpMinutes', () => {
  it('rounds to 5 minutes and clamps to 20–60', () => {
    expect(catchUpMinutes(33)).toBe(35)
    expect(catchUpMinutes(45)).toBe(45)
    expect(catchUpMinutes(0)).toBe(20)
    expect(catchUpMinutes(-30)).toBe(20)
    expect(catchUpMinutes(240)).toBe(60)
  })

  it('falls back to 40 minutes for missing or non-numeric values', () => {
    expect(catchUpMinutes(null)).toBe(40)
    expect(catchUpMinutes(Number.NaN)).toBe(40)
    expect(catchUpMinutes(Number.POSITIVE_INFINITY)).toBe(40)
  })
})
