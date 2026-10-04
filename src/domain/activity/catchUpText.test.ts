import { describe, expect, it } from 'vitest'
import { FORBIDDEN_COPY } from './__fixtures__/workouts'
import { catchUpMessage, countWord, rationaleFor, sessionLabel, whenPhrase } from './catchUpText'
import type { MessageCounts, SuggestionFacts, TextContext } from './catchUpText'

// Monday-start week 2026-10-05 … 2026-10-11; today is Monday.
const context: TextContext = { today: '2026-10-05', weekStart: '2026-10-05', remaining: 2, fullBody: true }
const strengthFacts: SuggestionFacts = {
  date: '2026-10-09',
  type: 'strength',
  durationMin: 40,
  intensity: 'moderate',
  lastDemandingDate: '2026-10-07',
  dayBefore: null,
}

describe('rationaleFor', () => {
  it('matches the reference wording for a spaced strength session', () => {
    expect(rationaleFor(strengthFacts, context)).toBe(
      "Two planned sessions remain this week. A 40-minute full-body strength session on Friday leaves a recovery day after Wednesday's session.",
    )
  })

  it('counts several recovery days and names relative days', () => {
    const thursday = { ...context, today: '2026-10-08' }
    expect(rationaleFor({ ...strengthFacts, lastDemandingDate: '2026-10-06' }, thursday)).toContain(
      "tomorrow leaves two recovery days after Tuesday's session",
    )
    expect(rationaleFor({ ...strengthFacts, date: '2026-10-08', lastDemandingDate: '2026-10-06' }, thursday)).toContain(
      "today leaves a recovery day after Tuesday's session",
    )
    expect(rationaleFor({ ...strengthFacts, lastDemandingDate: '2026-10-07' }, thursday)).toContain(
      "tomorrow leaves a recovery day after yesterday's session",
    )
    expect(rationaleFor({ ...strengthFacts, date: '2026-10-10', lastDemandingDate: '2026-10-08' }, thursday)).toContain(
      "after today's session",
    )
    expect(rationaleFor({ ...strengthFacts, date: '2026-10-11', lastDemandingDate: '2026-10-09' }, thursday)).toContain(
      "after tomorrow's session",
    )
  })

  it("refers to last week's sessions explicitly", () => {
    expect(rationaleFor({ ...strengthFacts, date: '2026-10-06', lastDemandingDate: '2026-10-03' }, context)).toContain(
      "tomorrow leaves two recovery days after last Saturday's session",
    )
  })

  it('falls back to a spacing note without a recent demanding session', () => {
    expect(rationaleFor({ ...strengthFacts, lastDemandingDate: null }, context)).toContain('keeps your strength sessions well spaced')
    expect(rationaleFor({ ...strengthFacts, lastDemandingDate: '2026-10-01' }, context)).toContain('keeps your strength sessions well spaced')
  })

  it('omits "full-body" when more strength sessions are planned', () => {
    expect(rationaleFor(strengthFacts, { ...context, fullBody: false })).toContain('A 40-minute strength session on Friday')
  })

  it('describes cardio after a hard day as easy and after strength as added cardio', () => {
    const cardio: SuggestionFacts = { ...strengthFacts, date: '2026-10-06', type: 'run', intensity: 'light', dayBefore: 'hard' }
    expect(rationaleFor(cardio, context)).toBe(
      "Two planned sessions remain this week. A 40-minute easy run tomorrow keeps the effort easy after today's harder session.",
    )
    const afterStrength = { ...cardio, type: 'cycling' as const, intensity: 'moderate' as const, dayBefore: 'strength' as const }
    expect(rationaleFor(afterStrength, context)).toContain("A 40-minute bike ride tomorrow adds some cardio after today's strength session.")
    const plain = { ...afterStrength, type: 'walk' as const, dayBefore: null, date: '2026-10-05' }
    expect(rationaleFor(plain, { ...context, remaining: 1 })).toBe(
      'One planned session remains this week. A 40-minute brisk walk today keeps your weekly cardio steady.',
    )
  })

  it('never mentions food, calories or judgemental words', () => {
    const variants: SuggestionFacts[] = [
      strengthFacts,
      { ...strengthFacts, type: 'swimming', intensity: 'light', dayBefore: 'hard' },
      { ...strengthFacts, type: 'cardio', dayBefore: 'strength' },
    ]
    for (const facts of variants) expect(rationaleFor(facts, context)).not.toMatch(FORBIDDEN_COPY)
  })
})

