import { describe, expect, it } from 'vitest'
import { nutrientProfile } from '../nutrients'
import { food } from './__fixtures__/adaptive'
import { LUNCH_BUDGET, item } from './__fixtures__/ranking'
import { calorieFitScore, clamp01, fitsEnergyBudget, fiberScore, macroFitScore, micronutrientScore } from './nutritionFit'

const MATCH = nutrientProfile({ calories: 700, protein: 35, carbs: 85, fat: 23, fiber: 10, sodium: 600, saturatedFat: 6 })

describe('calorieFitScore', () => {
  it('gives full credit within ±10 % of the budget', () => {
    expect(calorieFitScore(700, 700)).toBe(1)
    expect(calorieFitScore(765, 700)).toBe(1)
    expect(calorieFitScore(635, 700)).toBe(1)
  })

  it('falls to zero at +50 % and −60 %', () => {
    expect(calorieFitScore(910, 700)).toBeCloseTo(0.5)
    expect(calorieFitScore(1050, 700)).toBe(0)
    expect(calorieFitScore(455, 700)).toBeCloseTo(0.5)
    expect(calorieFitScore(280, 700)).toBe(0)
  })

  it('handles an empty budget', () => {
    expect(calorieFitScore(0, 0)).toBe(1)
    expect(calorieFitScore(50, 0)).toBe(0)
  })
})

describe('fitsEnergyBudget', () => {
  it('accepts energy within ±15 % of the budget', () => {
    expect(fitsEnergyBudget(700, 700)).toBe(true)
    expect(fitsEnergyBudget(805, 700)).toBe(true)
    expect(fitsEnergyBudget(595, 700)).toBe(true)
    expect(fitsEnergyBudget(806, 700)).toBe(false)
    expect(fitsEnergyBudget(594, 700)).toBe(false)
  })

  it('never fits unknown energy or a missing budget', () => {
    expect(fitsEnergyBudget(null, 700)).toBe(false)
    expect(fitsEnergyBudget(700, undefined)).toBe(false)
  })
})

describe('macroFitScore', () => {
  it('is 1 when protein, carbohydrate and fat match the budget', () => {
    expect(macroFitScore(MATCH, LUNCH_BUDGET, 'normal')).toBe(1)
  })

  it('counts extra protein at half weight', () => {
    const extraProtein = macroFitScore({ ...MATCH, protein: 35 * 1.6 }, LUNCH_BUDGET, 'normal')
    const missingProtein = macroFitScore({ ...MATCH, protein: 35 * 0.4 }, LUNCH_BUDGET, 'normal')
    expect(extraProtein).toBeGreaterThan(missingProtein)
    expect(extraProtein).toBeLessThan(1)
  })

  it('treats unknown macro amounts as missing and is 0 when every macro is far off', () => {
    expect(macroFitScore({ ...MATCH, protein: null, carbs: null, fat: null }, LUNCH_BUDGET, 'normal')).toBe(0)
  })

  it('leans on protein with a light allowance', () => {
    const lowCarb = { ...MATCH, carbs: 10 }
    expect(macroFitScore(lowCarb, LUNCH_BUDGET, 'surplus')).toBeGreaterThan(macroFitScore(lowCarb, LUNCH_BUDGET, 'normal'))
  })

  it('measures small budgets against 10 % of the meal energy', () => {
    const ketoBudget = { ...LUNCH_BUDGET, carbs: 5, fat: 55 }
    const close = macroFitScore({ ...MATCH, carbs: 8, fat: 55 }, ketoBudget, 'normal')
    expect(close).toBeGreaterThan(0.85)
  })

  it('removes up to a quarter when sodium or saturated fat exceed the allowance', () => {
    expect(macroFitScore({ ...MATCH, sodium: 1600 }, LUNCH_BUDGET, 'normal')).toBeCloseTo(1 - 0.25 / 2)
    expect(macroFitScore({ ...MATCH, sodium: 5000, saturatedFat: 30 }, LUNCH_BUDGET, 'normal')).toBeCloseTo(0.75)
    expect(macroFitScore({ ...MATCH, sodium: null, saturatedFat: null }, LUNCH_BUDGET, 'normal')).toBe(1)
    expect(macroFitScore({ ...MATCH, sodium: 5000 }, { ...LUNCH_BUDGET, sodium: 0, saturatedFat: undefined }, 'normal')).toBe(1)
  })

  it('is neutral when the budget has no macros', () => {
    expect(macroFitScore(MATCH, { calories: 700 }, 'normal')).toBe(0.5)
  })

  it('still measures macros against their own budgets when the meal has no energy budget', () => {
    const noEnergy = { protein: 35, carbs: 85, fat: 23 }
    expect(macroFitScore(MATCH, noEnergy, 'normal')).toBe(1)
    expect(macroFitScore({ ...MATCH, carbs: 0 }, noEnergy, 'normal')).toBeCloseTo(0.7)
  })
})

