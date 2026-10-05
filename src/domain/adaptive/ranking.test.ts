import { describe, expect, it } from 'vitest'
import { food, systemFood } from './__fixtures__/adaptive'
import { item, noVariety, rankingContext } from './__fixtures__/ranking'
import { RANKING_WEIGHTS } from './constants'
import { optionTotals, scoreOption, subScores } from './ranking'
import type { EnergyState } from './types'

const chicken = systemFood('chicken_breast_roasted')
const rice = systemFood('brown_rice_cooked')
const broccoli = systemFood('broccoli_cooked')
const balancedPlate = [item(chicken, 120), item(rice, 250), item(broccoli, 150), item(systemFood('olive_oil'), 10)]

describe('optionTotals', () => {
  it('sums known values and keeps nutrients nobody knows unknown', () => {
    const a = food({ per100g: { calories: 100, vitaminD: null } })
    const b = food({ per100g: { calories: 50, vitaminD: null, iron: null } })
    const totals = optionTotals([item(a, 100), item(b, 200)])
    expect(totals.calories).toBe(200)
    expect(totals.iron).toBeCloseTo(1.5)
    expect(totals.vitaminD).toBeNull()
  })
})

describe('scoreOption', () => {
  it('uses weights that sum to 1, none above 0.2', () => {
    for (const state of ['normal', 'light', 'surplus'] as EnergyState[]) {
      const weights = Object.values(RANKING_WEIGHTS[state])
      expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1)
      expect(Math.max(...weights)).toBeLessThanOrEqual(0.2)
    }
  })

  it('reports each dimension as sub-score × weight and the score as their sum', () => {
    const ctx = rankingContext({ microGaps: ['iron'], gaps: ['iron'] })
    const { score, breakdown } = scoreOption(balancedPlate, ctx)
    const sub = subScores(balancedPlate, ctx)
    for (const key of Object.keys(breakdown) as Array<keyof typeof breakdown>) {
      expect(breakdown[key]).toBeCloseTo(sub[key] * RANKING_WEIGHTS.normal[key])
    }
    expect(score).toBeCloseTo(Object.values(breakdown).reduce((sum, value) => sum + value, 0))
    expect(score).toBeGreaterThan(0.75)
  })

  it('does not let a nutrient-dense but unbalanced, impractical food dominate', () => {
    const superGreens = food({
      name: 'Super greens',
      category: 'vegetable',
      per100g: { calories: 30, protein: 3, carbs: 4, fat: 0.4, fiber: 5, iron: 6, vitaminC: 150, potassium: 700, calcium: 200 },
      prepMinutes: 40,
      requiresCooking: true,
      costTier: 3,
    })
    const ctx = rankingContext({ gaps: ['fiber', 'iron', 'vitaminC'], microGaps: ['iron', 'vitaminC'] })
    const greens = scoreOption([item(superGreens, 250)], ctx)
    const plate = scoreOption(balancedPlate, ctx)
    expect(greens.breakdown.micronutrients).toBeGreaterThanOrEqual(plate.breakdown.micronutrients)
    expect(greens.breakdown.fiber).toBeGreaterThanOrEqual(plate.breakdown.fiber)
    expect(plate.score).toBeGreaterThan(greens.score + 0.2)
  })

  it('does not rank on protein alone', () => {
    const proteinPowder = food({ category: 'protein', per100g: { calories: 380, protein: 85, carbs: 4, fat: 3, fiber: 0, iron: 1, vitaminC: 0 } })
    const ctx = rankingContext({ gaps: ['protein'] })
    expect(scoreOption(balancedPlate, ctx).score).toBeGreaterThan(scoreOption([item(proteinPowder, 180)], ctx).score)
  })

  it('treats unknown option energy and a missing energy budget as 0 kcal', () => {
    const unknownEnergy = food({ per100g: { calories: null } })
    expect(subScores([item(unknownEnergy, 200)], rankingContext()).calorieFit).toBe(0)
    const { calories: _unused, ...noEnergyBudget } = rankingContext().budget
    expect(subScores([item(unknownEnergy, 200)], rankingContext({ budget: noEnergyBudget })).calorieFit).toBe(1)
    expect(subScores(balancedPlate, rankingContext({ budget: noEnergyBudget })).calorieFit).toBe(0)
  })

  it('ranks foods eaten today below the same option otherwise', () => {
    const fresh = scoreOption(balancedPlate, rankingContext())
    const repeated = scoreOption(balancedPlate, rankingContext({ variety: noVariety({ eatenIds: new Set([chicken.id]) }) }))
    expect(repeated.score).toBeLessThan(fresh.score)
    expect(repeated.breakdown.calorieFit).toBe(fresh.breakdown.calorieFit)
  })

  it('weights fiber and micronutrients more with a light allowance', () => {
    const ctx = rankingContext({ energyState: 'surplus', gaps: ['vitaminC'], microGaps: ['vitaminC'] })
    const sub = subScores(balancedPlate, ctx)
    const { breakdown } = scoreOption(balancedPlate, ctx)
    expect(breakdown.fiber).toBeCloseTo(sub.fiber * 0.2)
    expect(breakdown.macroFit).toBeCloseTo(sub.macroFit * 0.1)
  })
})