describe('labels and phrases', () => {
  it('labels sessions by type and intensity', () => {
    expect(sessionLabel('strength', 'moderate', true)).toBe('full-body strength session')
    expect(sessionLabel('strength', 'moderate', false)).toBe('strength session')
    expect(sessionLabel('walk', 'moderate', true)).toBe('brisk walk')
    expect(sessionLabel('walk', 'light', true)).toBe('easy walk')
    expect(sessionLabel('cardio', 'light', true)).toBe('easy cardio session')
  })

  it('names days relative to today', () => {
    expect(whenPhrase('2026-10-05', '2026-10-05')).toBe('today')
    expect(whenPhrase('2026-10-06', '2026-10-05')).toBe('tomorrow')
    expect(whenPhrase('2026-10-08', '2026-10-05')).toBe('on Thursday')
  })

  it('spells small numbers and keeps digits for larger ones', () => {
    expect(countWord(3)).toBe('three')
    expect(countWord(12)).toBe('12')
  })
})

describe('catchUpMessage', () => {
  const counts = (overrides: Partial<MessageCounts>): MessageCounts => ({
    needed: 2,
    placed: 2,
    deferred: 0,
    shown: 2,
    freeDays: 4,
    ...overrides,
  })

  it('covers the plan states without suggestions', () => {
    expect(catchUpMessage('no_plan', counts({}))).toContain('Set a weekly plan in Profile')
    expect(catchUpMessage('complete', counts({}))).toBe('Every planned session for this week is done. Nice consistency.')
    expect(catchUpMessage('on_track', counts({ needed: 0 }))).toBe('Your remaining sessions are already scheduled for this week.')
  })

  it('describes on-track and catch-up suggestions with correct plurals', () => {
    expect(catchUpMessage('on_track', counts({}))).toBe("You're on track this week. Here's one way to fit the remaining two sessions.")
    expect(catchUpMessage('on_track', counts({ needed: 1, placed: 1, shown: 1 }))).toBe(
      "You're on track this week. Here's one way to fit the remaining session.",
    )
    expect(catchUpMessage('catch_up', counts({ needed: 3, placed: 3, shown: 3 }))).toBe(
      'Three planned sessions remain this week. These suggestions spread them out with recovery days in between.',
    )
    expect(catchUpMessage('catch_up', counts({ needed: 1, placed: 1, shown: 1 }))).toBe(
      "One planned session remains this week. Here's a day that fits around your recovery.",
    )
  })

  it('explains deferred sessions supportively', () => {
    expect(catchUpMessage('limited', counts({ needed: 3, placed: 0, deferred: 3, shown: 0, freeDays: 0 }))).toBe(
      "No free days are left this week for the remaining three sessions, and that's okay — rest days are part of the plan.",
    )
    expect(catchUpMessage('limited', counts({ needed: 1, placed: 0, deferred: 1, shown: 0, freeDays: 1 }))).toBe(
      "The days left this week don't leave enough recovery time for the remaining session, and that's okay — rest days are part of the plan.",
    )
    expect(catchUpMessage('limited', counts({ needed: 3, placed: 1, deferred: 2, shown: 1 }))).toBe(
      'One of the three remaining sessions fits safely this week. Leaving out the other two is okay — rest days are part of the plan.',
    )
    expect(catchUpMessage('limited', counts({ needed: 4, placed: 2, deferred: 2, shown: 2 }))).toContain('Two of the four remaining sessions fit safely')
  })

  it('mentions dismissed suggestions when fewer are shown than fit', () => {
    expect(catchUpMessage('catch_up', counts({ shown: 1 }))).toBe(
      'Two planned sessions remain this week. These suggestions spread them out with recovery days in between. Suggestions you dismissed stay hidden.',
    )
    expect(catchUpMessage('catch_up', counts({ shown: 0 }))).toBe(
      'Two planned sessions remain this week. You dismissed the suggestions for this week; you can still log a session whenever it suits you.',
    )
    expect(catchUpMessage('on_track', counts({ shown: 0 }))).toBe(
      "You're on track this week. You dismissed the suggestions for this week; you can still log a session whenever it suits you.",
    )
    expect(catchUpMessage('limited', counts({ needed: 3, placed: 2, deferred: 1, shown: 1 }))).toMatch(/stay hidden\.$/)
  })

  it('keeps every message free of food, calorie and judgemental words', () => {
    const statuses = ['no_plan', 'complete', 'on_track', 'catch_up', 'limited'] as const
    for (const status of statuses) {
      for (const overrides of [{}, { shown: 0 }, { placed: 0, deferred: 2, shown: 0, freeDays: 0 }]) {
        expect(catchUpMessage(status, counts(overrides))).not.toMatch(FORBIDDEN_COPY)
      }
    }
  })
})
