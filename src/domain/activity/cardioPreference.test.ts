import { describe, expect, it } from 'vitest'
import { workout } from './__fixtures__/workouts'
import { cardioChoices, rankCardioTypes } from './cardioPreference'

const TODAY = '2026-10-08'

describe('rankCardioTypes', () => {
  it('is empty without cardio history', () => {
    expect(rankCardioTypes([], TODAY)).toEqual([])
    expect(rankCardioTypes([workout('2026-10-06', 'strength'), workout('2026-10-07', 'mobility')], TODAY)).toEqual([])
  })

  it('ranks by frequency within the last 14 days', () => {
    const history = [
      workout('2026-10-01', 'cycling'),
      workout('2026-10-03', 'cycling'),
      workout('2026-10-07', 'run'),
      workout('2026-09-28', 'swimming'),
    ]
    expect(rankCardioTypes(history, TODAY)).toEqual(['cycling', 'run', 'swimming'])
  })

  it('breaks frequency ties by the most recent session, then by the fixed type order', () => {
    const recentRun = [workout('2026-10-01', 'swimming'), workout('2026-10-06', 'run')]
    expect(rankCardioTypes(recentRun, TODAY)).toEqual(['run', 'swimming'])
    const sameDay = [workout('2026-10-06', 'swimming'), workout('2026-10-06', 'cycling')]
    expect(rankCardioTypes(sameDay, TODAY)).toEqual(['cycling', 'swimming'])
  })

  it('tracks the latest date per type regardless of input order', () => {
    const history = [workout('2026-10-07', 'swimming'), workout('2026-10-02', 'swimming'), workout('2026-10-05', 'run'), workout('2026-10-03', 'run')]
    expect(rankCardioTypes(history, TODAY)).toEqual(['swimming', 'run'])
  })

  it('ignores HIIT, short walks, and sessions outside the window', () => {
    const history = [
      workout('2026-10-07', 'hiit'),
      workout('2026-10-07', 'walk', { durationMin: 15 }),
      workout('2026-09-24', 'run'),
      workout('2026-10-09', 'cycling'),
      workout('2026-09-25', 'swimming'),
    ]
    expect(rankCardioTypes(history, TODAY)).toEqual(['swimming'])
  })
})

describe('cardioChoices', () => {
  it('defaults to a brisk walk, with an open cardio session as the variant', () => {
    expect(cardioChoices([], TODAY)).toEqual({ preferred: 'walk', variant: 'cardio' })
  })

  it('uses the two most frequent types', () => {
    const history = [workout('2026-10-02', 'run'), workout('2026-10-04', 'run'), workout('2026-10-06', 'cycling')]
    expect(cardioChoices(history, TODAY)).toEqual({ preferred: 'run', variant: 'cycling' })
  })

  it('offers a walk as the variant when only one non-walk type is in the history', () => {
    expect(cardioChoices([workout('2026-10-06', 'swimming')], TODAY)).toEqual({ preferred: 'swimming', variant: 'walk' })
  })

  it('offers an open cardio session as the variant for people who only walk', () => {
    expect(cardioChoices([workout('2026-10-06', 'walk', { durationMin: 30 })], TODAY)).toEqual({ preferred: 'walk', variant: 'cardio' })
  })
})
