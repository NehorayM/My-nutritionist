import { describe, expect, it } from 'vitest'
import { compareDateKeys, daysBetween } from '@/domain/dates'
import { allOptions, catchUpFor, plan, scheduledSession, session, workout } from './__fixtures__/workouts'
import type { CatchUpSuggestion } from './types'

// Monday-start week: Mon 2026-10-05 … Sun 2026-10-11. Sunday 2026-10-04 belongs to the previous week.
const LAST_SUN = '2026-10-04'
const MON = '2026-10-05'
const TUE = '2026-10-06'
const WED = '2026-10-07'
const THU = '2026-10-08'
const FRI = '2026-10-09'
const SAT = '2026-10-10'

const strengthDays = (suggestions: readonly CatchUpSuggestion[]): string[] =>
  suggestions.filter((suggestion) => suggestion.category === 'strength').map((suggestion) => suggestion.date)

describe('planCatchUp recovery spacing', () => {
  it('does not suggest strength the day after a strength session', () => {
    const result = catchUpFor(TUE, plan(2, 0), [workout(MON, 'strength')])
    expect(result.suggestions).toHaveLength(1)
    for (const option of allOptions(result)) {
      for (const date of strengthDays(option)) expect(compareDateKeys(date, WED)).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps the day after a vigorous session free of strength and vigorous work', () => {
    const result = catchUpFor(TUE, plan(1, 2), [session(MON, 'run', 'vigorous')])
    for (const option of allOptions(result)) expect(strengthDays(option)).not.toContain(TUE)
    const onTuesday = allOptions(result).flat().filter((suggestion) => suggestion.date === TUE)
    expect(onTuesday.every((suggestion) => suggestion.category === 'cardio' && suggestion.intensity === 'light')).toBe(true)
    // With only two days left, cardio has to go on the day after the vigorous run — it becomes light.
    const forced = catchUpFor(SAT, plan(0, 3), [session(FRI, 'run', 'vigorous')])
    expect(forced.suggestions.map((suggestion) => [suggestion.date, suggestion.intensity])).toEqual([
      [SAT, 'light'],
      ['2026-10-11', 'moderate'],
    ])
    expect(forced.suggestions[0]?.rationale).toContain("easy run today keeps the effort easy after yesterday's harder session")
  })

  it('treats HIIT as a hard session whatever intensity was logged', () => {
    const result = catchUpFor(TUE, plan(1, 0), [session(MON, 'hiit', 'light', 20)])
    expect(strengthDays(result.suggestions)).not.toContain(TUE)
  })

  it("respects recovery across the week boundary using last week's sessions", () => {
    const lastWeek = [workout(LAST_SUN, 'strength')]
    const result = catchUpFor(MON, plan(1, 0), [], { recentWorkouts: lastWeek })
    expect(strengthDays(result.suggestions)).toEqual([TUE])
    expect(result.suggestions[0]?.rationale).toBe(
      "One planned session remains this week. A 40-minute full-body strength session tomorrow leaves a recovery day after yesterday's session.",
    )
    expect(catchUpFor(MON, plan(1, 0)).suggestions[0]?.date).toBe(MON)
    const unusable = [workout(LAST_SUN, 'strength', { durationMin: 0 }), workout('2026-10-4', 'strength')]
    expect(catchUpFor(MON, plan(1, 0), [], { recentWorkouts: unusable }).suggestions[0]?.date).toBe(MON)
  })

  it('makes cardio light the day after a vigorous session last week', () => {
    // Seven cardio sessions need every day, so Monday must follow last Sunday's vigorous swim.
    const result = catchUpFor(MON, plan(0, 7), [], { recentWorkouts: [session(LAST_SUN, 'swimming', 'vigorous')] })
    expect(result.suggestions).toHaveLength(7)
    expect(result.suggestions[0]).toMatchObject({ date: MON, intensity: 'light', type: 'swimming' })
    expect(result.suggestions.slice(1).every((suggestion) => suggestion.intensity === 'moderate')).toBe(true)
  })

  it('keeps strength away from the day before a planned strength session', () => {
    const scheduled = [scheduledSession(WED, 'strength')]
    const result = catchUpFor(TUE, plan(2, 0), [], { scheduled })
    for (const option of allOptions(result)) {
      expect(strengthDays(option)).not.toContain(TUE)
      expect(strengthDays(option)).not.toContain(THU)
    }
    expect(result.suggestions).toHaveLength(1)
  })

  it('never suggests strength on consecutive days or any vigorous session', () => {
    const result = catchUpFor(MON, plan(3, 2))
    expect(result.deferredSessions).toBe(0)
    for (const option of allOptions(result)) {
      const strength = strengthDays(option)
      for (let i = 1; i < strength.length; i += 1) expect(daysBetween(strength[i - 1]!, strength[i]!)).toBeGreaterThanOrEqual(2)
      expect(option.every((suggestion) => suggestion.intensity !== 'vigorous')).toBe(true)
    }
  })
})

describe('planCatchUp one session per day', () => {
  it('never stacks sessions; the rest is deferred', () => {
    const result = catchUpFor(FRI, plan(0, 5))
    expect(result.suggestions).toHaveLength(3)
    expect(new Set(result.suggestions.map((suggestion) => suggestion.date)).size).toBe(3)
    expect(result.deferredSessions).toBe(2)
    expect(result.status).toBe('limited')
    for (const option of allOptions(result)) expect(new Set(option.map((suggestion) => suggestion.date)).size).toBe(option.length)
  })

  it('defers sessions that only fit by putting strength on back-to-back days', () => {
    const result = catchUpFor(SAT, plan(2, 0))
    expect(result.suggestions).toHaveLength(1)
    expect(result.deferredSessions).toBe(1)
  })
})

describe('planCatchUp scheduled sessions', () => {
  it('counts planned sessions and keeps their days free of suggestions', () => {
    const result = catchUpFor(MON, plan(1, 1), [], { scheduled: [scheduledSession(WED, 'strength')] })
    expect(result.suggestions).toHaveLength(1)
    for (const option of allOptions(result)) {
      expect(option.map((suggestion) => suggestion.category)).toEqual(['cardio'])
      expect(option.map((suggestion) => suggestion.date)).not.toContain(WED)
    }
    expect(result.suggestions[0]?.rationale).toMatch(/^One planned session remains this week\./)
  })

  it('ignores completed, dismissed, past and already linked scheduled sessions', () => {
    const logged = workout(WED, 'strength', { scheduledWorkoutId: 'sch-linked' })
    const ignored = [
      scheduledSession(THU, 'strength', { id: 'done', status: 'completed' }),
      scheduledSession(FRI, 'strength', { id: 'skip', status: 'dismissed' }),
      scheduledSession(TUE, 'strength', { id: 'past' }),
      scheduledSession(WED, 'strength', { id: 'sch-linked' }),
      scheduledSession(SAT, 'strength', { id: 'marked', completedWorkoutId: 'other' }),
    ]
    const withIgnored = catchUpFor(WED, plan(2, 1), [logged], { scheduled: ignored })
    const without = catchUpFor(WED, plan(2, 1), [logged])
    expect(withIgnored).toEqual(without)
    expect(strengthDays(withIgnored.suggestions)).toHaveLength(1)
  })

  it('lets uncounted planned sessions occupy their day without reducing what is needed', () => {
    const scheduled = [scheduledSession(TUE, 'mobility'), scheduledSession(WED, 'walk', { durationMin: 15 })]
    const result = catchUpFor(MON, plan(0, 2), [], { scheduled })
    expect(result.suggestions).toHaveLength(2)
    for (const option of allOptions(result)) {
      for (const suggestion of option) expect([TUE, WED]).not.toContain(suggestion.date)
    }
  })
})

describe('planCatchUp dismissals', () => {
  it('excludes dismissed suggestion ids from every option and finds another day', () => {
    const first = catchUpFor(MON, plan(1, 1))
    const dismissed = first.suggestions[0]!.id
    const result = catchUpFor(MON, plan(1, 1), [], { dismissedIds: [dismissed] })
    expect(result.suggestions).toHaveLength(first.suggestions.length)
    expect(allOptions(result).flat().map((suggestion) => suggestion.id)).not.toContain(dismissed)
    expect(result.deferredSessions).toBe(0)
  })

  it('reports when every possible suggestion was dismissed', () => {
    const sunday = '2026-10-11'
    const dismissedIds = [`catch-up:${sunday}:walk:40`, `catch-up:${sunday}:cardio:40`, `catch-up:${sunday}:walk:30`]
    const result = catchUpFor(sunday, plan(0, 1), [], { dismissedIds })
    expect(result).toMatchObject({ status: 'catch_up', suggestions: [], alternatives: [], deferredSessions: 0 })
    expect(result.message).toBe(
      'One planned session remains this week. You dismissed the suggestions for this week; you can still log a session whenever it suits you.',
    )
  })
})

describe('planCatchUp variants', () => {
  it('is deterministic for the same input, whatever the input order', () => {
    const logged = [workout(MON, 'strength', { id: 'a' }), workout(TUE, 'cycling', { id: 'b' }), workout(LAST_SUN, 'run', { id: 'c' })]
    const first = catchUpFor(WED, plan(2, 3), logged, { variant: 1 })
    expect(catchUpFor(WED, plan(2, 3), [...logged].reverse(), { variant: 1 })).toEqual(first)
  })

  it('rotates through complete options: the next variant leads with the first alternative', () => {
    const v0 = catchUpFor(MON, plan(2, 2), [], { variant: 0 })
    const v1 = catchUpFor(MON, plan(2, 2), [], { variant: 1 })
    expect(v0.alternatives.length).toBeGreaterThan(0)
    expect(v0.alternatives.length).toBeLessThanOrEqual(2)
    expect(v1.suggestions).toEqual(v0.alternatives[0])
    for (const option of v0.alternatives) {
      expect(option).toHaveLength(v0.suggestions.length)
      expect(option).not.toEqual(v0.suggestions)
    }
  })

  it('cycles with a fixed period and accepts negative or non-numeric variants', () => {
    const primaries = Array.from({ length: 12 }, (_, variant) => catchUpFor(MON, plan(1, 1), [], { variant }).suggestions)
    const period = new Set(primaries.map((option) => JSON.stringify(option))).size
    expect(period).toBeGreaterThan(1)
    expect(primaries[period]).toEqual(primaries[0])
    expect(catchUpFor(MON, plan(1, 1), [], { variant: -1 }).suggestions).toEqual(primaries[period - 1])
    expect(catchUpFor(MON, plan(1, 1), [], { variant: Number.NaN }).suggestions).toEqual(primaries[0])
    expect(catchUpFor(MON, plan(1, 1), [], { variant: 1.9 }).suggestions).toEqual(primaries[1])
  })
})
