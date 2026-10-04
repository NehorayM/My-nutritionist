import { describe, expect, it } from 'vitest'
import { addDays, daysBetween } from '@/domain/dates'
import { followsHardDay, isHardSession, loadByDate, needsRecoveryAfter } from './recovery'
import type { SessionEvent } from './recovery'
import { candidateDays, maxPlaceable, rankSchedules } from './schedule'
import type { PlannedSlot } from './schedule'

const MON = '2026-10-05'
const days = (from: string, count: number): string[] => Array.from({ length: count }, (_, i) => addDays(from, i))
const event = (date: string, type: SessionEvent['type'], intensity: SessionEvent['intensity'] = 'moderate'): SessionEvent => ({
  date,
  type,
  intensity,
})

function strengthDates(slots: readonly PlannedSlot[]): string[] {
  return slots.filter((slot) => slot.category === 'strength').map((slot) => slot.date)
}

describe('recovery helpers', () => {
  it('treats vigorous sessions of any type and every HIIT session as hard', () => {
    expect(isHardSession({ type: 'walk', intensity: 'vigorous' })).toBe(true)
    expect(isHardSession({ type: 'hiit', intensity: 'light' })).toBe(true)
    expect(isHardSession({ type: 'hiit', intensity: null })).toBe(true)
    expect(isHardSession({ type: 'strength', intensity: 'moderate' })).toBe(false)
    expect(isHardSession({ type: 'run', intensity: null })).toBe(false)
  })

  it('merges every session of a day and skips invalid dates', () => {
    const loads = loadByDate([event(MON, 'walk'), event(MON, 'strength'), event('2026-10-06', 'run', 'vigorous'), event('bad', 'hiit')])
    expect(Object.fromEntries(loads)).toEqual({
      [MON]: { strength: true, hard: false },
      '2026-10-06': { strength: false, hard: true },
    })
  })

  it('needs recovery after strength or hard days only', () => {
    expect(needsRecoveryAfter(undefined)).toBe(false)
    expect(needsRecoveryAfter({ strength: false, hard: false })).toBe(false)
    expect(needsRecoveryAfter({ strength: true, hard: false })).toBe(true)
    expect(needsRecoveryAfter({ strength: false, hard: true })).toBe(true)
  })

  it('detects a hard session on the previous day', () => {
    const loads = loadByDate([event(MON, 'hiit')])
    expect(followsHardDay('2026-10-06', loads)).toBe(true)
    expect(followsHardDay('2026-10-07', loads)).toBe(false)
  })
})

describe('candidateDays', () => {
  it('runs from today to the end and skips occupied days', () => {
    expect(candidateDays(MON, '2026-10-08', new Set([MON, '2026-10-07']))).toEqual(['2026-10-06', '2026-10-08'])
  })

  it('is empty when the only day left is occupied', () => {
    expect(candidateDays('2026-10-11', '2026-10-11', new Set(['2026-10-11']))).toEqual([])
  })
})

describe('rankSchedules', () => {
  it('returns one empty plan when nothing is needed or no day is free', () => {
    expect(rankSchedules({ days: days(MON, 3), need: { strength: 0, cardio: 0 }, fixed: [] }, 3)).toEqual([[]])
    expect(rankSchedules({ days: [], need: { strength: 2, cardio: 1 }, fixed: [] }, 3)).toEqual([[]])
  })

  it('places at most one session per day', () => {
    const [best] = rankSchedules({ days: days(MON, 2), need: { strength: 2, cardio: 3 }, fixed: [] }, 1)
    expect(best).toHaveLength(2)
    expect(new Set(best?.map((slot) => slot.date)).size).toBe(2)
  })

  it('never puts strength sessions on consecutive days', () => {
    const results = rankSchedules({ days: days(MON, 7), need: { strength: 4, cardio: 0 }, fixed: [] }, 50)
    expect(results.length).toBeGreaterThan(0)
    for (const slots of results) {
      expect(slots).toHaveLength(4)
      const dates = strengthDates(slots)
      for (let i = 1; i < dates.length; i += 1) expect(daysBetween(dates[i - 1]!, dates[i]!)).toBeGreaterThanOrEqual(2)
    }
  })

  it('keeps strength away from fixed strength or hard days on either side', () => {
    const fixed = [event('2026-10-06', 'strength'), event('2026-10-09', 'run', 'vigorous')]
    const results = rankSchedules({ days: [MON, '2026-10-07', '2026-10-08', '2026-10-10'], need: { strength: 1, cardio: 0 }, fixed }, 10)
    expect(results).toEqual([[]])
  })

  it('allows strength two days after a fixed strength session', () => {
    const fixed = [event(MON, 'strength')]
    const [best] = rankSchedules({ days: ['2026-10-06', '2026-10-07'], need: { strength: 1, cardio: 0 }, fixed }, 1)
    expect(best).toEqual([{ date: '2026-10-07', category: 'strength' }])
  })

  it('alternates categories when both remain', () => {
    const [best] = rankSchedules({ days: days(MON, 4), need: { strength: 2, cardio: 2 }, fixed: [] }, 1)
    const categories = best?.map((slot) => slot.category) ?? []
    for (let i = 1; i < categories.length; i += 1) expect(categories[i]).not.toBe(categories[i - 1])
  })

  it('defers evenly across categories when not everything fits', () => {
    const [best] = rankSchedules({ days: days(MON, 2), need: { strength: 2, cardio: 2 }, fixed: [] }, 1)
    expect(best?.map((slot) => slot.category).sort()).toEqual(['cardio', 'strength'])
  })

  it('skips blocked slots and still fills the need elsewhere', () => {
    const isBlocked = (slot: PlannedSlot): boolean => slot.date === MON
    const [best] = rankSchedules({ days: days(MON, 3), need: { strength: 0, cardio: 1 }, fixed: [], isBlocked }, 1)
    expect(best).toHaveLength(1)
    expect(best?.[0]?.date).not.toBe(MON)
  })

  it('returns distinct plans, best first, up to the limit', () => {
    const results = rankSchedules({ days: days(MON, 5), need: { strength: 1, cardio: 1 }, fixed: [] }, 3)
    expect(results).toHaveLength(3)
    expect(new Set(results.map((slots) => JSON.stringify(slots))).size).toBe(3)
    expect(rankSchedules({ days: days(MON, 5), need: { strength: 1, cardio: 1 }, fixed: [] }, 0)).toHaveLength(1)
  })

  it('is deterministic', () => {
    const request = { days: days(MON, 7), need: { strength: 2, cardio: 3 }, fixed: [event('2026-10-04', 'hiit')] }
    expect(rankSchedules(request, 5)).toEqual(rankSchedules(request, 5))
  })
})

describe('maxPlaceable', () => {
  it('counts the sessions that fit safely', () => {
    expect(maxPlaceable({ days: days(MON, 2), need: { strength: 2, cardio: 0 }, fixed: [] })).toBe(1)
    expect(maxPlaceable({ days: days(MON, 3), need: { strength: 2, cardio: 0 }, fixed: [] })).toBe(2)
    expect(maxPlaceable({ days: [], need: { strength: 1, cardio: 1 }, fixed: [] })).toBe(0)
  })
})
