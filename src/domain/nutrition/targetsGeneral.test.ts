import { describe, expect, it } from 'vitest'
import type { DietType } from '@/types'
import { adultProfile, TODAY } from './__fixtures__/nutrition'
import { calculateDailyTargets } from './targets'

describe('calculateDailyTargets — general mode', () => {
  it('uses population defaults when there is no profile', () => {
    const result = calculateDailyTargets({ profile: null, date: TODAY })
    expect(result.mode).toBe('general')
    expect(result.estimate).toEqual({ method: 'population_default', bmrKcal: null, maintenanceKcal: 2000, goalAdjustmentKcal: 0 })
    expect(result.targets.calories).toEqual({ amount: 2000, min: 1800, max: 2200, kind: 'energy' })
    expect(result.targets.protein?.amount).toBe(100)
    expect(result.targets.fiber?.amount).toBe(28)
    expect(result.targets.iron?.amount).toBe(18)
    expect(result.assumptions).toEqual(
      expect.arrayContaining([
        'Add your birth date, height and weight for personalized targets.',
        'Energy uses a general reference of 2,000 kcal/day.',
        'Protein is 20 % of energy until your weight is added.',
        'Adult reference values are used until a birth date is added.',
      ]),
    )
  })

  it('lists exactly the missing profile fields', () => {
    const noHeight = calculateDailyTargets({ profile: adultProfile({ heightCm: null }), date: TODAY })
    expect(noHeight.mode).toBe('general')
    expect(noHeight.assumptions[0]).toBe('Add your height for personalized targets.')

    const noBirthOrWeight = calculateDailyTargets({ profile: adultProfile({ birthDate: null, currentWeightKg: null }), date: TODAY })
    expect(noBirthOrWeight.assumptions[0]).toBe('Add your birth date and weight for personalized targets.')
  })

  it('makes no weight-goal adjustment until the profile is complete', () => {
    const result = calculateDailyTargets({ profile: adultProfile({ heightCm: null, goal: 'lose_weight' }), date: TODAY })
    expect(result.estimate.goalAdjustmentKcal).toBe(0)
    expect(result.targets.calories?.amount).toBe(2000)
    expect(result.assumptions).toContain('Weight-goal adjustments start once your profile is complete.')
  })

  it('still uses a known weight for protein in general mode', () => {
    const result = calculateDailyTargets({ profile: adultProfile({ heightCm: null }), date: TODAY })
    expect(result.targets.protein?.amount).toBe(84)
  })

  it('accepts a weigh-in when the profile has no weight', () => {
    const result = calculateDailyTargets({ profile: adultProfile({ currentWeightKg: null }), date: TODAY, latestWeightKg: 70 })
    expect(result.mode).toBe('personalized')
  })

  it('treats implausible values as missing', () => {
    const tinyWeight = calculateDailyTargets({ profile: adultProfile(), date: TODAY, latestWeightKg: 5 })
    expect(tinyWeight.mode).toBe('general')
    expect(tinyWeight.assumptions[0]).toBe('Add your weight for personalized targets.')

    const nonFinite = calculateDailyTargets({ profile: adultProfile({ heightCm: Number.NaN }), date: TODAY })
    expect(nonFinite.assumptions[0]).toBe('Add your height for personalized targets.')

    const futureBirth = calculateDailyTargets({ profile: adultProfile({ birthDate: '2030-01-01' }), date: TODAY })
    expect(futureBirth.mode).toBe('general')
    expect(futureBirth.assumptions[0]).toBe('Add your birth date for personalized targets.')

    const badTarget = calculateDailyTargets({ profile: adultProfile({ goal: 'lose_weight', targetWeightKg: 2 }), date: TODAY })
    expect(badTarget.estimate.goalAdjustmentKcal).toBeLessThan(0)
  })

  it('falls back to general targets when the estimate is implausibly low', () => {
    const profile = adultProfile({ birthDate: '1926-10-04', heightCm: 50, currentWeightKg: 20 })
    const result = calculateDailyTargets({ profile, date: TODAY })
    expect(result.mode).toBe('general')
    expect(result.targets.calories?.amount).toBe(2000)
    expect(result.assumptions[0]).toMatch(/unusual estimate/)
  })

  it('rejects an invalid date', () => {
    expect(() => calculateDailyTargets({ profile: adultProfile(), date: '2026-13-40' })).toThrow(RangeError)
  })
})

describe('calculateDailyTargets — diet types', () => {
  /** General mode (no height) → 2,000 kcal with a known 70 kg weight. */
  const targetsFor = (dietType: DietType) =>
    calculateDailyTargets({ profile: adultProfile({ dietType, heightCm: null }), date: TODAY })

  it('balanced: fat 30 %, carbohydrate the remainder', () => {
    const t = targetsFor('balanced').targets
    expect(t.protein?.amount).toBe(84)
    expect(t.fat?.amount).toBe(67)
    expect(t.carbs).toEqual({ amount: 266, min: 225, max: 325, kind: 'goal' })
  })

  it('high_protein: at least 1.8 g/kg and fat gives way to keep carbohydrate at 45 %', () => {
    const result = targetsFor('high_protein')
    expect(result.targets.protein?.amount).toBe(126)
    expect(result.targets.carbs?.amount).toBe(225)
    expect(result.targets.fat?.amount).toBe(66)
    expect(result.assumptions).toContain('Protein: 1.8 g per kg of body weight.')
  })

  it('mediterranean: fat 35 %', () => {
    const t = targetsFor('mediterranean').targets
    expect(t.fat?.amount).toBe(78)
    expect(t.carbs?.amount).toBe(241)
  })

  it('keto: carbohydrate limit of 50 g aiming for 30 g, fat the remainder, fiber capped', () => {
    const result = targetsFor('keto')
    expect(result.targets.carbs).toEqual({ amount: 30, min: 20, max: 50, kind: 'limit' })
    expect(result.targets.fat).toEqual({ amount: 172, min: 122, max: 178, kind: 'goal' })
    expect(result.targets.fiber?.amount).toBe(20)
    expect(result.assumptions.some((a) => a.includes('outside general macronutrient guidelines'))).toBe(true)
  })

  it('vegetarian and vegan: balanced macros with a higher iron target', () => {
    const vegetarian = targetsFor('vegetarian')
    expect(vegetarian.targets.carbs?.amount).toBe(266)
    expect(vegetarian.targets.iron?.amount).toBe(32.4)
    expect(vegetarian.assumptions.some((a) => a.startsWith('Iron target is 1.8 times higher'))).toBe(true)
    const vegan = calculateDailyTargets({ profile: adultProfile({ dietType: 'vegan', sex: 'male' }), date: TODAY })
    expect(vegan.targets.iron?.amount).toBe(14.4)
  })
})
