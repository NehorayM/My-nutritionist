import { describe, expect, it } from 'vitest'
import { scheduledWorkoutSchema, weightEntrySchema, workoutEntrySchema } from './activity'
import { makeScheduled, makeWeight, makeWorkout } from './__fixtures__/records'

describe('weightEntrySchema', () => {
  it.each([
    ['weightKg', 20, true],
    ['weightKg', 19.99, false],
    ['weightKg', 400, true],
    ['weightKg', 400.01, false],
    ['inputUnit', 'lb', true],
    ['inputUnit', 'st', false],
    ['note', 'x'.repeat(280), true],
    ['note', 'x'.repeat(281), false],
    ['measuredAt', '2026-10-03T05:30:00', false],
    ['date', '2026-09-31', false],
  ])('%s = %j valid=%s', (field, value, valid) => {
    expect(weightEntrySchema.safeParse({ ...makeWeight(), [field]: value }).success).toBe(valid)
  })
})

describe('workoutEntrySchema', () => {
  it('accepts a workout with no optional details', () => {
    const minimal = makeWorkout({ intensity: null, estimatedKcal: null, kcalSource: null })
    expect(workoutEntrySchema.parse(minimal)).toEqual(minimal)
  })

  it.each([
    ['durationMin', 1, true],
    ['durationMin', 0, false],
    ['durationMin', 600, true],
    ['durationMin', 601, false],
    ['durationMin', 30.5, false],
    ['estimatedKcal', 0, true],
    ['estimatedKcal', 5000, true],
    ['estimatedKcal', 5001, false],
    ['estimatedKcal', -1, false],
    ['kcalSource', 'device', false],
    ['type', 'yoga', false],
    ['intensity', 'extreme', false],
    ['notes', 'x'.repeat(501), false],
    ['scheduledWorkoutId', 'nope', false],
  ])('%s = %j valid=%s', (field, value, valid) => {
    expect(workoutEntrySchema.safeParse({ ...makeWorkout(), [field]: value }).success).toBe(valid)
  })
})

describe('scheduledWorkoutSchema', () => {
  it.each([
    ['status', 'completed', true],
    ['status', 'skipped', false],
    ['source', 'manual', true],
    ['source', 'coach', false],
    ['rationale', 'x'.repeat(300), true],
    ['rationale', 'x'.repeat(301), false],
    ['durationMin', 601, false],
  ])('%s = %j valid=%s', (field, value, valid) => {
    expect(scheduledWorkoutSchema.safeParse({ ...makeScheduled(), [field]: value }).success).toBe(valid)
  })
})
