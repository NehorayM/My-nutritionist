import { describe, expect, it } from 'vitest'
import { makeProfile } from './__fixtures__/records'
import { profileSchema } from './profile'

describe('profileSchema', () => {
  it('accepts a complete profile and a minimal one with unknown body values', () => {
    expect(profileSchema.safeParse(makeProfile()).success).toBe(true)
    const minimal = makeProfile({ displayName: '', birthDate: null, heightCm: null, currentWeightKg: null, targetWeightKg: null })
    expect(profileSchema.parse(minimal)).toEqual(minimal)
  })

  it.each([
    ['heightCm', 50, true],
    ['heightCm', 49.9, false],
    ['heightCm', 272, true],
    ['heightCm', 272.1, false],
    ['currentWeightKg', 20, true],
    ['currentWeightKg', 19.99, false],
    ['targetWeightKg', 400, true],
    ['targetWeightKg', 400.01, false],
    ['maxPrepMinutes', 5, true],
    ['maxPrepMinutes', 4, false],
    ['maxPrepMinutes', 240, true],
    ['maxPrepMinutes', 241, false],
    ['strengthSessionsPerWeek', 0, true],
    ['strengthSessionsPerWeek', 14, true],
    ['cardioSessionsPerWeek', 15, false],
    ['cardioSessionsPerWeek', 1.5, false],
    ['preferredWorkoutMinutes', 10, true],
    ['preferredWorkoutMinutes', 9, false],
    ['preferredWorkoutMinutes', 180, true],
    ['preferredWorkoutMinutes', 181, false],
    ['birthDate', '1900-01-01', true],
    ['birthDate', '1899-12-31', false],
    ['birthDate', '2100-01-01', true],
    ['birthDate', '2100-01-02', false],
    ['birthDate', '1990-02-30', false],
    ['displayName', 'x'.repeat(80), true],
    ['displayName', 'x'.repeat(81), false],
    ['weekStartsOn', 1, true],
    ['weekStartsOn', 2, false],
    ['allergies', ['milk', 'gluten'], true],
    ['allergies', ['lactose'], false],
    ['preferredCuisines', ['french'], false],
    ['dislikes', Array.from({ length: 50 }, (_, i) => `d${i}`), true],
    ['dislikes', Array.from({ length: 51 }, (_, i) => `d${i}`), false],
    ['dislikes', [''], false],
    ['reminders', { weighIn: true }, false],
    ['sex', 'other', false],
    ['goal', 'bulk', false],
  ])('%s = %j valid=%s', (field, value, valid) => {
    expect(profileSchema.safeParse({ ...makeProfile(), [field]: value }).success).toBe(valid)
  })
})
