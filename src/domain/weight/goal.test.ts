import { describe, expect, it } from 'vitest'
import { createDefaultProfile } from '@/domain/profile'
import type { Profile } from '@/types'
import { weightGoalInput } from './goal'

const TODAY = '2026-10-03'

function profile(overrides: Partial<Profile>): Profile {
  return {
    ...createDefaultProfile('user-1', '2026-01-01T00:00:00.000Z'),
    goal: 'lose_weight',
    goalPace: 'moderate',
    targetWeightKg: 72,
    ...overrides,
  }
}

describe('weightGoalInput', () => {
  it('copies the goal settings and marks a known adult', () => {
    expect(weightGoalInput(profile({ birthDate: '1990-05-01' }), TODAY)).toEqual({
      targetKg: 72,
      goal: 'lose_weight',
      goalPace: 'moderate',
      isAdult: true,
    })
  })

  it('switches to adult exactly on the 18th birthday', () => {
    expect(weightGoalInput(profile({ birthDate: '2008-10-04' }), TODAY).isAdult).toBe(false)
    expect(weightGoalInput(profile({ birthDate: '2008-10-03' }), TODAY).isAdult).toBe(true)
  })

  it('treats a missing or invalid birth date like a minor’s (no trajectory)', () => {
    expect(weightGoalInput(profile({ birthDate: null }), TODAY).isAdult).toBe(false)
    expect(weightGoalInput(profile({ birthDate: '1990-02-30' }), TODAY).isAdult).toBe(false)
  })

  it('passes a missing target through as null', () => {
    expect(weightGoalInput(profile({ birthDate: '1990-05-01', targetWeightKg: null }), TODAY).targetKg).toBeNull()
  })
})
