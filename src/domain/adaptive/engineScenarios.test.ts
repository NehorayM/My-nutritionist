import { describe, expect, it } from 'vitest'
import type { NutrientKey, NutrientProfile } from '@/types'
import { entry, food, localTime, planInput, profile, recommendedFoods, systemFood, targetsFor } from './__fixtures__/adaptive'
import { buildAdaptivePlan } from './engine'
import type { AdaptivePlan } from './types'

function mean(plan: AdaptivePlan, key: NutrientKey): number {
  return plan.recommendations.reduce((sum, rec) => sum + (rec.totals[key] ?? 0), 0) / plan.recommendations.length
}

/**
 * A day of 700 kcal from one shake (breakfast + lunch), planned at 18:00 for dinner. By default the shake covers
 * protein, fiber and every micronutrient for the day, so nothing is a gap; override values to create gaps.
 */
function shakeDay(per100g: Partial<NutrientProfile> = {}): AdaptivePlan {
  const shake = food({
    name: 'Shake',
    per100g: { calories: 100, protein: 10, carbs: 8, fat: 3, fiber: 4, potassium: 400, calcium: 150, vitaminD: 2.5, iron: 2.6, vitaminC: 11, ...per100g },
  })
  return buildAdaptivePlan(planInput({ now: localTime(18, 0), entries: [entry(shake, 350, 'breakfast'), entry(shake, 350, 'lunch')] }))
}

const covered = shakeDay()

describe('adapting to the day so far', () => {
  it('a covered day gets regular options without naming gaps', () => {
    expect(covered.status).toBe('ok')
    expect(covered.targetMeal).toBe('dinner')
    expect(covered.message).toBe("Options for dinner that fit what's left of today.")
  })

  it('a protein gap leads with high-protein options that add more protein', () => {
    const plan = shakeDay({ protein: 2 })
    expect(plan.message).toBe('Options for dinner that add protein to your day.')
    expect(plan.budget.protein!).toBeGreaterThan(covered.budget.protein!)
    expect(plan.recommendations.map((rec) => rec.style)).toContain('high_protein')
    expect(mean(plan, 'protein')).toBeGreaterThan(mean(covered, 'protein'))
    expect(plan.recommendations.every((rec) => rec.highlights.includes('protein'))).toBe(true)
  })

  it('a fiber gap brings more fiber', () => {
    const plan = shakeDay({ fiber: 0.5 })
    expect(plan.message).toBe('Options for dinner that add fiber to your day.')
    // On average the options meet the meal's (now larger) fiber budget and beat a day without the gap.
    expect(plan.budget.fiber!).toBeGreaterThan(covered.budget.fiber! * 2)
    expect(mean(plan, 'fiber')).toBeGreaterThanOrEqual(plan.budget.fiber!)
    expect(mean(plan, 'fiber')).toBeGreaterThan(mean(covered, 'fiber'))
    expect(plan.recommendations.every((rec) => rec.highlights[0] === 'fiber')).toBe(true)
  })

  it('iron and vitamin C gaps bring options richer in both', () => {
    const plan = shakeDay({ iron: 0, vitaminC: 0 })
    expect(plan.message).toBe('Options for dinner that add iron and vitamin C to your day.')
    // Legume-based plates are iron-rich even without a gap, so iron is judged against the meal's iron budget:
    // options cover a substantial share of it on average and the best option most of it. Vitamin C is easy to
    // reach with vegetables, so the options meet its budget and clearly exceed a day without the gap.
    const iron = plan.recommendations.map((rec) => rec.totals.iron ?? 0)
    expect(mean(plan, 'iron')).toBeGreaterThanOrEqual(plan.budget.iron! * 0.5)
    expect(Math.max(...iron)).toBeGreaterThanOrEqual(plan.budget.iron! * 0.75)
    expect(mean(plan, 'vitaminC')).toBeGreaterThanOrEqual(plan.budget.vitaminC!)
    expect(mean(plan, 'vitaminC')).toBeGreaterThan(mean(covered, 'vitaminC') * 1.5)
    for (const rec of plan.recommendations) expect(['iron', 'vitaminC']).toContain(rec.highlights[0])
  })
})

