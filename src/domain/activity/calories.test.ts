import { describe, expect, it } from 'vitest'
import { INTENSITIES, WORKOUT_TYPES } from '@/types'
import type { Intensity, WorkoutType } from '@/types'
import { estimateWorkoutKcal, metReferenceFor } from './calories'
import { MET_TABLE } from './constants'

describe('estimateWorkoutKcal', () => {
  it('returns null when body weight is unknown', () => {
    expect(estimateWorkoutKcal({ type: 'run', intensity: 'moderate', durationMin: 30, weightKg: null })).toBeNull()
  })

  it('computes MET × kg × hours exactly when already a multiple of 5', () => {
    // Resistance training, squats/deadlift (02052): 5.0 MET × 70 kg × 0.5 h = 175 kcal.
    expect(estimateWorkoutKcal({ type: 'strength', intensity: 'moderate', durationMin: 30, weightKg: 70 })).toBe(175)
  })

  it('rounds to the nearest 5 kcal, up and down', () => {
    // Brisk walk (17200): 4.8 × 72 × 0.75 = 259.2 → 260.
    expect(estimateWorkoutKcal({ type: 'walk', intensity: 'moderate', durationMin: 45, weightKg: 72 })).toBe(260)
    // Running 7 mph (12070): 11.0 × 63 × 0.5 = 346.5 → 345.
    expect(estimateWorkoutKcal({ type: 'run', intensity: 'vigorous', durationMin: 30, weightKg: 63 })).toBe(345)
    // Stretching, mild (02101): 2.3 × 55 × (20/60) = 42.17 → 40.
    expect(estimateWorkoutKcal({ type: 'mobility', intensity: 'light', durationMin: 20, weightKg: 55 })).toBe(40)
  })

  it('estimates a workout without intensity as moderate', () => {
    const withoutIntensity = estimateWorkoutKcal({ type: 'cycling', intensity: null, durationMin: 60, weightKg: 80 })
    const moderate = estimateWorkoutKcal({ type: 'cycling', intensity: 'moderate', durationMin: 60, weightKg: 80 })
    expect(withoutIntensity).toBe(640)
    expect(withoutIntensity).toBe(moderate)
  })

  it('scales with duration and weight', () => {
    const short = estimateWorkoutKcal({ type: 'swimming', intensity: 'moderate', durationMin: 30, weightKg: 60 })
    const long = estimateWorkoutKcal({ type: 'swimming', intensity: 'moderate', durationMin: 60, weightKg: 60 })
    const heavier = estimateWorkoutKcal({ type: 'swimming', intensity: 'moderate', durationMin: 30, weightKg: 90 })
    expect(short).toBe(175) // 5.8 × 60 × 0.5 = 174
    expect(long).toBe(350) // 348
    expect(heavier).toBe(260) // 261
  })

  it('accepts the boundary values of the valid ranges', () => {
    expect(estimateWorkoutKcal({ type: 'other', intensity: 'light', durationMin: 1, weightKg: 20 })).toBe(0)
    expect(estimateWorkoutKcal({ type: 'walk', intensity: 'light', durationMin: 600, weightKg: 400 })).toBe(12000)
  })

  it.each([
    ['zero weight', { durationMin: 30, weightKg: 0 }],
    ['weight below 20 kg', { durationMin: 30, weightKg: 19.9 }],
    ['weight above 400 kg', { durationMin: 30, weightKg: 401 }],
    ['non-finite weight', { durationMin: 30, weightKg: Number.NaN }],
    ['zero duration', { durationMin: 0, weightKg: 70 }],
    ['negative duration', { durationMin: -10, weightKg: 70 }],
    ['duration above 600 min', { durationMin: 601, weightKg: 70 }],
    ['infinite duration', { durationMin: Number.POSITIVE_INFINITY, weightKg: 70 }],
  ])('returns null for invalid input: %s', (_label, values) => {
    expect(estimateWorkoutKcal({ type: 'run', intensity: 'moderate', ...values })).toBeNull()
  })

  it('returns null for an unknown type or intensity (corrupted stored data)', () => {
    const base = { durationMin: 30, weightKg: 70 }
    expect(estimateWorkoutKcal({ ...base, type: 'zumba' as WorkoutType, intensity: 'moderate' })).toBeNull()
    expect(estimateWorkoutKcal({ ...base, type: 'run', intensity: 'extreme' as Intensity })).toBeNull()
  })
})

describe('metReferenceFor', () => {
  it('returns the compendium entry with its activity code', () => {
    expect(metReferenceFor('walk', 'moderate')).toEqual({
      met: 4.8,
      code: '17200',
      activity: 'Walking, 3.5-3.9 mph, level, brisk, walking for exercise',
    })
    expect(metReferenceFor('hiit', null)?.code).toBe('02210')
  })

  it('returns null for an unknown type', () => {
    expect(metReferenceFor('zumba' as WorkoutType, 'light')).toBeNull()
  })
})

describe('MET_TABLE', () => {
  it('has a 5-digit compendium code and a positive MET for every type and intensity', () => {
    for (const type of WORKOUT_TYPES) {
      for (const intensity of INTENSITIES) {
        const entry = MET_TABLE[type][intensity]
        expect(entry.code).toMatch(/^\d{5}$/)
        expect(entry.met).toBeGreaterThan(1)
      }
    }
  })

  it('increases from light to vigorous within each workout type', () => {
    for (const type of WORKOUT_TYPES) {
      const { light, moderate, vigorous } = MET_TABLE[type]
      expect(light.met).toBeLessThan(moderate.met)
      expect(moderate.met).toBeLessThan(vigorous.met)
    }
  })
})
