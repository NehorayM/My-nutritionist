import { describe, expect, it } from 'vitest'
import { emptyTotals, nutrientProfile } from '../nutrients'
import { adultProfile, BANANA, CHEESE_PIZZA, dailyTargets, target, TODAY } from './__fixtures__/nutrition'
import { sumNutrientProfiles, totalsForPortions } from './aggregation'
import { micronutrientCoverage } from './coverage'
import { calculateDailyTargets } from './targets'

const daily = calculateDailyTargets({ profile: adultProfile(), date: TODAY })

describe('micronutrientCoverage', () => {
  it('nothing logged: every item at 0, overall and completeness unknown', () => {
    const coverage = micronutrientCoverage(daily, emptyTotals())
    expect(coverage.items.map((item) => item.key)).toEqual(['iron', 'calcium', 'vitaminC', 'vitaminD', 'potassium'])
    expect(coverage.items.every((item) => item.ratio === 0 && item.dataComplete)).toBe(true)
    expect(coverage.overall).toBeNull()
    expect(coverage.dataCompleteness).toBeNull()
  })

  it('reports consumed vs target with ratios clamped to [0, 1]', () => {
    const totals = totalsForPortions([{ per100g: CHEESE_PIZZA, grams: 600 }])
    const coverage = micronutrientCoverage(daily, totals)
    const byKey = Object.fromEntries(coverage.items.map((item) => [item.key, item]))
    expect(byKey.calcium).toMatchObject({ consumed: 1128, target: 1000, ratio: 1, dataComplete: true })
    expect(byKey.iron?.ratio).toBeCloseTo(15 / 18, 10)
    expect(byKey.vitaminD?.ratio).toBe(0)
    expect(coverage.overall).toBeCloseTo((15 / 18 + 1 + 8.4 / 75 + 0 + 1032 / 2600) / 5, 10)
    expect(coverage.dataCompleteness).toBe(1)
  })

  it('is transparent about foods that lack micronutrient data', () => {
    const totals = totalsForPortions([
      { per100g: CHEESE_PIZZA, grams: 100 },
      { per100g: BANANA, grams: 100 },
    ])
    const coverage = micronutrientCoverage(daily, totals)
    const vitaminD = coverage.items.find((item) => item.key === 'vitaminD')
    expect(vitaminD).toMatchObject({ consumed: 0, dataComplete: false })
    expect(coverage.items.filter((item) => !item.dataComplete).map((item) => item.key)).toEqual(['vitaminD'])
    expect(coverage.dataCompleteness).toBe(0.5)
  })

  it('uses the logged items for an exact completeness share', () => {
    const items = [
      { per100g: nutrientProfile({ iron: null, calcium: null, vitaminC: 1, vitaminD: 1, potassium: 1 }) },
      { per100g: nutrientProfile({ iron: 1, calcium: 1, vitaminC: 1, vitaminD: 1, potassium: 1 }) },
    ]
    const totals = sumNutrientProfiles(items.map((item) => item.per100g))
    expect(micronutrientCoverage(daily, totals).dataCompleteness).toBe(0)
    expect(micronutrientCoverage(daily, totals, items).dataCompleteness).toBe(0.5)
    expect(micronutrientCoverage(daily, totals, []).dataCompleteness).toBe(0)
  })

  it('reports zero completeness when no item has micronutrient data', () => {
    const totals = sumNutrientProfiles([nutrientProfile({ calories: 120 })])
    const coverage = micronutrientCoverage(daily, totals)
    expect(coverage.dataCompleteness).toBe(0)
    expect(coverage.overall).toBe(0)
    expect(coverage.items.every((item) => !item.dataComplete)).toBe(true)
  })

  it('skips nutrients without a positive target', () => {
    const partial = dailyTargets({ iron: target('goal', 18, null, 45), calcium: target('goal', 0, null, null) })
    const totals = sumNutrientProfiles([nutrientProfile({ iron: 9, calcium: 300 })])
    const coverage = micronutrientCoverage(partial, totals)
    expect(coverage.items.map((item) => item.key)).toEqual(['iron'])
    expect(coverage.overall).toBe(0.5)
  })

  it('overall is null when no micronutrient has a target', () => {
    const totals = sumNutrientProfiles([nutrientProfile({ iron: 9 })])
    expect(micronutrientCoverage(dailyTargets({}), totals)).toEqual({ items: [], overall: null, dataCompleteness: 0 })
  })
})