describe('a large pizza day (energy surplus)', () => {
  const pizza = systemFood('cheese_pizza')
  const entries = [entry(pizza, 300, 'breakfast'), entry(pizza, 600, 'lunch'), entry(systemFood('cola'), 740, 'lunch')]
  const plan = buildAdaptivePlan(planInput({ entries, now: localTime(18, 0) }))
  const daily = targetsFor(profile()).targets.calories!.amount

  it('still suggests a light dinner with neutral framing', () => {
    expect(plan.status).toBe('ok')
    expect(plan.targetMeal).toBe('dinner')
    expect(plan.message).toBe("Today's intake is already above your energy target — lighter, fiber-rich options can round out the day.")
    expect(plan.budget.calories).toBeCloseTo((daily / 3.35) * 0.5)
  })

  it('keeps every option light and leads with a lighter style', () => {
    expect(plan.recommendations.length).toBeGreaterThanOrEqual(3)
    expect(plan.recommendations.map((rec) => rec.style)).toContain('light')
    for (const rec of plan.recommendations) {
      expect(rec.totals.calories!).toBeLessThanOrEqual(plan.budget.calories! * 1.15)
      expect(rec.explanation.startsWith('A lighter option')).toBe(true)
      expect(rec.totals.fiber!).toBeGreaterThan(3)
    }
  })

  it('does not suggest pizza again', () => {
    expect(recommendedFoods(plan).map((item) => item.id)).not.toContain(pizza.id)
  })
})

describe('variety', () => {
  const lunch = buildAdaptivePlan(planInput())
  const top = lunch.recommendations[0]!.items[0]!.food
  const count = (plan: AdaptivePlan, id: string) => recommendedFoods(plan).filter((item) => item.id === id).length

  it('gives each option its own anchor', () => {
    const anchors = lunch.recommendations.map((rec) => rec.items[0]!.food.id)
    expect(new Set(anchors).size).toBe(anchors.length)
  })

  it('moves away from a food already eaten today', () => {
    const plan = buildAdaptivePlan(planInput({ entries: [entry(top, 150, 'breakfast')] }))
    const rankOf = (p: AdaptivePlan) => p.recommendations.findIndex((rec) => rec.items.some((item) => item.food.id === top.id))
    // Variety is a soft rule: the food eaten today drops in the ranking (or out of it), never rises.
    expect(count(plan, top.id)).toBeLessThanOrEqual(count(lunch, top.id))
    expect(plan.recommendations[0]!.items[0]!.food.id).not.toBe(top.id)
    expect(rankOf(plan) === -1 || rankOf(plan) > rankOf(lunch)).toBe(true)
  })

  it('ranks a recently eaten food lower', () => {
    const plan = buildAdaptivePlan(planInput({ recentFoodIds: [top.id] }))
    const before = lunch.recommendations.find((rec) => rec.items.some((item) => item.food.id === top.id))!
    const after = plan.recommendations.find((rec) => rec.id === before.id)
    expect(after === undefined || after.breakdown.variety < before.breakdown.variety).toBe(true)
    expect(plan.recommendations[0]!.items[0]!.food.id).not.toBe(top.id)
  })

  it('never repeats the same item set', () => {
    for (const plan of [lunch, covered]) {
      const keys = plan.recommendations.map((rec) => rec.items.map((item) => item.food.id).sort().join('+'))
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})

describe('balanced ranking', () => {
  it('does not let a nutrient-dense but unbalanced, impractical food take over', () => {
    const powder = food({
      name: 'Algae protein bowl',
      category: 'protein',
      per100g: { calories: 290, protein: 57, carbs: 24, fat: 8, fiber: 4, iron: 28, vitaminC: 10, calcium: 120, potassium: 1360, vitaminD: 0 },
      prepMinutes: 40,
      requiresCooking: true,
      costTier: 3,
    })
    const plan = buildAdaptivePlan(planInput({ foods: [...planInput().foods, powder], now: localTime(18, 0), entries: [entry(systemFood('white_bread'), 100, 'breakfast')] }))
    expect(plan.recommendations[0]!.items.map((item) => item.food.id)).not.toContain(powder.id)
    expect(recommendedFoods(plan).filter((item) => item.id === powder.id).length).toBeLessThanOrEqual(1)
  })
})
