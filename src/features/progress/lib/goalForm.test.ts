import { describe, expect, it } from 'vitest'
import { createDefaultProfile } from '@/domain/profile'
import type { Profile } from '@/types'
import { goalDraftFromProfile, goalOptions, isGoalDirty, validateGoal } from './goalForm'

function profile(patch: Partial<Profile> = {}): Profile {
  return { ...createDefaultProfile('u', '2026-10-07T07:00:00.000Z'), ...patch }
}

describe('goal options', () => {
  it('offers weight-change goals to adults only', () => {
    expect(goalOptions(false).map((option) => option.value)).toEqual([
      'general_wellness',
      'maintain',
      'lose_weight',
      'gain_weight',
      'build_muscle',
    ])
    expect(goalOptions(true).map((option) => option.label)).toEqual(['General wellness', 'Maintain weight', 'Build muscle'])
  })

  it('shows a minor a stored weight-change goal as general wellness', () => {
    const stored = profile({ goal: 'lose_weight', targetWeightKg: 60 })
    expect(goalDraftFromProfile(stored, true)).toEqual({ goal: 'general_wellness', pace: 'gentle', target: 60 })
    expect(goalDraftFromProfile({ ...stored, unitSystem: 'imperial' }, false)).toEqual({
      goal: 'lose_weight',
      pace: 'gentle',
      target: 132.3,
    })
  })

  it('detects changes', () => {
    const saved = { goal: 'maintain' as const, pace: 'gentle' as const, target: null }
    expect(isGoalDirty(saved, saved)).toBe(false)
    expect(isGoalDirty({ ...saved, target: 70 }, saved)).toBe(true)
  })
})

describe('validateGoal', () => {
  const base = { profile: profile({ targetWeightKg: 74 }), minor: false, currentKg: 80 }

  it('keeps the stored target untouched for goals without one', () => {
    expect(validateGoal({ goal: 'maintain', pace: 'moderate', target: null }, base)).toEqual({
      ok: true,
      values: { goal: 'maintain', goalPace: 'moderate', targetWeightKg: 74 },
    })
  })

  it('never saves a weight-change goal for a minor', () => {
    expect(validateGoal({ goal: 'lose_weight', pace: 'gentle', target: 60 }, { ...base, minor: true })).toEqual({
      ok: true,
      values: { goal: 'general_wellness', goalPace: 'gentle', targetWeightKg: 74 },
    })
  })

  it('accepts a target in the goal direction and clears an emptied one', () => {
    expect(validateGoal({ goal: 'lose_weight', pace: 'gentle', target: 75 }, base)).toMatchObject({
      ok: true,
      values: { targetWeightKg: 75 },
    })
    expect(validateGoal({ goal: 'gain_weight', pace: 'gentle', target: null }, base)).toMatchObject({
      ok: true,
      values: { targetWeightKg: null },
    })
  })

  it('explains targets in the wrong direction, too close or out of range', () => {
    expect(validateGoal({ goal: 'lose_weight', pace: 'gentle', target: 82 }, base)).toEqual({
      ok: false,
      errors: { target: 'For a weight-loss goal, choose a target below your current 80.0 kg.' },
    })
    expect(validateGoal({ goal: 'gain_weight', pace: 'gentle', target: 78 }, base)).toEqual({
      ok: false,
      errors: { target: 'For a weight-gain goal, choose a target above your current 80.0 kg.' },
    })
    expect(validateGoal({ goal: 'gain_weight', pace: 'gentle', target: 80.1 }, base)).toMatchObject({
      ok: false,
      errors: { target: expect.stringMatching(/“Maintain weight” may fit better\.$/) },
    })
    expect(validateGoal({ goal: 'gain_weight', pace: 'gentle', target: 401 }, base)).toEqual({
      ok: false,
      errors: { target: 'Enter a weight between 20 and 400 kg.' },
    })
  })

  it('skips the direction check without a known current weight', () => {
    expect(validateGoal({ goal: 'lose_weight', pace: 'gentle', target: 90 }, { ...base, currentKg: null }).ok).toBe(true)
  })

  it('keeps an unchanged imperial target exactly as stored', () => {
    const imperial = profile({ unitSystem: 'imperial', targetWeightKg: 72.57 })
    const result = validateGoal({ goal: 'gain_weight', pace: 'gentle', target: 160 }, { profile: imperial, minor: false, currentKg: 68 })
    expect(result).toMatchObject({ ok: true, values: { targetWeightKg: 72.57 } })
  })
})
