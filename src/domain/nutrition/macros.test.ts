import { describe, expect, it } from 'vitest'
import { fiberTarget, limitTargets } from './limits'
import { macroTargets, proteinGramsPerKg, type MacroInput } from './macros'

const base: MacroInput = {
  energyKcal: 2000,
  weightKg: 70,
  minor: false,
  teenAmdr: false,
  goal: 'general_wellness',
  diet: 'balanced',
}

describe('proteinGramsPerKg', () => {
  it('uses the goal for adults and at least 1.8 g/kg on a high-protein diet', () => {
    expect(proteinGramsPerKg('general_wellness', 'balanced', false)).toBe(1.2)
    expect(proteinGramsPerKg('lose_weight', 'balanced', false)).toBe(1.6)
    expect(proteinGramsPerKg('general_wellness', 'high_protein', false)).toBe(1.8)
    expect(proteinGramsPerKg('build_muscle', 'high_protein', false)).toBe(1.8)
  })

  it('uses the 14–18 RDA for minors regardless of goal or diet', () => {
    expect(proteinGramsPerKg('build_muscle', 'high_protein', true)).toBe(0.85)
  })
})

describe('macroTargets', () => {
  it('clamps g/kg protein to the AMDR ceiling for high body weights', () => {
    const result = macroTargets({ ...base, weightKg: 250, goal: 'lose_weight' })
    expect(result.protein).toEqual({ amount: 175, min: 50, max: 175, kind: 'goal' })
    expect(result.notes[0]).toBe('Protein: 1.6 g per kg of body weight, adjusted to stay within 10–35 % of energy.')
  })

  it('lifts protein to the AMDR floor for low body weights', () => {
    const result = macroTargets({ ...base, weightKg: 30 })
    expect(result.protein.amount).toBe(50)
  })

  it('uses the diet protein share when weight is unknown', () => {
    const balanced = macroTargets({ ...base, weightKg: null })
    expect(balanced.protein.amount).toBe(100)
    const highProtein = macroTargets({ ...base, weightKg: null, diet: 'high_protein' })
    expect(highProtein.protein.amount).toBe(150)
    expect(highProtein.fat.amount).toBe(56)
    expect(highProtein.carbs.amount).toBe(225)
    expect(highProtein.notes[0]).toBe('Protein is 30 % of energy until your weight is added.')
  })

  it('uses the teen AMDR (protein ≤ 30 %, fat ≥ 25 %) for ages 14–18', () => {
    const teen = macroTargets({ ...base, weightKg: 100, diet: 'high_protein', teenAmdr: true })
    expect(teen.protein).toEqual({ amount: 150, min: 50, max: 150, kind: 'goal' })
    expect(teen.fat).toEqual({ amount: 56, min: 56, max: 78, kind: 'goal' })
    expect(teen.notes[0]).toMatch(/within 10–30 % of energy/)
    const adult = macroTargets({ ...base, weightKg: 100, diet: 'high_protein' })
    expect(adult.protein.amount).toBe(175)
    expect(adult.fat).toEqual({ amount: 44, min: 44, max: 78, kind: 'goal' })
    expect(adult.carbs.amount).toBe(225)
  })

  it('widens the carbohydrate range when protein and minimum fat leave less than 45 %', () => {
    const result = macroTargets({ ...base, weightKg: 200, diet: 'mediterranean', goal: 'build_muscle' })
    expect(result.protein.amount).toBe(175)
    expect(result.fat.amount).toBe(56)
    expect(result.carbs.amount).toBe(200)
    expect(result.carbs.min).toBe(200)
    expect(result.carbs.max).toBe(325)
  })

  it('keeps every goal amount inside its own range', () => {
    for (const diet of ['balanced', 'high_protein', 'mediterranean', 'keto', 'vegetarian', 'vegan'] as const) {
      for (const weightKg of [null, 40, 70, 150, 300]) {
        const result = macroTargets({ ...base, diet, weightKg, energyKcal: 1500 })
        for (const t of [result.protein, result.carbs, result.fat]) {
          expect(t.min).not.toBeNull()
          expect(t.amount).toBeGreaterThanOrEqual(t.min ?? 0)
          expect(t.amount).toBeLessThanOrEqual(t.max ?? Number.POSITIVE_INFINITY)
        }
      }
    }
  })

  it.each([0, -100, Number.NaN, Number.POSITIVE_INFINITY])('rejects energyKcal = %s', (energyKcal) => {
    expect(() => macroTargets({ ...base, energyKcal })).toThrow(RangeError)
  })

  it('keto: fat is the remainder and never negative', () => {
    const result = macroTargets({ ...base, diet: 'keto', energyKcal: 1200 })
    expect(result.carbs).toEqual({ amount: 30, min: 20, max: 50, kind: 'limit' })
    expect(result.fat.amount).toBe(83)
    const tiny = macroTargets({ ...base, diet: 'keto', energyKcal: 100, weightKg: null })
    expect(tiny.fat.amount).toBe(0)
  })
})

describe('fiberTarget', () => {
  it('scales with energy at 14 g per 1,000 kcal', () => {
    expect(fiberTarget(2000, 'balanced').target.amount).toBe(28)
    expect(fiberTarget(1600, 'vegan').target.amount).toBe(22)
    expect(fiberTarget(2750, 'mediterranean').target).toEqual({ amount: 39, min: null, max: null, kind: 'goal' })
  })

  it('caps fiber at 20 g on keto only when the energy-based value is higher', () => {
    const capped = fiberTarget(2000, 'keto')
    expect(capped.target.amount).toBe(20)
    expect(capped.note).toMatch(/20 g on keto/)
    expect(fiberTarget(1200, 'keto').target.amount).toBe(17)
  })
})

describe('limitTargets', () => {
  it('limits sodium to 2,300 mg and saturated fat to 10 % of energy', () => {
    const limits = limitTargets(2000)
    expect(limits.sodium).toEqual({ amount: 2300, min: null, max: 2300, kind: 'limit' })
    expect(limits.saturatedFat).toEqual({ amount: 22, min: null, max: 22, kind: 'limit' })
    expect(limitTargets(2700).saturatedFat.amount).toBe(30)
    expect(limits.note).toMatch(/Sugars are shown for information without a target/)
  })
})
