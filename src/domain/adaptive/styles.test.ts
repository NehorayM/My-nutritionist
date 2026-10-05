import { describe, expect, it } from 'vitest'
import { food, systemFood } from './__fixtures__/adaptive'
import { prefs } from './__fixtures__/ranking'
import { LIGHT_STYLE_FACTOR, STYLE_RULES, fitsWith, maxSidesFor, stylesByRelevance, type StyleSignals } from './styles'
import { RECOMMENDATION_STYLES } from './types'

function signals(overrides: Partial<StyleSignals> = {}): StyleSignals {
  return { gaps: [], energyState: 'normal', prefs: prefs(), ...overrides }
}

function order(overrides: Partial<StyleSignals> = {}): string[] {
  return stylesByRelevance(signals(overrides)).map((entry) => entry.style)
}

describe('style rules', () => {
  it('quick options use foods ready in 10 minutes or less', () => {
    expect(STYLE_RULES.quick.anchor(food({ prepMinutes: 10 }))).toBe(true)
    expect(STYLE_RULES.quick.anchor(food({ prepMinutes: 11 }))).toBe(false)
    expect(STYLE_RULES.quick.side(food({ prepMinutes: null, requiresCooking: true }))).toBe(false)
    expect(STYLE_RULES.quick.side(food({ prepMinutes: null, requiresCooking: false }))).toBe(true)
  })

  it('no-cook, budget and mediterranean options follow the food data', () => {
    expect(STYLE_RULES.no_cook.anchor(food({ requiresCooking: false }))).toBe(true)
    expect(STYLE_RULES.no_cook.side(food({ requiresCooking: null }))).toBe(false)
    expect(STYLE_RULES.budget.anchor(food({ costTier: 1 }))).toBe(true)
    expect(STYLE_RULES.budget.side(food({ costTier: null }))).toBe(false)
    expect(STYLE_RULES.mediterranean.anchor(food({ tags: ['mediterranean'] }))).toBe(true)
    expect(STYLE_RULES.mediterranean.anchor(systemFood('tomato'))).toBe(true)
    expect(STYLE_RULES.mediterranean.side(food({ category: 'vegetable', tags: [] }))).toBe(true)
    expect(STYLE_RULES.mediterranean.side(food({ category: 'fruit', tags: [] }))).toBe(true)
    expect(STYLE_RULES.mediterranean.side(food({ category: 'grain', tags: [] }))).toBe(false)
  })

  it('high-protein anchors get at least 30 % of their energy from protein', () => {
    expect(STYLE_RULES.high_protein.anchor(systemFood('chicken_breast_roasted'))).toBe(true)
    expect(STYLE_RULES.high_protein.anchor(systemFood('hummus'))).toBe(false)
    expect(STYLE_RULES.high_protein.side(systemFood('tomato'))).toBe(true)
  })

  it('light options use lower-energy foods and no added fats', () => {
    expect(STYLE_RULES.light.anchor(food({ per100g: { calories: 200 } }))).toBe(true)
    expect(STYLE_RULES.light.anchor(food({ per100g: { calories: 201 } }))).toBe(false)
    expect(STYLE_RULES.light.side(food({ category: 'vegetable', per100g: { calories: 30 } }))).toBe(true)
    expect(STYLE_RULES.light.side(food({ category: 'grain', per100g: { calories: 160 } }))).toBe(false)
    expect(STYLE_RULES.light.side(food({ category: 'fat', per100g: { calories: 100 } }))).toBe(false)
    expect(STYLE_RULES.light.anchor(food({ per100g: { calories: null } }))).toBe(false)
    expect(STYLE_RULES.light.side(food({ category: 'vegetable', per100g: { calories: null } }))).toBe(false)
  })

  it('aims the light style below a regular budget, every other style at the full budget', () => {
    expect(STYLE_RULES.light.energyFactor('normal')).toBe(LIGHT_STYLE_FACTOR)
    expect(STYLE_RULES.light.energyFactor('surplus')).toBe(1)
    for (const style of RECOMMENDATION_STYLES.filter((name) => name !== 'light')) {
      expect(STYLE_RULES[style].energyFactor('normal')).toBe(1)
      expect(STYLE_RULES[style].energyFactor('light')).toBe(1)
    }
  })
})

describe('stylesByRelevance', () => {
  it('keeps the canonical order on an ordinary day, balanced first', () => {
    expect(order()).toEqual(['balanced', 'high_protein', 'quick', 'no_cook', 'mediterranean', 'budget', 'light'])
  })

  it('puts high-protein first with a protein gap', () => {
    expect(order({ gaps: ['protein'] })[0]).toBe('high_protein')
    expect(order({ prefs: prefs({ dietType: 'high_protein' }) }).indexOf('high_protein')).toBe(1)
  })

  it('puts light first with a light allowance', () => {
    expect(order({ energyState: 'surplus' })[0]).toBe('light')
    expect(order({ energyState: 'light' })[0]).toBe('light')
  })

  it('raises balanced and mediterranean for fiber and micronutrient gaps, and mediterranean for its fans', () => {
    const relevance = Object.fromEntries(stylesByRelevance(signals({ gaps: ['fiber', 'iron'] })).map((s) => [s.style, s.relevance]))
    expect(relevance.balanced).toBe(3)
    expect(relevance.mediterranean).toBe(1)
    expect(order({ prefs: prefs({ dietType: 'mediterranean', preferredCuisines: ['mediterranean'] }) })[0]).toBe('mediterranean')
  })

  it('raises quick and no-cook for beginners and short prep limits', () => {
    const relevance = (overrides: Partial<StyleSignals>) =>
      Object.fromEntries(stylesByRelevance(signals(overrides)).map((entry) => [entry.style, entry.relevance]))
    const beginner = relevance({ prefs: prefs({ cookingSkill: 'beginner', maxPrepMinutes: 15 }) })
    expect(beginner.quick).toBe(2)
    expect(beginner.no_cook).toBe(1)
    expect(order({ prefs: prefs({ cookingSkill: 'beginner', maxPrepMinutes: 15 }) })[0]).toBe('quick')
    const confident = relevance({ prefs: prefs({ cookingSkill: 'confident', maxPrepMinutes: 60 }) })
    expect([confident.quick, confident.no_cook]).toEqual([0, 0])
  })
})

describe('composition limits', () => {
  it('takes one side for snacks and light options, two otherwise', () => {
    expect(maxSidesFor('balanced', 'lunch')).toBe(2)
    expect(maxSidesFor('balanced', 'snack')).toBe(1)
    expect(maxSidesFor('light', 'dinner')).toBe(1)
  })

  it('adds a side only when it is a different food that pairs with every component', () => {
    const chicken = systemFood('chicken_breast_roasted')
    const rice = systemFood('brown_rice_cooked')
    expect(fitsWith(rice, [chicken], 'dinner')).toBe(true)
    expect(fitsWith(chicken, [chicken], 'dinner')).toBe(false)
    expect(fitsWith(systemFood('pasta_cooked'), [chicken, rice], 'dinner')).toBe(false)
  })
})