describe('fiberScore', () => {
  it('measures known fiber against the meal budget', () => {
    expect(fiberScore(MATCH, LUNCH_BUDGET, 'lunch')).toBe(1)
    expect(fiberScore({ ...MATCH, fiber: 5 }, LUNCH_BUDGET, 'lunch')).toBe(0.5)
    expect(fiberScore({ ...MATCH, fiber: null }, LUNCH_BUDGET, 'lunch')).toBe(0)
  })

  it('never measures against less than 4 g for a meal or 2 g for a snack', () => {
    expect(fiberScore({ ...MATCH, fiber: 2 }, { fiber: 1 }, 'dinner')).toBe(0.5)
    expect(fiberScore({ ...MATCH, fiber: 2 }, { fiber: 1 }, 'snack')).toBe(1)
    expect(fiberScore({ ...MATCH, fiber: 1 }, {}, 'snack')).toBe(0.5)
  })
})

describe('micronutrientScore', () => {
  const ironRich = food({ per100g: { iron: 4, vitaminC: 20 } })
  const unknownIron = food({ per100g: { iron: null, vitaminC: 20 } })

  it('is neutral when no micronutrient is a gap', () => {
    const items = [item(ironRich, 100)]
    expect(micronutrientScore(items, ironRich.per100g, LUNCH_BUDGET, [])).toBe(0.5)
  })

  it('averages coverage of the targeted gaps, known values only', () => {
    const items = [item(ironRich, 75)]
    const totals = items[0]!.nutrients
    expect(micronutrientScore(items, totals, LUNCH_BUDGET, ['iron'])).toBeCloseTo(0.5)
    expect(micronutrientScore(items, totals, LUNCH_BUDGET, ['iron', 'vitaminC'])).toBeCloseTo(0.5)
  })

  it('gives unknown values no credit and a small confidence penalty', () => {
    const items = [item(unknownIron, 150), item(ironRich, 75)]
    const totals = nutrientProfile({ iron: 3, vitaminC: 45 })
    const known = micronutrientScore([item(ironRich, 75)], totals, LUNCH_BUDGET, ['iron'])
    expect(micronutrientScore(items, totals, LUNCH_BUDGET, ['iron'])).toBeCloseTo(known - 0.25 * 0.5)
    expect(micronutrientScore([item(unknownIron, 100)], unknownIron.per100g, LUNCH_BUDGET, ['iron'])).toBeCloseTo(-0.25)
  })

  it('gives full credit for a gap with no budget left', () => {
    expect(micronutrientScore([item(ironRich, 10)], ironRich.per100g, { iron: 0 }, ['iron'])).toBe(1)
    expect(micronutrientScore([item(ironRich, 10)], ironRich.per100g, {}, ['iron'])).toBe(1)
  })

  it('earns nothing for an empty option', () => {
    expect(micronutrientScore([], nutrientProfile({}), LUNCH_BUDGET, ['iron'])).toBe(0)
  })
})

describe('clamp01', () => {
  it('clamps to [0, 1]', () => {
    expect([clamp01(-1), clamp01(0.4), clamp01(3)]).toEqual([0, 0.4, 1])
  })
})
